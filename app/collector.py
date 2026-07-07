from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timedelta, timezone

from app.analysis import AnalysisService
from app.config import Settings
from app.db import Database
from app.models import PriceBar, PriceTick
from app.notifier import Notifier
from app.rules import RuleEngine
from app.sources.base import SourceError
from app.sources.interfaces import SourceAdapter


class PriceCollector:
    _SOURCE_EXPECTED_UPDATE_SEC: dict[str, int] = {
        "gold_api_xau": 10,
        "coingecko_pax-gold": 45,
        "coingecko_tether-gold": 45,
        "stooq_xauusd": 60,
        "yahoo_gc_futures": 60,
        "yahoo_usdcny": 60,
        "open_er_usdcny": 86400,
        "domestic_reference_primary": 30,
        "domestic_reference_backup": 30,
    }

    def __init__(
        self,
        *,
        db: Database,
        settings: Settings,
        notifier: Notifier,
        rule_engine: RuleEngine,
        analysis: AnalysisService,
        symbol_sources: dict[str, list[SourceAdapter]],
        insight_engine: object | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.notifier = notifier
        self.rule_engine = rule_engine
        self.analysis = analysis
        self.symbol_sources = symbol_sources
        self.insight_engine = insight_engine

        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._backfill_thread: threading.Thread | None = None
        self._symbol_up: dict[str, bool] = {}
        self._failure_counts: dict[str, int] = {}
        self._last_heartbeat_key: str | None = None
        self._run_lock = threading.Lock()
        self._last_collect_summary: dict | None = None

    @staticmethod
    def _parse_iso_timestamp(value: str | None) -> datetime | None:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            return datetime.fromisoformat(raw).astimezone(timezone.utc)
        except ValueError:
            return None

    def _source_expected_update_map(self) -> dict[str, int]:
        merged = {key: int(value) for key, value in self._SOURCE_EXPECTED_UPDATE_SEC.items()}
        raw = self.db.get_setting("source_expected_update_sec_map")
        if not raw:
            return merged
        try:
            payload = json.loads(raw)
        except Exception:  # noqa: BLE001
            return merged
        if not isinstance(payload, dict):
            return merged
        for key, value in payload.items():
            source_name = str(key).strip()
            if source_name not in merged:
                continue
            try:
                merged[source_name] = max(5, int(value))
            except (TypeError, ValueError):
                continue
        return merged

    @staticmethod
    def _source_parts(source_name: str | None) -> list[str]:
        if not source_name:
            return []
        normalized = str(source_name).replace(" (cached_fallback)", "").strip()
        if not normalized:
            return []
        parts: list[str] = []
        for section in normalized.split(":"):
            for token in section.split("+"):
                value = token.strip()
                if value:
                    parts.append(value)
        return parts

    def _expected_update_sec(self, symbol: str, source_name: str | None, source_expected_map: dict[str, int]) -> int:
        symbol_defaults = {"XAUUSD": 30, "AUCN": 30, "USDCNY": 3600}
        fallback = int(symbol_defaults.get(symbol, max(15, int(self.settings.poll_interval_sec) * 2)))
        parts = self._source_parts(source_name)
        if not parts:
            return fallback
        expected: list[int] = []
        for part in parts:
            value = source_expected_map.get(part)
            if value is not None:
                expected.append(int(value))
            elif part.startswith("coingecko_"):
                expected.append(45)
            elif part.startswith("yahoo_"):
                expected.append(60)
            elif part.startswith("open_er_"):
                expected.append(86400)
        if not expected:
            return fallback
        return max(5, min(expected))

    def _fallback_latest_tick(self, symbol: str, now: datetime, error_text: str | None) -> PriceTick | None:
        latest = self.db.get_latest_tick(symbol)
        if not latest:
            return None

        ts = self._parse_iso_timestamp(latest.get("ts"))
        if ts is None:
            return None

        age_sec = (now - ts).total_seconds()
        if age_sec > max(1, int(self.settings.stale_fallback_max_age_sec)):
            return None

        try:
            price = float(latest["price"])
        except (TypeError, ValueError):
            return None

        source = str(latest.get("source") or "unknown")
        if "cached_fallback" not in source:
            source = f"{source} (cached_fallback)"
        if error_text:
            print(f"[Collector] {symbol} using cached fallback ({int(age_sec)}s old): {error_text}")

        return PriceTick(
            symbol=str(latest.get("symbol") or symbol),
            market=str(latest.get("market") or ""),
            price=price,
            currency=str(latest.get("currency") or ""),
            unit=str(latest.get("unit") or ""),
            timestamp=ts,
            source=source,
        )

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True, name="collector")
        self._thread.start()
        # Backfill can be slow on cold start; run in background so HTTP server is ready sooner.
        self._backfill_thread = threading.Thread(target=self._safe_backfill_history, daemon=True, name="collector-backfill")
        self._backfill_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        if self._backfill_thread and self._backfill_thread.is_alive():
            self._backfill_thread.join(timeout=3)

    def _loop(self) -> None:
        while not self._stop.is_set():
            started = time.monotonic()
            self.run_once()
            elapsed = time.monotonic() - started
            delay = max(1, self.settings.poll_interval_sec - elapsed)
            self._stop.wait(delay)

    def _safe_backfill_history(self) -> None:
        try:
            self.backfill_history()
        except Exception as exc:  # noqa: BLE001
            print(f"[Collector] background backfill failed: {exc}")

    def backfill_history(self) -> None:
        end = datetime.now(tz=timezone.utc)
        start = end - timedelta(days=self.settings.initial_backfill_days)

        for symbol, adapters in self.symbol_sources.items():
            bars = self._fetch_history_with_failover(symbol, adapters, start, end, "1d")
            if bars:
                self.db.upsert_many_bars(bars)

    def _fetch_history_with_failover(
        self,
        symbol: str,
        adapters: list[SourceAdapter],
        start: datetime,
        end: datetime,
        interval: str,
    ) -> list[PriceBar]:
        last_error: str | None = None
        for adapter in adapters:
            try:
                bars = adapter.fetch_history(start=start, end=end, interval=interval)
                if bars:
                    self.db.update_source_status(adapter.name, symbol, "up", datetime.now(tz=timezone.utc), None)
                    return bars
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                self.db.update_source_status(adapter.name, symbol, "down", None, last_error)

        if last_error:
            print(f"[Collector] history backfill failed for {symbol}: {last_error}")
        return []

    def run_once(self) -> dict:
        with self._run_lock:
            summary = self._run_once_locked()
            self._last_collect_summary = summary
            return summary

    def collect_once(self) -> dict:
        return self.run_once()

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive() and not self._stop.is_set())

    def _run_once_locked(self) -> dict:
        collected_at = datetime.now(tz=timezone.utc)
        summary: dict = {
            "ok": True,
            "collected_at": collected_at.isoformat(),
            "symbols": {},
            "updated": [],
        }
        latest_tick_times: dict[str, datetime] = {}
        source_expected_map = self._source_expected_update_map()

        for symbol, adapters in self.symbol_sources.items():
            tick, source_name, err = self._fetch_tick_with_failover(symbol, adapters)
            if tick is None:
                fallback_tick = self._fallback_latest_tick(symbol, collected_at, err)
                summary["ok"] = False
                if fallback_tick is not None:
                    summary["symbols"][symbol] = {
                        "status": "stale",
                        "error": err or "all data sources failed",
                        "source": fallback_tick.source,
                        "timestamp": fallback_tick.timestamp.isoformat(),
                        "price": fallback_tick.price,
                    }
                else:
                    summary["symbols"][symbol] = {
                        "status": "down",
                        "error": err or "unknown error",
                    }
                self._failure_counts[symbol] = self._failure_counts.get(symbol, 0) + 1
                if self._failure_counts[symbol] < 3:
                    continue
                was_up = self._symbol_up.get(symbol, True)
                if was_up:
                    self.notifier.send_source_down(symbol, err or "unknown error")
                self._symbol_up[symbol] = False
                continue
            self._failure_counts[symbol] = 0

            self.db.insert_tick(tick)
            self.db.merge_tick_into_daily_bar(tick)
            latest_tick_times[symbol] = tick.timestamp
            summary["symbols"][symbol] = {
                "status": "up",
                "source": source_name,
                "timestamp": tick.timestamp.isoformat(),
                "price": tick.price,
            }
            summary["updated"].append(symbol)

            if not self._symbol_up.get(symbol, False):
                self.notifier.send_source_recovered(symbol, source_name)
            self._symbol_up[symbol] = True

            forecast_bias = None
            if symbol in {"XAUUSD", "AUCN"}:
                forecast = self.analysis.forecast_signal(symbol=symbol, timeframe="1d", range_str="12m")
                forecast_bias = forecast.bias
            age_sec = max(0, int((collected_at - tick.timestamp.astimezone(timezone.utc)).total_seconds()))
            expected_update_sec = self._expected_update_sec(symbol, tick.source, source_expected_map)
            if "cached_fallback" in str(tick.source):
                freshness_status = "cached"
            elif age_sec <= expected_update_sec:
                freshness_status = "live"
            else:
                freshness_status = "delayed"
            self.rule_engine.evaluate_tick(
                tick,
                forecast_bias=forecast_bias,
                freshness_status=freshness_status,
                age_sec=age_sec,
            )
            if self.insight_engine is not None and hasattr(self.insight_engine, "evaluate_tick"):
                try:
                    self.insight_engine.evaluate_tick(tick)  # type: ignore[attr-defined]
                except Exception as exc:  # noqa: BLE001
                    print(f"[Collector] insight evaluate failed for {symbol}: {exc}")

        self._maybe_send_heartbeat(latest_tick_times)
        return summary

    def _fetch_tick_with_failover(self, symbol: str, adapters: list[SourceAdapter]) -> tuple[PriceTick | None, str, str | None]:
        errors: list[str] = []

        for adapter in adapters:
            try:
                tick = adapter.fetch_realtime()
                self.db.update_source_status(adapter.name, symbol, "up", tick.timestamp, None)
                return tick, adapter.name, None
            except Exception as exc:  # noqa: BLE001
                error_text = str(exc)
                one_line = " ".join(error_text.split())
                if len(one_line) > 180:
                    one_line = f"{one_line[:177]}..."
                errors.append(f"{adapter.name}: {one_line}")
                self.db.update_source_status(adapter.name, symbol, "down", None, error_text)

        if not errors:
            return None, "", "all data sources failed"
        summary = " | ".join(errors[:2])
        if len(errors) > 2:
            summary = f"{summary} | 其余{len(errors) - 2}个源失败"
        return None, "", summary

    def _maybe_send_heartbeat(self, latest_tick_times: dict[str, datetime]) -> None:
        if not latest_tick_times:
            return
        now = datetime.now(tz=timezone.utc)
        # Send a concise heartbeat every 6 hours.
        hour_slot = (now.hour // 6) * 6
        key = f"{now.date().isoformat()}-{hour_slot}"
        if key == self._last_heartbeat_key:
            return

        self._last_heartbeat_key = key
        self.notifier.send_heartbeat(latest_tick_times)
