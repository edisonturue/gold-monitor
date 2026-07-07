from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from app.db import Database
from app.indicators import compute_indicator_series, trend_label
from app.models import AlertRule, RuleClause
from app.rules import RuleEngine
from app.utils import parse_range_to_timedelta


class BacktestService:
    def __init__(self, db: Database) -> None:
        self.db = db

    @staticmethod
    def _parse_ts(value: str) -> datetime:
        raw = str(value or "")
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        return datetime.fromisoformat(raw)

    @staticmethod
    def _rule_from_payload(payload: dict[str, Any]) -> AlertRule:
        symbol = str(payload.get("symbol") or "XAUUSD").strip().upper()
        condition = str(payload.get("condition") or "gte").strip().lower()
        if condition not in {"gte", "lte"}:
            raise ValueError("condition must be gte or lte")
        try:
            threshold = float(payload.get("threshold"))
        except (TypeError, ValueError):
            raise ValueError("threshold must be numeric") from None

        logic_operator = str(payload.get("logic_operator") or "and").strip().lower()
        if logic_operator not in {"and", "or"}:
            logic_operator = "and"

        clauses_raw = payload.get("clauses")
        clauses: list[RuleClause | dict[str, Any]] = []
        if isinstance(clauses_raw, list) and clauses_raw:
            clauses = [dict(item or {}) for item in clauses_raw]

        if not clauses:
            clauses = [{"type": "price", "condition": condition, "threshold": threshold}]
            indicator_filter = str(payload.get("indicator_filter") or "any").strip().lower()
            mapping = {"bullish_only": "bullish", "bearish_only": "bearish", "neutral_only": "neutral"}
            if indicator_filter in mapping:
                clauses.append({"type": "indicator_bias", "bias": mapping[indicator_filter]})

        return AlertRule(
            id=None,
            symbol=symbol,
            condition=condition,
            threshold=threshold,
            cooldown_sec=max(1, int(payload.get("cooldown_sec", 900))),
            debounce_count=max(1, int(payload.get("debounce_count", 2))),
            enabled=bool(payload.get("enabled", True)),
            indicator_filter=payload.get("indicator_filter", "any"),
            logic_operator=logic_operator,
            clauses=clauses,
        )

    @staticmethod
    def _avg(values: list[float | None]) -> float | None:
        valid = [value for value in values if value is not None]
        if not valid:
            return None
        return sum(valid) / len(valid)

    @staticmethod
    def _direction_hint(rule: AlertRule) -> str:
        clauses = list(rule.clauses or [])
        for clause in clauses:
            if isinstance(clause, dict):
                clause_type = str(clause.get("type") or "").strip().lower()
                condition = str(clause.get("condition") or "").strip().lower()
            else:
                clause_type = str(getattr(clause, "type", "") or "").strip().lower()
                condition = str(getattr(clause, "condition", "") or "").strip().lower()
            if clause_type != "price":
                continue
            if condition == "lte":
                return "short"
            return "long"
        return "long" if rule.condition == "gte" else "short"

    @staticmethod
    def _normalize_range(value: object | None) -> str:
        range_str = str(value or "12m").strip().lower()
        if range_str not in {"1m", "3m", "6m", "12m"}:
            raise ValueError("range must be one of 1m/3m/6m/12m")
        return range_str

    @staticmethod
    def _format_clause(rule: AlertRule) -> str:
        clauses = list(rule.clauses or [])
        if not clauses:
            clauses = [RuleClause(type="price", condition=rule.condition, threshold=rule.threshold)]
        parts: list[str] = []
        for item in clauses:
            if isinstance(item, dict):
                clause = RuleClause(
                    type=str(item.get("type") or ""),
                    condition=item.get("condition"),
                    threshold=item.get("threshold"),
                    bias=item.get("bias"),
                    status=item.get("status"),
                    max_age_sec=item.get("max_age_sec"),
                )
            else:
                clause = item

            kind = str(clause.type or "").strip().lower()
            if kind == "price":
                symbol = "≥" if str(clause.condition or "").strip().lower() == "gte" else "≤"
                value = float(clause.threshold or 0.0)
                parts.append(f"price {symbol} {value:.2f}")
                continue
            if kind == "indicator_bias":
                parts.append(f"bias = {str(clause.bias or 'any').strip().lower()}")
                continue
            if kind == "freshness":
                status = str(clause.status or "any").strip().lower()
                if clause.max_age_sec is None:
                    parts.append(f"freshness = {status}")
                else:
                    parts.append(f"freshness = {status}, age <= {int(clause.max_age_sec)}s")
                continue
            parts.append(kind or "unknown")
        joiner = " OR " if str(rule.logic_operator or "and").strip().lower() == "or" else " AND "
        return joiner.join(parts)

    def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        rule_id = payload.get("rule_id")
        draft_rule = payload.get("draft_rule")
        if rule_id in {None, ""} and not isinstance(draft_rule, dict):
            raise ValueError("rule_id or draft_rule is required")

        if rule_id not in {None, ""}:
            try:
                rule = self.db.get_rule(int(rule_id))
            except (TypeError, ValueError):
                raise ValueError("rule_id must be integer") from None
            if rule is None:
                raise ValueError("rule not found")
        else:
            rule = self._rule_from_payload(draft_rule)

        symbol = str(payload.get("symbol") or rule.symbol).strip().upper()
        range_str = self._normalize_range(payload.get("range"))

        end = datetime.now(tz=timezone.utc)
        start = end - parse_range_to_timedelta(range_str)
        bars = self.db.get_bars(symbol=symbol, timeframe="1d", start=start, end=end)
        if not bars:
            return {
                "rule": asdict(rule),
                "symbol": symbol,
                "range": range_str,
                "summary": {
                    "triggered_count": 0,
                    "recovered_count": 0,
                    "sample_bars": 0,
                    "sample_start": None,
                    "sample_end": None,
                    "forward_1d_avg_pct": None,
                    "forward_5d_avg_pct": None,
                    "max_adverse_pct": None,
                    "net_return_pct": 0.0,
                    "max_drawdown_pct": 0.0,
                    "benchmark_return_pct": 0.0,
                    "benchmark_max_drawdown_pct": 0.0,
                    "alpha_return_pct": 0.0,
                },
                "trades": [],
                "equity_curve": [],
                "benchmark_curve": [],
            }

        closes = [float(item["close"]) for item in bars]
        indicators = compute_indicator_series(closes)
        biases: list[str] = []
        for idx in range(len(bars)):
            label, _reasons, _confidence = trend_label(
                indicators.ma5[idx],
                indicators.ma20[idx],
                indicators.ma60[idx],
                indicators.hist[idx],
                indicators.rsi14[idx],
            )
            biases.append(label)

        direction_hint = self._direction_hint(rule)
        direction_sign = -1.0 if direction_hint == "short" else 1.0
        state_status = "idle"
        consecutive_hits = 0
        last_alert_at: datetime | None = None
        open_trade: dict[str, Any] | None = None
        trades: list[dict[str, Any]] = []
        in_position = False
        equity = 100.0
        peak_equity = 100.0
        max_drawdown_raw = 0.0
        equity_curve: list[dict[str, Any]] = []
        benchmark_equity = 100.0
        benchmark_peak_equity = 100.0
        benchmark_max_drawdown_raw = 0.0
        benchmark_curve: list[dict[str, Any]] = []

        for idx, bar in enumerate(bars):
            bar_dt = self._parse_ts(str(bar["ts"]))
            price = float(bar["close"])
            bias = biases[idx] if idx < len(biases) else "neutral"
            if idx > 0:
                prev_close = float(bars[idx - 1]["close"])
                benchmark_daily_return_pct = ((price - prev_close) / prev_close) * 100 if prev_close else 0.0
            else:
                benchmark_daily_return_pct = 0.0
            benchmark_equity *= 1 + (benchmark_daily_return_pct / 100.0)
            benchmark_peak_equity = max(benchmark_peak_equity, benchmark_equity)
            benchmark_drawdown_pct = ((benchmark_equity - benchmark_peak_equity) / benchmark_peak_equity) * 100 if benchmark_peak_equity else 0.0
            if benchmark_drawdown_pct < benchmark_max_drawdown_raw:
                benchmark_max_drawdown_raw = benchmark_drawdown_pct
            benchmark_curve.append(
                {
                    "ts": str(bar["ts"]),
                    "equity": benchmark_equity,
                    "daily_return_pct": benchmark_daily_return_pct,
                }
            )
            if idx > 0 and in_position:
                prev_close = float(bars[idx - 1]["close"])
                day_return_pct = ((price - prev_close) / prev_close) * 100 if prev_close else 0.0
                strategy_return_pct = day_return_pct * direction_sign
            else:
                strategy_return_pct = 0.0
            equity *= 1 + (strategy_return_pct / 100.0)
            peak_equity = max(peak_equity, equity)
            drawdown_pct = ((equity - peak_equity) / peak_equity) * 100 if peak_equity else 0.0
            if drawdown_pct < max_drawdown_raw:
                max_drawdown_raw = drawdown_pct
            equity_curve.append(
                {
                    "ts": str(bar["ts"]),
                    "equity": equity,
                    "daily_return_pct": strategy_return_pct,
                    "position": direction_hint if in_position else "flat",
                }
            )

            met = RuleEngine.rule_condition_met(
                rule,
                price=price,
                forecast_bias=bias,
                freshness_status="live",
                age_sec=0,
            )

            if not met:
                if state_status == "triggered" and open_trade is not None:
                    open_trade["recover_time"] = str(bar["ts"])
                    open_trade["recover_price"] = price
                    open_trade["closed"] = True
                    open_trade = None
                    in_position = False
                consecutive_hits = 0
                state_status = "idle"
                continue

            consecutive_hits += 1
            cooldown_ok = True
            if last_alert_at is not None:
                cooldown_ok = (bar_dt - last_alert_at).total_seconds() >= max(1, int(rule.cooldown_sec))

            should_trigger = (
                state_status != "triggered"
                and consecutive_hits >= max(1, int(rule.debounce_count))
                and cooldown_ok
            )

            if should_trigger:
                last_alert_at = bar_dt
                state_status = "triggered"
                entry_price = price
                day1 = ((closes[idx + 1] - entry_price) / entry_price) * 100 if idx + 1 < len(closes) else None
                day5 = ((closes[idx + 5] - entry_price) / entry_price) * 100 if idx + 5 < len(closes) else None
                window = closes[idx + 1 : min(len(closes), idx + 6)]
                if direction_hint == "short":
                    adverse = max([((value - entry_price) / entry_price) * 100 for value in window], default=0.0)
                else:
                    adverse = min([((value - entry_price) / entry_price) * 100 for value in window], default=0.0)
                open_trade = {
                    "trigger_time": str(bar["ts"]),
                    "trigger_price": entry_price,
                    "direction": direction_hint,
                    "forward_1d_pct": day1,
                    "forward_5d_pct": day5,
                    "max_adverse_pct": adverse,
                    "recover_time": None,
                    "recover_price": None,
                    "closed": False,
                }
                trades.append(open_trade)
                in_position = True
                continue

            if state_status != "triggered":
                state_status = "pending"

        triggered_count = len(trades)
        recovered_count = len([trade for trade in trades if trade.get("closed")])
        forward_1d_avg = self._avg([trade.get("forward_1d_pct") for trade in trades])
        forward_5d_avg = self._avg([trade.get("forward_5d_pct") for trade in trades])
        adverse_values = [abs(float(trade.get("max_adverse_pct") or 0.0)) for trade in trades]
        max_adverse = max(adverse_values) if adverse_values else None
        net_return_pct = ((equity / 100.0) - 1.0) * 100.0
        benchmark_return_pct = ((benchmark_equity / 100.0) - 1.0) * 100.0
        alpha_return_pct = net_return_pct - benchmark_return_pct

        return {
            "rule": asdict(rule),
            "symbol": symbol,
            "range": range_str,
            "summary": {
                "triggered_count": triggered_count,
                "recovered_count": recovered_count,
                "sample_bars": len(bars),
                "sample_start": bars[0]["ts"],
                "sample_end": bars[-1]["ts"],
                "forward_1d_avg_pct": forward_1d_avg,
                "forward_5d_avg_pct": forward_5d_avg,
                "max_adverse_pct": max_adverse,
                "net_return_pct": net_return_pct,
                "max_drawdown_pct": abs(max_drawdown_raw),
                "benchmark_return_pct": benchmark_return_pct,
                "benchmark_max_drawdown_pct": abs(benchmark_max_drawdown_raw),
                "alpha_return_pct": alpha_return_pct,
            },
            "trades": trades,
            "equity_curve": equity_curve,
            "benchmark_curve": benchmark_curve,
        }

    def compare(self, payload: dict[str, Any]) -> dict[str, Any]:
        range_str = self._normalize_range(payload.get("range"))
        raw_ids = payload.get("rule_ids")
        if raw_ids in (None, ""):
            selected_rules = [rule for rule in self.db.list_rules() if bool(rule.enabled)]
        else:
            if not isinstance(raw_ids, list) or not raw_ids:
                raise ValueError("rule_ids must be a non-empty list of integers")
            selected_rules = []
            seen: set[int] = set()
            for item in raw_ids:
                try:
                    rule_id = int(item)
                except (TypeError, ValueError):
                    raise ValueError("rule_ids must be a non-empty list of integers") from None
                if rule_id in seen:
                    continue
                seen.add(rule_id)
                rule = self.db.get_rule(rule_id)
                if rule is None:
                    raise ValueError(f"rule not found: {rule_id}")
                selected_rules.append(rule)

        rows: list[dict[str, Any]] = []
        for rule in selected_rules:
            result = self.run({"rule_id": rule.id, "symbol": rule.symbol, "range": range_str})
            summary = dict(result.get("summary") or {})
            rows.append(
                {
                    "rule_id": rule.id,
                    "symbol": rule.symbol,
                    "enabled": bool(rule.enabled),
                    "logic_operator": str(rule.logic_operator or "and").strip().lower(),
                    "clause_expression": self._format_clause(rule),
                    "triggered_count": summary.get("triggered_count"),
                    "recovered_count": summary.get("recovered_count"),
                    "sample_bars": summary.get("sample_bars"),
                    "forward_1d_avg_pct": summary.get("forward_1d_avg_pct"),
                    "forward_5d_avg_pct": summary.get("forward_5d_avg_pct"),
                    "max_adverse_pct": summary.get("max_adverse_pct"),
                    "net_return_pct": summary.get("net_return_pct"),
                    "max_drawdown_pct": summary.get("max_drawdown_pct"),
                    "benchmark_return_pct": summary.get("benchmark_return_pct"),
                    "benchmark_max_drawdown_pct": summary.get("benchmark_max_drawdown_pct"),
                    "alpha_return_pct": summary.get("alpha_return_pct"),
                }
            )

        return {"range": range_str, "rows": rows}
