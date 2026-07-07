from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class RuleClause:
    type: str
    condition: str | None = None
    threshold: float | None = None
    bias: str | None = None
    status: str | None = None
    max_age_sec: int | None = None


@dataclass(slots=True)
class PriceTick:
    symbol: str
    market: str
    price: float
    currency: str
    unit: str
    timestamp: datetime
    source: str


@dataclass(slots=True)
class PriceBar:
    symbol: str
    market: str
    timeframe: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
    source: str = ""


@dataclass(slots=True)
class IndicatorSnapshot:
    symbol: str
    timeframe: str
    timestamp: datetime
    ma5: float | None
    ma20: float | None
    ma60: float | None
    rsi14: float | None
    macd: float | None
    signal: float | None
    hist: float | None
    trend_label: str


@dataclass(slots=True)
class ForecastSignal:
    symbol: str
    timeframe: str
    bias: str
    confidence: float
    reasons: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AlertRule:
    id: int | None
    symbol: str
    condition: str
    threshold: float
    cooldown_sec: int = 900
    debounce_count: int = 2
    enabled: bool = True
    indicator_filter: str | None = None
    logic_operator: str = "and"
    clauses: list[RuleClause | dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class AlertEvent:
    id: int | None
    rule_id: int
    status: str
    hit_price: float
    hit_time: datetime
    message_id: str | None = None


@dataclass(slots=True)
class SourceStatus:
    source_name: str
    symbol: str
    status: str
    last_success_at: datetime | None
    last_error: str | None


def as_serializable(data: Any) -> Any:
    if isinstance(data, datetime):
        return data.isoformat()
    if isinstance(data, list):
        return [as_serializable(item) for item in data]
    if isinstance(data, dict):
        return {k: as_serializable(v) for k, v in data.items()}
    if is_dataclass(data):
        return as_serializable(asdict(data))
    return data
