from __future__ import annotations

from datetime import datetime

from app.config import Settings
from app.models import AlertRule, PriceTick
from app.sources.base import HttpClient, SourceError


SYMBOL_LABEL = {
    "XAUUSD": "国际现货金",
    "AUCN": "国内基准金",
    "USDCNY": "美元兑人民币",
}

WECOM_ERRCODE_HINTS = {
    93000: "Webhook 地址无效，请检查 key 是否完整且未包含空格。",
    93004: "消息被关键词策略拦截，请在群机器人安全设置里添加关键词，或让测试消息包含关键词。",
    93005: "消息被 IP 白名单策略拦截，请在企业微信机器人里放行当前出口 IP。",
    93008: "发送频率过高，请稍后重试。",
}


class Notifier:
    def __init__(self, settings: Settings, client: HttpClient | None = None) -> None:
        self.settings = settings
        self.client = client or HttpClient(timeout=settings.request_timeout_sec)

    @staticmethod
    def _response_error_text(response: dict | str | None, *, strict: bool = False) -> str:
        if isinstance(response, dict):
            errcode = response.get("errcode")
            errmsg = str(response.get("errmsg") or "").strip()
            if errcode is None:
                if strict:
                    snippet = str(response)[:240]
                    return f"企业微信返回非标准响应: {snippet}"
                return ""
            try:
                numeric = int(errcode)
            except (TypeError, ValueError):
                numeric = -1
            if numeric == 0:
                return ""
            hint = WECOM_ERRCODE_HINTS.get(numeric)
            if errmsg:
                if hint:
                    return f"企业微信返回错误 errcode={numeric} errmsg={errmsg}；排查建议：{hint}"
                return f"企业微信返回错误 errcode={numeric} errmsg={errmsg}"
            if hint:
                return f"企业微信返回错误 errcode={numeric}；排查建议：{hint}"
            return f"企业微信返回错误 errcode={numeric}"
        if isinstance(response, str) and response.strip():
            # WeCom normally returns JSON. Non-JSON response is treated as unexpected.
            if strict:
                return f"企业微信返回非预期响应: {response[:240]}"
            return ""
        if strict:
            return "企业微信返回空响应"
        return "企业微信返回空响应"

    def _send(self, content: str, *, strict: bool = False) -> dict | str | None:
        if not self.settings.wecom_webhook_url:
            if strict:
                raise ValueError("未配置企业微信 Webhook URL")
            if self.settings.enable_console_notifications:
                print(f"[Notifier] {content}")
            return None

        payload = {
            "msgtype": "markdown",
            "markdown": {"content": content},
        }
        try:
            response = self.client.post_json(self.settings.wecom_webhook_url, payload)
        except SourceError as exc:
            if strict:
                raise ValueError(f"推送请求失败: {exc}") from exc
            if self.settings.enable_console_notifications:
                print(f"[Notifier] webhook send failed: {exc}")
            return None

        response_error = self._response_error_text(response, strict=strict)
        if response_error:
            if strict:
                raise ValueError(response_error)
            if self.settings.enable_console_notifications:
                print(f"[Notifier] webhook send rejected: {response_error}")
            return response
        return response

    @property
    def _is_compact(self) -> bool:
        return str(self.settings.notify_style).strip().lower() == "compact"

    def _title(self, raw_title: str) -> str:
        prefix = str(self.settings.notify_title_prefix or "").strip()
        if prefix:
            return f"{prefix} · {raw_title}"
        return raw_title

    def send_triggered(self, rule: AlertRule, tick: PriceTick) -> None:
        if not self.settings.notify_on_trigger:
            return
        if self._is_compact:
            message = (
                f"## {self._title('阈值触发')}\n"
                f"> {SYMBOL_LABEL.get(rule.symbol, rule.symbol)} 现价 `{tick.price:.2f}`，触发 `{rule.condition} {rule.threshold}`\n"
                f"> 时间: `{tick.timestamp.isoformat()}`"
            )
        else:
            message = (
                f"## {self._title('金价阈值触发')}\n"
                f"> 规则ID: `{rule.id}`\n"
                f"> 标的: `{SYMBOL_LABEL.get(rule.symbol, rule.symbol)}`\n"
                f"> 条件: `{rule.condition} {rule.threshold}`\n"
                f"> 现价: `{tick.price:.4f} {tick.currency}/{tick.unit}`\n"
                f"> 时间: `{tick.timestamp.isoformat()}`\n"
                f"> 来源: `{tick.source}`"
            )
        self._send(message)

    def send_recovered(self, rule: AlertRule, tick: PriceTick) -> None:
        if not self.settings.notify_on_recover:
            return
        if self._is_compact:
            message = (
                f"## {self._title('恢复通知')}\n"
                f"> {SYMBOL_LABEL.get(rule.symbol, rule.symbol)} 已离开阈值区间，现价 `{tick.price:.2f}`\n"
                f"> 时间: `{tick.timestamp.isoformat()}`"
            )
        else:
            message = (
                f"## {self._title('金价恢复通知')}\n"
                f"> 规则ID: `{rule.id}`\n"
                f"> 标的: `{SYMBOL_LABEL.get(rule.symbol, rule.symbol)}`\n"
                f"> 当前价格已回到条件外: `{tick.price:.4f} {tick.currency}/{tick.unit}`\n"
                f"> 时间: `{tick.timestamp.isoformat()}`"
            )
        self._send(message)

    def send_source_down(self, symbol: str, error_text: str) -> None:
        if not self.settings.notify_on_source:
            return
        message = (
            f"## {self._title('数据源异常')}\n"
            f"> 标的: `{SYMBOL_LABEL.get(symbol, symbol)}`\n"
            f"> 错误: `{error_text}`\n"
            "> 系统将继续在下个轮询周期重试。"
        )
        self._send(message)

    def send_source_recovered(self, symbol: str, source_name: str) -> None:
        if not self.settings.notify_on_source:
            return
        message = (
            f"## {self._title('数据源恢复')}\n"
            f"> 标的: `{SYMBOL_LABEL.get(symbol, symbol)}`\n"
            f"> 当前数据源: `{source_name}`"
        )
        self._send(message)

    def send_heartbeat(self, latest_tick_times: dict[str, datetime]) -> None:
        if not self.settings.notify_on_heartbeat:
            return
        lines = [f"## {self._title('金价监控心跳')}"]
        for symbol, dt in sorted(latest_tick_times.items()):
            lines.append(f"> {symbol}: `{dt.isoformat()}`")
        self._send("\n".join(lines))

    def send_test_message(self) -> dict | str | None:
        return self._send(
            "## 配置测试成功\n"
            "> 企业微信推送配置已生效。\n"
            f"> 时间: `{datetime.now().isoformat(timespec='seconds')}`",
            strict=True,
        )

    def send_insight_report(
        self,
        *,
        symbol: str,
        direction: str,
        change_pct: float,
        window_minutes: int,
        summary: str,
        authoritative_count: int,
        supplemental_count: int,
        confidence: float,
    ) -> None:
        direction_text = "上涨" if direction == "up" else "下跌"
        message = (
            f"## {self._title('AI异动归因')}\n"
            f"> 标的: `{SYMBOL_LABEL.get(symbol, symbol)}`\n"
            f"> 事件: `{window_minutes}分钟内{direction_text} {change_pct:.2f}%`\n"
            f"> 证据: `Tier1 {authoritative_count} 条 / Tier2 {supplemental_count} 条`\n"
            f"> 置信度: `{max(0.0, min(1.0, confidence)):.2f}`\n"
            f"> 结论: {summary or '证据不足'}"
        )
        self._send(message)
