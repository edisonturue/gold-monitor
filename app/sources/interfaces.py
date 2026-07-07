from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.models import PriceBar, PriceTick


class SourceAdapter(Protocol):
    name: str
    symbol: str
    market: str

    def fetch_realtime(self) -> PriceTick:
        ...

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        ...
