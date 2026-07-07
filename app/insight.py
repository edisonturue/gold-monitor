from __future__ import annotations

import json
import queue
import re
import threading
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote_plus, urlparse

from app.config import Settings
from app.db import Database
from app.models import PriceTick
from app.notifier import Notifier
from app.sources.base import HttpClient, SourceError


DEFAULT_SOURCE_POLICY_MODE = "whitelist_preferred"
DEFAULT_SOURCE_WHITELIST = [
    "news.cctv.com",
    "cnn.com",
    "wsj.com",
    "reuters.com",
    "bloomberg.com",
    "ft.com",
]
STRATEGY_CATALOG = [
    {
        "key": "evidence_binding",
        "label": "证据锚定",
        "description": "每条关键结论都必须绑定明确证据（媒体+标题+时间+URL）。",
        "instruction": "每条关键结论至少引用1条证据，并在结论后标注对应媒体标题与URL。",
    },
    {
        "key": "macro_cross_asset",
        "label": "宏观联动",
        "description": "优先解释美联储、美元指数、美债收益率等宏观变量影响。",
        "instruction": "优先分析美联储表态、美元指数与美债收益率对金价的传导路径。",
    },
    {
        "key": "central_bank_flow",
        "label": "央行购金",
        "description": "重点关注各国央行增持/减持黄金储备对预期的影响。",
        "instruction": "重点识别各大央行黄金储备增减持消息，并评估对中期金价预期的影响。",
    },
    {
        "key": "geopolitical_risk",
        "label": "地缘风险",
        "description": "强化战争、制裁、地区冲突等避险逻辑判断。",
        "instruction": "优先识别地缘冲突、制裁、政治风险事件，判断避险需求是否主导本轮波动。",
    },
    {
        "key": "counter_evidence",
        "label": "反证优先",
        "description": "主动列出和主结论相反的证据与不确定性。",
        "instruction": "必须单列反向证据与分歧观点，避免单边结论。",
    },
]
DEFAULT_STRATEGY_KEYS = [
    "evidence_binding",
    "macro_cross_asset",
    "central_bank_flow",
    "geopolitical_risk",
]
STRATEGY_CATALOG_BY_KEY = {item["key"]: item for item in STRATEGY_CATALOG}


@dataclass(slots=True)
class NewsPolicyResult:
    items: list[dict]
    authoritative_count: int
    supplemental_count: int
    insufficient_authoritative: bool


def _normalize_domain(value: str | None) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if "://" in raw:
        parsed = urlparse(raw)
        raw = parsed.netloc or parsed.path
    raw = raw.split("/", 1)[0]
    raw = raw.split("?", 1)[0]
    if raw.startswith("www."):
        raw = raw[4:]
    return raw


def _url_domain(url: str | None) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    host = parsed.netloc or parsed.path
    return _normalize_domain(host)


def _domain_allowed(domain: str, whitelist: list[str]) -> bool:
    host = _normalize_domain(domain)
    if not host:
        return False
    for item in whitelist:
        candidate = _normalize_domain(item)
        if not candidate:
            continue
        if host == candidate or host.endswith(f".{candidate}"):
            return True
    return False


class NewsPolicy:
    def __init__(self, *, mode: str, whitelist_domains: list[str], min_authoritative_articles: int) -> None:
        self.mode = "whitelist_only" if str(mode).strip().lower() == "whitelist_only" else "whitelist_preferred"
        self.whitelist_domains = [_normalize_domain(item) for item in (whitelist_domains or []) if _normalize_domain(item)]
        self.min_authoritative_articles = max(1, int(min_authoritative_articles))

    def apply(self, items: list[dict]) -> NewsPolicyResult:
        unique_seen: set[str] = set()
        normalized: list[dict] = []
        authoritative_count = 0
        supplemental_count = 0

        for item in items or []:
            url = str(item.get("url") or "").strip()
            title = str(item.get("title") or "").strip()
            if not url and not title:
                continue
            unique_key = url or title
            if unique_key in unique_seen:
                continue
            unique_seen.add(unique_key)

            domain = _url_domain(url) or _normalize_domain(item.get("source_domain"))
            allowed = _domain_allowed(domain, self.whitelist_domains)
            if self.mode == "whitelist_only" and not allowed:
                continue

            source_tier = "tier1_authoritative" if allowed else "tier2_supplemental"
            if source_tier == "tier1_authoritative":
                authoritative_count += 1
            else:
                supplemental_count += 1

            next_item = dict(item)
            next_item["source_tier"] = source_tier
            next_item["source_domain"] = domain
            normalized.append(next_item)

        insufficient_authoritative = authoritative_count < self.min_authoritative_articles
        return NewsPolicyResult(
            items=normalized,
            authoritative_count=authoritative_count,
            supplemental_count=supplemental_count,
            insufficient_authoritative=insufficient_authoritative,
        )


