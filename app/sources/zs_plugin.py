from __future__ import annotations

from datetime import datetime

from app.models import PriceBar, PriceTick


class ZSAccumulatedGoldAdapter:
    """
    Placeholder for Phase 2.

    Integrate Zheshang Bank accumulated gold endpoint here when a verified API sample is available.
    """

    name = "zs_bank_accumulated_gold"
    symbol = "ZS_ACC_GOLD"
    market = "domestic"

    def fetch_realtime(self) -> PriceTick:
        raise NotImplementedError("ZSAccumulatedGoldAdapter is reserved for phase-2 plugin integration.")

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        raise NotImplementedError("ZSAccumulatedGoldAdapter is reserved for phase-2 plugin integration.")
