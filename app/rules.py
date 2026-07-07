from __future__ import annotations

from datetime import datetime

from app.db import Database
from app.models import AlertRule, PriceTick
from app.notifier import Notifier


class RuleEngine:
    def __init__(self, db: Database, notifier: Notifier) -> None:
        self.db = db
        self.notifier = notifier

    @staticmethod
    def _price_condition_met(condition: str, threshold: float, price: float) -> bool:
        if condition == "gte":
            return price >= threshold
        return price <= threshold

    @staticmethod
    def _indicator_filter_ok(indicator_filter: str | None, forecast_bias: str | None) -> bool:
        if not indicator_filter or str(indicator_filter).strip().lower() == "any":
            return True
        if forecast_bias is None:
            return False
        normalized = str(indicator_filter).strip().lower()
        if normalized == "bullish_only":
            return forecast_bias == "bullish"
        if normalized == "bearish_only":
            return forecast_bias == "bearish"
        if normalized == "neutral_only":
            return forecast_bias == "neutral"
        return True

    @staticmethod
    def _parse_time(value: str | None) -> datetime | None:
        if not value:
            return None
        return datetime.fromisoformat(value)

    @staticmethod
    def _clause_field(clause: object, field: str) -> object:
        if isinstance(clause, dict):
            return clause.get(field)
        return getattr(clause, field, None)

    @classmethod
    def _clause_met(
        cls,
        clause: object,
        *,
        price: float,
        forecast_bias: str | None,
        freshness_status: str | None,
        age_sec: int | None,
    ) -> bool:
        clause_type = str(cls._clause_field(clause, "type") or "").strip().lower()
        if clause_type == "price":
            condition = str(cls._clause_field(clause, "condition") or "").strip().lower()
            threshold_raw = cls._clause_field(clause, "threshold")
            try:
                threshold = float(threshold_raw)
            except (TypeError, ValueError):
                return False
            if condition not in {"gte", "lte"}:
                return False
            return cls._price_condition_met(condition, threshold, price)

        if clause_type == "indicator_bias":
            expected_bias = str(cls._clause_field(clause, "bias") or "").strip().lower()
            if expected_bias not in {"bullish", "bearish", "neutral"}:
                return False
            return str(forecast_bias or "").strip().lower() == expected_bias

        if clause_type == "freshness":
            expected_status = str(cls._clause_field(clause, "status") or "").strip().lower()
            max_age_raw = cls._clause_field(clause, "max_age_sec")
            status_ok = True
            if expected_status:
                status_ok = str(freshness_status or "").strip().lower() == expected_status
            age_ok = True
            if max_age_raw not in {None, ""}:
                try:
                    max_age = max(0, int(max_age_raw))
                except (TypeError, ValueError):
                    return False
                age_ok = age_sec is not None and int(age_sec) <= max_age
            return status_ok and age_ok

        return False

    @classmethod
    def rule_condition_met(
        cls,
        rule: AlertRule,
        *,
        price: float,
        forecast_bias: str | None,
        freshness_status: str | None,
        age_sec: int | None,
    ) -> bool:
        clauses = list(rule.clauses or [])
        if not clauses:
            clauses = [{"type": "price", "condition": rule.condition, "threshold": rule.threshold}]
            if rule.indicator_filter and str(rule.indicator_filter).strip().lower() != "any":
                mapping = {
                    "bullish_only": "bullish",
                    "bearish_only": "bearish",
                    "neutral_only": "neutral",
                }
                mapped = mapping.get(str(rule.indicator_filter).strip().lower())
                if mapped:
                    clauses.append({"type": "indicator_bias", "bias": mapped})

        results = [
            cls._clause_met(
                clause,
                price=price,
                forecast_bias=forecast_bias,
                freshness_status=freshness_status,
                age_sec=age_sec,
            )
            for clause in clauses
        ]
        logic_operator = str(rule.logic_operator or "and").strip().lower()
        if logic_operator == "or":
            return any(results)
        return all(results)

    def evaluate_tick(
        self,
        tick: PriceTick,
        forecast_bias: str | None = None,
        freshness_status: str | None = "live",
        age_sec: int | None = None,
    ) -> None:
        rules = [rule for rule in self.db.list_rules() if rule.enabled and rule.symbol == tick.symbol]
        for rule in rules:
            self._evaluate_rule(rule, tick, forecast_bias, freshness_status, age_sec)

    def _evaluate_rule(
        self,
        rule: AlertRule,
        tick: PriceTick,
        forecast_bias: str | None,
        freshness_status: str | None,
        age_sec: int | None,
    ) -> None:
        state = self.db.get_rule_state(rule.id or 0)
        consecutive_hits = int(state.get("consecutive_hits", 0))
        status = state.get("status", "idle")
        last_alert_at = self._parse_time(state.get("last_alert_at"))

        filter_ok = self._indicator_filter_ok(rule.indicator_filter, forecast_bias)
        clause_ok = self.rule_condition_met(
            rule,
            price=float(tick.price),
            forecast_bias=forecast_bias,
            freshness_status=freshness_status,
            age_sec=age_sec,
        )
        condition_met = filter_ok and clause_ok

        if not condition_met:
            if status == "triggered":
                self.notifier.send_recovered(rule, tick)
                self.db.insert_alert_event(rule.id or 0, "recovered", tick.price, tick.timestamp)
            self.db.update_rule_state(
                rule.id or 0,
                consecutive_hits=0,
                status="idle",
                last_alert_at=last_alert_at,
                last_hit_at=tick.timestamp,
            )
            return

        consecutive_hits += 1
        cooldown_ok = True
        if last_alert_at is not None:
            elapsed = (tick.timestamp - last_alert_at).total_seconds()
            cooldown_ok = elapsed >= rule.cooldown_sec

        should_trigger = status != "triggered" and consecutive_hits >= max(1, rule.debounce_count) and cooldown_ok

        if should_trigger:
            self.notifier.send_triggered(rule, tick)
            self.db.insert_alert_event(rule.id or 0, "triggered", tick.price, tick.timestamp)
            self.db.update_rule_state(
                rule.id or 0,
                consecutive_hits=consecutive_hits,
                status="triggered",
                last_alert_at=tick.timestamp,
                last_hit_at=tick.timestamp,
            )
            return

        next_status = status if status == "triggered" else "pending"
        self.db.update_rule_state(
            rule.id or 0,
            consecutive_hits=consecutive_hits,
            status=next_status,
            last_alert_at=last_alert_at,
            last_hit_at=tick.timestamp,
        )