def build_analysis_prompt(
    *,
    symbol: str,
    direction: str,
    change_pct: float,
    window_minutes: int,
    evidence: list[dict],
    strategy_instructions: list[str] | None = None,
) -> str:
    direction_text = "上涨" if direction == "up" else "下跌"
    evidence_lines: list[str] = []
    for idx, item in enumerate(evidence, start=1):
        evidence_lines.append(
            f"{idx}. 媒体={item.get('outlet', '未知')} | 标题={item.get('title', '')} | 时间={item.get('published_at', '')} | URL={item.get('url', '')} | 分层={item.get('source_tier', '')}"
        )
    strategy_lines = [str(line).strip() for line in (strategy_instructions or []) if str(line).strip()]
    if not strategy_lines:
        strategy_lines = ["每条关键结论必须绑定证据，并主动说明反证与不确定性。"]
    strategy_text = "\n".join(f"{idx}. {line}" for idx, line in enumerate(strategy_lines, start=1))

    return (
        "你是金价异动归因助手。你的唯一任务：根据给定新闻证据，解释本次金价涨跌原因。\n"
        "硬性约束：\n"
        "1) 只能基于给定证据，不得编造事实与媒体观点。\n"
        "2) 每条关键结论都必须引用至少一条证据（标题+URL）。\n"
        "3) 若证据冲突，必须列出分歧并给出中性判断。\n"
        "4) 若证据不足，必须明确写“证据不足”，并降低置信度。\n"
        "5) 输出必须是 JSON 对象。\n\n"
        "执行策略（多策略叠加生效）：\n"
        f"{strategy_text}\n\n"
        f"事件：symbol={symbol}，方向={direction_text}，涨跌幅={change_pct:.2f}%，窗口={int(window_minutes)}分钟。\n"
        "证据列表：\n"
        f"{chr(10).join(evidence_lines) if evidence_lines else '（无）'}\n\n"
        "JSON 输出结构：\n"
        "{\n"
        '  "summary": "结论摘要",\n'
        '  "upside_drivers": ["上行动因1","上行动因2"],\n'
        '  "downside_drivers": ["下行动因1","下行动因2"],\n'
        '  "primary_causes_ranked": ["主因1","主因2","主因3"],\n'
        '  "risks_and_counter_evidence": ["风险或反证1"],\n'
        '  "confidence": 0.0,\n'
        '  "confidence_reason": "为什么是这个置信度",\n'
        '  "evidence": [\n'
        '    {"title":"", "url":"", "outlet":"", "published_at":"", "source_tier":"tier1_authoritative|tier2_supplemental"}\n'
        "  ]\n"
        "}"
    )


class InsightEngine:
    def __init__(
        self,
        *,
        db: Database,
        settings: Settings,
        notifier: Notifier,
        client: HttpClient | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.notifier = notifier
        self.client = client or HttpClient(timeout=settings.request_timeout_sec)
        self._queue: queue.Queue[int] = queue.Queue()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._settings_lock = threading.Lock()
        self._cached_settings: dict[str, Any] | None = None
        self._cached_at = 0.0

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._worker_loop, daemon=True, name="insight-worker")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive() and not self._stop.is_set())

    def _setting(self, key: str, default: Any) -> Any:
        value = self.db.get_setting(key)
        if value is None or value == "":
            return default
        if isinstance(default, bool):
            return str(value).strip().lower() in {"1", "true", "yes", "on"}
        if isinstance(default, int):
            try:
                return int(value)
            except ValueError:
                return default
        if isinstance(default, float):
            try:
                return float(value)
            except ValueError:
                return default
        return value

    def _setting_json(self, key: str, default: Any) -> Any:
        raw = self.db.get_setting(key)
        if not raw:
            return default
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return default

    def _load_settings(self) -> dict[str, Any]:
        now = time.monotonic()
        with self._settings_lock:
            if self._cached_settings is not None and now - self._cached_at <= 2:
                return dict(self._cached_settings)

            source_policy_mode = self._setting("insight_source_policy_mode", DEFAULT_SOURCE_POLICY_MODE)
            if str(source_policy_mode).strip().lower() not in {"whitelist_preferred", "whitelist_only"}:
                source_policy_mode = DEFAULT_SOURCE_POLICY_MODE
            whitelist = self._setting_json("insight_source_whitelist_domains", DEFAULT_SOURCE_WHITELIST)
            if not isinstance(whitelist, list):
                whitelist = DEFAULT_SOURCE_WHITELIST
            whitelist = [_normalize_domain(item) for item in whitelist if _normalize_domain(item)]
            if not whitelist:
                whitelist = list(DEFAULT_SOURCE_WHITELIST)
            strategy_keys = self._setting_json("insight_strategy_keys", list(DEFAULT_STRATEGY_KEYS))
            if not isinstance(strategy_keys, list):
                strategy_keys = list(DEFAULT_STRATEGY_KEYS)
            normalized_strategy_keys = []
            seen_strategy: set[str] = set()
            for item in strategy_keys:
                key = str(item or "").strip()
                if key not in STRATEGY_CATALOG_BY_KEY or key in seen_strategy:
                    continue
                seen_strategy.add(key)
                normalized_strategy_keys.append(key)
            if not normalized_strategy_keys:
                normalized_strategy_keys = list(DEFAULT_STRATEGY_KEYS)
            custom_strategy_lines = self._setting_json("insight_custom_strategy_lines", [])
            if not isinstance(custom_strategy_lines, list):
                custom_strategy_lines = []
            normalized_custom_lines = []
            seen_custom: set[str] = set()
            for item in custom_strategy_lines:
                line = str(item or "").strip()
                if not line or line in seen_custom:
                    continue
                if len(line) > 240:
                    line = line[:240]
                seen_custom.add(line)
                normalized_custom_lines.append(line)

            payload = {
                "insight_enabled": bool(self._setting("insight_enabled", True)),
                "insight_symbols": self._setting_json("insight_symbols", ["XAUUSD", "AUCN"]),
                "up_pct": abs(float(self._setting("insight_up_pct", 2.0))),
                "down_pct": abs(float(self._setting("insight_down_pct", 2.0))),
                "window_minutes": max(5, int(self._setting("insight_window_minutes", 24 * 60))),
                "cooldown_sec": max(60, int(self._setting("insight_cooldown_sec", 3600))),
                "source_policy_mode": source_policy_mode,
                "source_whitelist_domains": whitelist,
                "min_authoritative_articles": max(1, int(self._setting("insight_min_authoritative_articles", 5))),
                "strategy_keys": normalized_strategy_keys,
                "custom_strategy_lines": normalized_custom_lines,
                "rss_enabled": bool(self._setting("insight_rss_enabled", True)),
                "news_api_enabled": bool(self._setting("insight_news_api_enabled", False)),
                "news_api_base_url": str(self._setting("insight_news_api_base_url", "")).strip(),
                "news_api_key": str(self._setting("insight_news_api_key", "")).strip(),
                "news_api_query_param": str(self._setting("insight_news_api_query_param", "q")).strip() or "q",
                "ai_enabled": bool(self._setting("insight_ai_enabled", False)),
                "ai_base_url": str(self._setting("insight_ai_base_url", "")).strip(),
                "ai_api_key": self._normalize_api_key(str(self._setting("insight_ai_api_key", ""))),
                "ai_model": str(self._setting("insight_ai_model", "gpt-4o-mini")).strip() or "gpt-4o-mini",
                "insight_notify_enabled": bool(self._setting("insight_notify_enabled", True)),
            }
            if not isinstance(payload["insight_symbols"], list):
                payload["insight_symbols"] = ["XAUUSD", "AUCN"]
            payload["insight_symbols"] = [
                str(item).strip().upper() for item in payload["insight_symbols"] if str(item).strip()
            ] or ["XAUUSD", "AUCN"]

            self._cached_settings = dict(payload)
            self._cached_at = now
            return payload

    def _invalidate_settings_cache(self) -> None:
        with self._settings_lock:
            self._cached_settings = None
            self._cached_at = 0.0

    @staticmethod
    def _normalize_api_key(value: str) -> str:
        raw = str(value or "").strip()
        if raw.lower().startswith("bearer "):
            raw = raw[7:].strip()
        return raw

    @staticmethod
    def _mask_secret(value: str) -> str:
        if not value:
            return ""
        if len(value) <= 10:
            return "*" * len(value)
        return f"{value[:6]}...{value[-4:]}"

    def _strategy_preview(self, cfg: dict[str, Any]) -> str:
        mode_text = "仅白名单" if cfg["source_policy_mode"] == "whitelist_only" else "白名单优先 + 不足补充"
        domains = ", ".join(cfg["source_whitelist_domains"])
        selected_keys = [str(item) for item in cfg.get("strategy_keys", []) if str(item) in STRATEGY_CATALOG_BY_KEY]
        selected_labels = [STRATEGY_CATALOG_BY_KEY[key]["label"] for key in selected_keys]
        if not selected_labels:
            selected_labels = [STRATEGY_CATALOG_BY_KEY[key]["label"] for key in DEFAULT_STRATEGY_KEYS]
        custom_count = len([str(item).strip() for item in cfg.get("custom_strategy_lines", []) if str(item).strip()])
        return (
            f"策略模式：{mode_text}；最小权威条数：{cfg['min_authoritative_articles']}；"
            f"白名单：{domains}；叠加策略：{'、'.join(selected_labels)}；"
            f"自定义策略：{custom_count} 条。"
            "AI 只基于证据归因，不得编造；证据不足时明确降置信度。"
        )

    def _strategy_instructions(self, cfg: dict[str, Any]) -> list[str]:
        keys = [str(item) for item in cfg.get("strategy_keys", []) if str(item) in STRATEGY_CATALOG_BY_KEY]
        if not keys:
            keys = list(DEFAULT_STRATEGY_KEYS)
        lines = []
        for key in keys:
            item = STRATEGY_CATALOG_BY_KEY[key]
            lines.append(f"{item['label']}：{item['instruction']}")
        custom_lines = [str(item).strip() for item in cfg.get("custom_strategy_lines", []) if str(item).strip()]
        for idx, line in enumerate(custom_lines, start=1):
            lines.append(f"自定义策略{idx}：{line}")
        return lines

    def get_settings_payload(self) -> dict:
        cfg = self._load_settings()
        return {
            "insight_enabled": cfg["insight_enabled"],
            "insight_symbols": list(cfg["insight_symbols"]),
            "up_pct": cfg["up_pct"],
            "down_pct": cfg["down_pct"],
            "window_minutes": cfg["window_minutes"],
            "cooldown_sec": cfg["cooldown_sec"],
            "source_policy_mode": cfg["source_policy_mode"],
            "source_whitelist_domains": list(cfg["source_whitelist_domains"]),
            "min_authoritative_articles": cfg["min_authoritative_articles"],
            "strategy_keys": list(cfg["strategy_keys"]),
            "custom_strategy_lines": list(cfg["custom_strategy_lines"]),
            "strategy_catalog": [
                {"key": item["key"], "label": item["label"], "description": item["description"]}
                for item in STRATEGY_CATALOG
            ],
            "rss_enabled": cfg["rss_enabled"],
            "news_api_enabled": cfg["news_api_enabled"],
            "news_api_base_url": cfg["news_api_base_url"],
            "news_api_key_masked": self._mask_secret(cfg["news_api_key"]),
            "news_api_query_param": cfg["news_api_query_param"],
            "ai_enabled": cfg["ai_enabled"],
            "ai_base_url": cfg["ai_base_url"],
            "ai_api_key_masked": self._mask_secret(cfg["ai_api_key"]),
            "ai_model": cfg["ai_model"],
            "insight_notify_enabled": cfg["insight_notify_enabled"],
            "source_policy_modes": ["whitelist_preferred", "whitelist_only"],
            "strategy_preview": self._strategy_preview(cfg),
        }

    def patch_settings(self, payload: dict) -> dict:
        if "source_policy_mode" in payload:
            mode = str(payload["source_policy_mode"]).strip().lower()
            if mode not in {"whitelist_preferred", "whitelist_only"}:
                raise ValueError("source_policy_mode must be whitelist_preferred or whitelist_only")
            self.db.set_setting("insight_source_policy_mode", mode)

        if "source_whitelist_domains" in payload:
            domains = payload["source_whitelist_domains"]
            if not isinstance(domains, list):
                raise ValueError("source_whitelist_domains must be string array")
            normalized = [_normalize_domain(item) for item in domains if _normalize_domain(item)]
            if not normalized:
                raise ValueError("source_whitelist_domains cannot be empty")
            self.db.set_setting("insight_source_whitelist_domains", json.dumps(normalized, ensure_ascii=False))

        if "min_authoritative_articles" in payload:
            try:
                value = max(1, int(payload["min_authoritative_articles"]))
            except (TypeError, ValueError):
                raise ValueError("min_authoritative_articles must be integer >= 1") from None
            self.db.set_setting("insight_min_authoritative_articles", str(value))
        if "strategy_keys" in payload:
            strategy_keys = payload["strategy_keys"]
            if not isinstance(strategy_keys, list):
                raise ValueError("strategy_keys must be string array")
            normalized_keys = []
            seen: set[str] = set()
            for item in strategy_keys:
                key = str(item or "").strip()
                if not key or key in seen:
                    continue
                if key not in STRATEGY_CATALOG_BY_KEY:
                    raise ValueError(f"strategy_keys contains unsupported key: {key}")
                seen.add(key)
                normalized_keys.append(key)
            if not normalized_keys:
                raise ValueError("strategy_keys cannot be empty")
            self.db.set_setting("insight_strategy_keys", json.dumps(normalized_keys, ensure_ascii=False))
        if "custom_strategy_lines" in payload:
            custom_lines = payload["custom_strategy_lines"]
            if not isinstance(custom_lines, list):
                raise ValueError("custom_strategy_lines must be string array")
            normalized_custom_lines = []
            seen_custom: set[str] = set()
            for item in custom_lines:
                line = str(item or "").strip()
                if not line or line in seen_custom:
                    continue
                if len(line) > 240:
                    raise ValueError("custom_strategy_lines item is too long (max 240)")
                seen_custom.add(line)
                normalized_custom_lines.append(line)
            if len(normalized_custom_lines) > 20:
                raise ValueError("custom_strategy_lines max size is 20")
            self.db.set_setting("insight_custom_strategy_lines", json.dumps(normalized_custom_lines, ensure_ascii=False))

        if "insight_enabled" in payload:
            self.db.set_setting("insight_enabled", "true" if bool(payload["insight_enabled"]) else "false")
        if "insight_symbols" in payload:
            symbols = payload["insight_symbols"]
            if not isinstance(symbols, list):
                raise ValueError("insight_symbols must be string array")
            normalized_symbols = [str(item).strip().upper() for item in symbols if str(item).strip()]
            if not normalized_symbols:
                raise ValueError("insight_symbols cannot be empty")
            self.db.set_setting("insight_symbols", json.dumps(normalized_symbols, ensure_ascii=False))
        if "up_pct" in payload:
            try:
                value = abs(float(payload["up_pct"]))
            except (TypeError, ValueError):
                raise ValueError("up_pct must be numeric") from None
            self.db.set_setting("insight_up_pct", str(value))
        if "down_pct" in payload:
            try:
                value = abs(float(payload["down_pct"]))
            except (TypeError, ValueError):
                raise ValueError("down_pct must be numeric") from None
            self.db.set_setting("insight_down_pct", str(value))
        if "window_minutes" in payload:
            try:
                value = max(5, int(payload["window_minutes"]))
            except (TypeError, ValueError):
                raise ValueError("window_minutes must be integer >= 5") from None
            self.db.set_setting("insight_window_minutes", str(value))
        if "cooldown_sec" in payload:
            try:
                value = max(60, int(payload["cooldown_sec"]))
            except (TypeError, ValueError):
                raise ValueError("cooldown_sec must be integer >= 60") from None
            self.db.set_setting("insight_cooldown_sec", str(value))
        if "rss_enabled" in payload:
            self.db.set_setting("insight_rss_enabled", "true" if bool(payload["rss_enabled"]) else "false")
        if "news_api_enabled" in payload:
            self.db.set_setting("insight_news_api_enabled", "true" if bool(payload["news_api_enabled"]) else "false")
        if "news_api_base_url" in payload:
            self.db.set_setting("insight_news_api_base_url", str(payload["news_api_base_url"]).strip())
        if "news_api_key" in payload:
            self.db.set_setting("insight_news_api_key", self._normalize_api_key(str(payload["news_api_key"])))
        if "news_api_query_param" in payload:
            param = str(payload["news_api_query_param"]).strip() or "q"
            self.db.set_setting("insight_news_api_query_param", param)
        if "ai_enabled" in payload:
            self.db.set_setting("insight_ai_enabled", "true" if bool(payload["ai_enabled"]) else "false")
        if "ai_base_url" in payload:
            self.db.set_setting("insight_ai_base_url", str(payload["ai_base_url"]).strip())
        if "ai_api_key" in payload:
            self.db.set_setting("insight_ai_api_key", self._normalize_api_key(str(payload["ai_api_key"])))
        if "ai_model" in payload:
            model = str(payload["ai_model"]).strip()
            if not model:
                raise ValueError("ai_model cannot be empty")
            self.db.set_setting("insight_ai_model", model)
        if "insight_notify_enabled" in payload:
            self.db.set_setting("insight_notify_enabled", "true" if bool(payload["insight_notify_enabled"]) else "false")

        self._invalidate_settings_cache()
        return self.get_settings_payload()

    def evaluate_tick(self, tick: PriceTick) -> None:
        cfg = self._load_settings()
        if not cfg["insight_enabled"]:
            return
        symbol = str(tick.symbol or "").upper()
        if symbol not in set(cfg["insight_symbols"]):
            return

        window_minutes = int(cfg["window_minutes"])
        reference_time = tick.timestamp.astimezone(timezone.utc) - timedelta(minutes=window_minutes)
        reference = self.db.get_reference_tick(symbol, reference_time)
        if not reference:
            return

        try:
            ref_price = float(reference["price"])
        except (KeyError, TypeError, ValueError):
            return
        if ref_price <= 0:
            return

        change_pct = ((float(tick.price) - ref_price) / ref_price) * 100
        direction = ""
        if change_pct >= float(cfg["up_pct"]):
            direction = "up"
        elif change_pct <= -abs(float(cfg["down_pct"])):
            direction = "down"
        if not direction:
            return

        last = self.db.get_latest_insight_event(symbol, direction)
        if last:
            raw_ts = str(last.get("triggered_at") or "")
            last_dt = self._parse_iso(raw_ts)
            if last_dt is not None:
                elapsed = (tick.timestamp.astimezone(timezone.utc) - last_dt).total_seconds()
                if elapsed < int(cfg["cooldown_sec"]):
                    return

        event_id = self.db.create_insight_event(
            symbol=symbol,
            direction=direction,
            change_pct=float(change_pct),
            window_minutes=window_minutes,
            triggered_at=tick.timestamp.astimezone(timezone.utc),
            status="queued",
        )
        self._queue.put(event_id)

    def enqueue_simulation(self, payload: dict | None = None) -> dict:
        body = payload or {}
        cfg = self._load_settings()

        symbol_default = "XAUUSD"
        if isinstance(cfg.get("insight_symbols"), list) and cfg["insight_symbols"]:
            symbol_default = str(cfg["insight_symbols"][0])
        symbol = str(body.get("symbol", symbol_default)).strip().upper()
        if not symbol:
            raise ValueError("symbol is required")

        direction = str(body.get("direction", "up")).strip().lower()
        if direction not in {"up", "down"}:
            raise ValueError("direction must be up or down")

        default_change = float(cfg["up_pct"]) if direction == "up" else -abs(float(cfg["down_pct"]))
        raw_change = body.get("change_pct", default_change)
        try:
            change_pct = float(raw_change)
        except (TypeError, ValueError):
            raise ValueError("change_pct must be numeric") from None

        if direction == "up":
            change_pct = abs(change_pct)
        else:
            change_pct = -abs(change_pct)

        raw_window = body.get("window_minutes", cfg["window_minutes"])
        try:
            window_minutes = max(5, int(raw_window))
        except (TypeError, ValueError):
            raise ValueError("window_minutes must be integer >= 5") from None

        triggered_at = datetime.now(tz=timezone.utc)
        event_id = self.db.create_insight_event(
            symbol=symbol,
            direction=direction,
            change_pct=change_pct,
            window_minutes=window_minutes,
            triggered_at=triggered_at,
            status="queued",
        )
        self._queue.put(event_id)
        return {
            "ok": True,
            "event_id": event_id,
            "symbol": symbol,
            "direction": direction,
            "change_pct": change_pct,
            "window_minutes": window_minutes,
            "triggered_at": triggered_at.isoformat(),
            "status": "queued",
        }

    @staticmethod
    def _parse_iso(value: str | None) -> datetime | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            return datetime.fromisoformat(raw).astimezone(timezone.utc)
        except ValueError:
            return None

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            try:
                event_id = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._handle_event(event_id)
            except Exception as exc:  # noqa: BLE001
                self.db.update_insight_event(event_id, status="failed", error=f"{exc}")
            finally:
                self._queue.task_done()

    def _topic_keywords(self, symbol: str, direction: str) -> list[str]:
        base = ["gold price", "黄金价格", "美联储", "央行 黄金 储备", "地缘冲突", "美元指数", "美债收益率"]
        if symbol == "AUCN":
            base.extend(["人民币 黄金", "国内金价"])
        if direction == "up":
            base.extend(["避险 需求 上升", "gold safe haven"])
        else:
            base.extend(["risk-on", "降息预期变化", "美元走强"])
        return base

    def _fetch_google_news_rss(self, query: str, *, max_items: int = 10) -> list[dict]:
        url = (
            "https://news.google.com/rss/search?q="
            + quote_plus(query)
            + "&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
        )
        xml_text = self.client.get_text(url)
        root = ET.fromstring(xml_text)
        rows: list[dict] = []
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            source_node = item.find("source")
            source_name = (source_node.text or "").strip() if source_node is not None else ""
            source_url = source_node.attrib.get("url", "").strip() if source_node is not None else ""
            description = (item.findtext("description") or "").strip()
            rows.append(
                {
                    "title": title,
                    "url": link,
                    "outlet": source_name or _url_domain(link),
                    "published_at": pub,
                    "snippet": description,
                    "source_domain": _url_domain(source_url) or _url_domain(link),
                }
            )
            if len(rows) >= max_items:
                break
        return rows

    def _collect_news(self, *, cfg: dict[str, Any], symbol: str, direction: str) -> NewsPolicyResult:
        keywords = self._topic_keywords(symbol, direction)
        all_items: list[dict] = []
        seen: set[str] = set()

        def append_items(rows: list[dict]) -> None:
            for row in rows:
                key = str(row.get("url") or row.get("title") or "").strip()
                if not key or key in seen:
                    continue
                seen.add(key)
                all_items.append(row)

        if cfg["rss_enabled"]:
            domain_targets = list(cfg["source_whitelist_domains"])
            for domain in domain_targets[:8]:
                for keyword in keywords[:3]:
                    try:
                        append_items(self._fetch_google_news_rss(f'site:{domain} "{keyword}"', max_items=4))
                    except Exception:  # noqa: BLE001
                        continue

            if cfg["source_policy_mode"] == "whitelist_preferred":
                tmp_policy = NewsPolicy(
                    mode="whitelist_preferred",
                    whitelist_domains=list(cfg["source_whitelist_domains"]),
                    min_authoritative_articles=int(cfg["min_authoritative_articles"]),
                )
                tmp_result = tmp_policy.apply(all_items)
                if tmp_result.authoritative_count < int(cfg["min_authoritative_articles"]):
                    for keyword in keywords[:4]:
                        try:
                            append_items(self._fetch_google_news_rss(keyword, max_items=6))
                        except Exception:  # noqa: BLE001
                            continue

        if cfg["news_api_enabled"] and cfg["news_api_base_url"] and cfg["news_api_key"]:
            try:
                append_items(
                    self._fetch_optional_news_api(
                        base_url=cfg["news_api_base_url"],
                        api_key=cfg["news_api_key"],
                        query_param=cfg["news_api_query_param"],
                        query=" OR ".join(keywords[:3]),
                    )
                )
            except Exception:  # noqa: BLE001
                pass

        policy = NewsPolicy(
            mode=cfg["source_policy_mode"],
            whitelist_domains=list(cfg["source_whitelist_domains"]),
            min_authoritative_articles=int(cfg["min_authoritative_articles"]),
        )
        return policy.apply(all_items)

    def _fetch_optional_news_api(self, *, base_url: str, api_key: str, query_param: str, query: str) -> list[dict]:
        url = str(base_url).strip()
        if not url:
            return []
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{query_param}={quote_plus(query)}"
        data = self.client.get_json(url, headers={"Authorization": f"Bearer {self._normalize_api_key(api_key)}"})
        items: list[dict] = []
        if isinstance(data, dict):
            candidates = data.get("articles") or data.get("items") or data.get("data") or []
        elif isinstance(data, list):
            candidates = data
        else:
            candidates = []
        if not isinstance(candidates, list):
            candidates = []
        for row in candidates:
            if not isinstance(row, dict):
                continue
            link = str(row.get("url") or row.get("link") or "").strip()
            title = str(row.get("title") or row.get("name") or "").strip()
            if not link and not title:
                continue
            items.append(
                {
                    "title": title,
                    "url": link,
                    "outlet": str(row.get("source") or row.get("outlet") or _url_domain(link)),
                    "published_at": str(row.get("published_at") or row.get("publishedAt") or row.get("time") or ""),
                    "snippet": str(row.get("description") or row.get("summary") or ""),
                    "source_domain": _url_domain(link),
                }
            )
            if len(items) >= 20:
                break
        return items

    @staticmethod
    def _resolve_api_base(base_url: str) -> str:
        base = str(base_url or "").strip().rstrip("/")
        if not base:
            return ""
        if base.endswith("/chat/completions"):
            return base[: -len("/chat/completions")]
        if base.endswith("/models"):
            return base[: -len("/models")]
        return base

    @classmethod
    def _build_chat_completions_url(cls, base_url: str) -> str:
        base = cls._resolve_api_base(base_url)
        if not base:
            return ""
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"

    @classmethod
    def _build_models_urls(cls, base_url: str) -> list[str]:
        base = cls._resolve_api_base(base_url)
        if not base:
            return []
        urls: list[str] = []
        parsed = urlparse(base)
        path_segments = [segment for segment in str(parsed.path or "").split("/") if segment]
        last_segment = path_segments[-1].lower() if path_segments else ""
        is_version_suffix = bool(re.match(r"^v\d+[a-z0-9._-]*$", last_segment))
        if base.endswith("/v1"):
            urls.append(f"{base}/models")
            root = base[: -len("/v1")]
            if root:
                urls.append(f"{root}/models")
        elif is_version_suffix:
            urls.append(f"{base}/models")
            root = base.rsplit("/", 1)[0]
            if root:
                urls.append(f"{root}/models")
        else:
            urls.append(f"{base}/v1/models")
            urls.append(f"{base}/models")
        unique_urls: list[str] = []
        seen: set[str] = set()
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            unique_urls.append(url)
        return unique_urls

    @staticmethod
    def _extract_http_status(error_text: str) -> int | None:
        match = re.search(r"HTTP Error\s+(\d{3})", str(error_text))
        if match is None:
            return None
        try:
            return int(match.group(1))
        except ValueError:
            return None

    def discover_models(self, payload: dict | None = None) -> dict:
        body = payload or {}
        cfg = self._load_settings()

        base_url = str(body.get("ai_base_url") or cfg.get("ai_base_url") or "").strip()
        api_key_raw = body.get("ai_api_key")
        if api_key_raw is None:
            api_key_raw = cfg.get("ai_api_key", "")
        api_key = self._normalize_api_key(str(api_key_raw or ""))

        if not base_url:
            raise ValueError("ai_base_url is required")
        if not api_key:
            raise ValueError("ai_api_key is required")

        models_urls = self._build_models_urls(base_url)
        if not models_urls:
            raise ValueError("invalid ai_base_url")

        data: Any = None
        used_url = ""
        last_error: SourceError | None = None
        non_404_error: SourceError | None = None
        attempted_errors: list[str] = []
        headers = {"Authorization": f"Bearer {api_key}"}
        for candidate_url in models_urls:
            try:
                data = self.client.get_json(candidate_url, headers=headers)
                used_url = candidate_url
                break
            except SourceError as exc:
                last_error = exc
                message = str(exc)
                attempted_errors.append(f"{candidate_url} => {message}")
                status_code = self._extract_http_status(message)
                if status_code in {404, 405, 501}:
                    continue
                non_404_error = exc
                break

        if used_url == "":
            if non_404_error is not None:
                error_text = str(non_404_error)
                status_code = self._extract_http_status(error_text)
                if status_code in {401, 403}:
                    raise ValueError(
                        "model discovery failed: API Key 鉴权失败（401/403），请检查密钥权限与网关配置"
                    ) from non_404_error
                if attempted_errors:
                    joined = " | ".join(attempted_errors)
                    raise ValueError(f"model discovery failed: {error_text}; attempted={joined}") from non_404_error
                raise ValueError(f"model discovery failed: {error_text}") from non_404_error
            if last_error is not None:
                tried = ", ".join(models_urls)
                if attempted_errors:
                    joined = " | ".join(attempted_errors)
                    raise ValueError(
                        f"model discovery failed after trying [{tried}]: {last_error}; attempted={joined}"
                    ) from last_error
                raise ValueError(f"model discovery failed after trying [{tried}]: {last_error}") from last_error
            raise ValueError("model discovery failed: no response")

        if isinstance(data, dict):
            candidates = data.get("data") or data.get("models") or data.get("items") or []
        elif isinstance(data, list):
            candidates = data
        else:
            candidates = []
        if not isinstance(candidates, list):
            candidates = []

        models: list[str] = []
        seen: set[str] = set()
        for row in candidates:
            model_id = ""
            if isinstance(row, dict):
                model_id = str(row.get("id") or row.get("name") or row.get("model") or "").strip()
            elif isinstance(row, str):
                model_id = row.strip()
            if not model_id or model_id in seen:
                continue
            seen.add(model_id)
            models.append(model_id)

        if not models:
            raise ValueError("no models discovered from provider")

        return {
            "ok": True,
            "endpoint": used_url,
            "attempted_endpoints": models_urls,
            "count": len(models),
            "models": models,
            "current_model": str(cfg.get("ai_model") or ""),
        }

    def _call_ai(
        self,
        *,
        cfg: dict[str, Any],
        symbol: str,
        direction: str,
        change_pct: float,
        window_minutes: int,
        evidence: list[dict],
    ) -> dict:
        prompt = build_analysis_prompt(
            symbol=symbol,
            direction=direction,
            change_pct=change_pct,
            window_minutes=window_minutes,
            evidence=evidence,
            strategy_instructions=self._strategy_instructions(cfg),
        )
        if not cfg["ai_enabled"] or not cfg["ai_base_url"] or not cfg["ai_api_key"]:
            raise RuntimeError("ai provider not configured")

        url = self._build_chat_completions_url(str(cfg["ai_base_url"]))
        if not url:
            raise RuntimeError("invalid ai base url")

        payload = {
            "model": cfg["ai_model"],
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "你是金价异动归因助手，只允许使用提供证据分析并输出JSON。",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        }
        response = self.client.post_json(
            url,
            payload,
            headers={"Authorization": f"Bearer {self._normalize_api_key(cfg['ai_api_key'])}"},
        )
        if not isinstance(response, dict):
            raise RuntimeError("ai response is not json")

        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise RuntimeError("ai response missing choices")
        first = choices[0]
        if not isinstance(first, dict):
            raise RuntimeError("ai response invalid choice")
        message = first.get("message") if isinstance(first.get("message"), dict) else {}
        content = str(message.get("content") or "").strip()
        if not content:
            raise RuntimeError("ai response empty content")

        parsed: dict[str, Any] | None = None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                candidate = content[start : end + 1]
                try:
                    parsed = json.loads(candidate)
                except json.JSONDecodeError:
                    parsed = None
        if not isinstance(parsed, dict):
            raise RuntimeError("ai response content is not valid json object")
        return parsed

    def _default_result(
        self,
        *,
        symbol: str,
        direction: str,
        change_pct: float,
        window_minutes: int,
        evidence: list[dict],
        reason: str,
    ) -> dict:
        direction_text = "上涨" if direction == "up" else "下跌"
        return {
            "summary": f"{symbol} 在 {window_minutes} 分钟内{direction_text} {change_pct:.2f}%，当前仅能给出保守解释：{reason}。",
            "upside_drivers": [],
            "downside_drivers": [],
            "primary_causes_ranked": ["证据不足"],
            "risks_and_counter_evidence": ["证据不足，需等待更多权威媒体报道"],
            "confidence": 0.25,
            "confidence_reason": reason,
            "evidence": evidence,
        }

    def _handle_event(self, event_id: int) -> None:
        event = self.db.get_insight_event(event_id)
        if not event:
            return
        self.db.update_insight_event(event_id, status="running", error="")
        cfg = self._load_settings()

        symbol = str(event["symbol"])
        direction = str(event["direction"])
        change_pct = float(event["change_pct"])
        window_minutes = int(event["window_minutes"])

        news_result = self._collect_news(cfg=cfg, symbol=symbol, direction=direction)
        evidence = news_result.items[:20]
        authoritative_count = int(news_result.authoritative_count)
        supplemental_count = int(news_result.supplemental_count)

        if cfg["source_policy_mode"] == "whitelist_only" and news_result.insufficient_authoritative:
            result = self._default_result(
                symbol=symbol,
                direction=direction,
                change_pct=change_pct,
                window_minutes=window_minutes,
                evidence=evidence,
                reason="白名单权威新闻不足",
            )
            self.db.update_insight_event(
                event_id,
                status="insufficient",
                authoritative_count=authoritative_count,
                supplemental_count=supplemental_count,
                confidence=float(result.get("confidence", 0.25)),
                confidence_reason=str(result.get("confidence_reason", "证据不足")),
                summary=str(result.get("summary", "")),
                result_json=json.dumps(result, ensure_ascii=False),
                error="",
            )
            if cfg["insight_notify_enabled"]:
                self.notifier.send_insight_report(
                    symbol=symbol,
                    direction=direction,
                    change_pct=change_pct,
                    window_minutes=window_minutes,
                    summary=str(result.get("summary", "")),
                    authoritative_count=authoritative_count,
                    supplemental_count=supplemental_count,
                    confidence=float(result.get("confidence", 0.25)),
                )
            return

        try:
            result = self._call_ai(
                cfg=cfg,
                symbol=symbol,
                direction=direction,
                change_pct=change_pct,
                window_minutes=window_minutes,
                evidence=evidence,
            )
            if not isinstance(result.get("evidence"), list):
                result["evidence"] = evidence
            if "confidence_reason" not in result:
                result["confidence_reason"] = (
                    "权威媒体数量有限，且部分观点存在差异。" if news_result.insufficient_authoritative else "多家媒体存在共识。"
                )
        except Exception as exc:  # noqa: BLE001
            result = self._default_result(
                symbol=symbol,
                direction=direction,
                change_pct=change_pct,
                window_minutes=window_minutes,
                evidence=evidence,
                reason=f"AI分析失败：{exc}",
            )

        confidence = float(result.get("confidence", 0.3))
        confidence = max(0.0, min(1.0, confidence))
        summary = str(result.get("summary") or "")
        confidence_reason = str(result.get("confidence_reason") or "证据不足")

        self.db.update_insight_event(
            event_id,
            status="completed",
            authoritative_count=authoritative_count,
            supplemental_count=supplemental_count,
            confidence=confidence,
            confidence_reason=confidence_reason,
            summary=summary,
            result_json=json.dumps(result, ensure_ascii=False),
            error="",
        )

        if cfg["insight_notify_enabled"]:
            self.notifier.send_insight_report(
                symbol=symbol,
                direction=direction,
                change_pct=change_pct,
                window_minutes=window_minutes,
                summary=summary,
                authoritative_count=authoritative_count,
                supplemental_count=supplemental_count,
                confidence=confidence,
            )

    def list_events(
        self,
        *,
        limit: int = 20,
        symbol: str | None = None,
        direction: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[dict]:
        return self.db.list_insight_events(
            limit=limit,
            symbol=symbol,
            direction=direction,
            start_at=start_at,
            end_at=end_at,
        )

    def get_event(self, event_id: int) -> dict | None:
        event = self.db.get_insight_event(event_id)
        if event is None:
            return None
        result = event.get("result")
        if isinstance(result, dict):
            if "evidence" not in event and isinstance(result.get("evidence"), list):
                event["evidence"] = result.get("evidence")
            else:
                event["evidence"] = result.get("evidence", [])
            if not event.get("confidence_reason"):
                event["confidence_reason"] = result.get("confidence_reason")
        else:
            event["evidence"] = []
        event["authoritative_count"] = int(event.get("authoritative_count") or 0)
        event["supplemental_count"] = int(event.get("supplemental_count") or 0)
        return event
