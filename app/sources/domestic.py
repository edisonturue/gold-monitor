from __future__ import annotations

from datetime import datetime

from app.config import settings
from app.models import PriceBar, PriceTick
from app.sources.base import SourceError
from app.sources.interfaces import SourceAdapter

OZ_TO_GRAM = 31.1034768


class DomesticReferenceAdapter:
    def __init__(self, gold_sources: list[SourceAdapter], fx_sources: list[SourceAdapter], name: str = "domestic_reference") -> None:
        if not gold_sources:
            raise ValueError("gold_sources cannot be empty")
        if not fx_sources:
            raise ValueError("fx_sources cannot be empty")
        self.gold_sources = gold_sources
        self.fx_sources = fx_sources
        self.name = name
        self.symbol = "AUCN"
        self.market = "domestic"
        self.currency = "CNY"
        self.unit = "g"

    def _first_success_tick(self, adapters: list[SourceAdapter]) -> PriceTick:
        errors: list[str] = []
        for adapter in adapters:
            try:
                return adapter.fetch_realtime()
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{adapter.name}: {exc}")
        raise SourceError("all adapters failed: " + " | ".join(errors))

    def _first_success_history(self, adapters: list[SourceAdapter], start: datetime, end: datetime, interval: str) -> list[PriceBar]:
        errors: list[str] = []
        for adapter in adapters:
            try:
                bars = adapter.fetch_history(start, end, interval)
                if bars:
                    return bars
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{adapter.name}: {exc}")
        raise SourceError("all adapters history failed: " + " | ".join(errors))

    def fetch_realtime(self) -> PriceTick:
        gold_tick = self._first_success_tick(self.gold_sources)
        fx_tick = self._first_success_tick(self.fx_sources)
        cny_per_gram = (gold_tick.price * fx_tick.price) / OZ_TO_GRAM + settings.domestic_premium_cny_per_g
        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=round(cny_per_gram, 4),
            currency=self.currency,
            unit=self.unit,
            timestamp=max(gold_tick.timestamp, fx_tick.timestamp),
            source=f"{self.name}:{gold_tick.source}+{fx_tick.source}",
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        gold_bars = self._first_success_history(self.gold_sources, start, end, interval)
        fx_bars = self._first_success_history(self.fx_sources, start, end, interval)

        fx_by_day = {bar.timestamp.date().isoformat(): bar.close for bar in fx_bars}
        known_days = sorted(fx_by_day.keys())
        if not known_days:
            raise SourceError("fx history is empty")

        latest_rate = fx_by_day[known_days[-1]]
        output: list[PriceBar] = []
        for bar in gold_bars:
            day_key = bar.timestamp.date().isoformat()
            fx_close = fx_by_day.get(day_key, latest_rate)
            latest_rate = fx_close

            output.append(
                PriceBar(
                    symbol=self.symbol,
                    market=self.market,
                    timeframe=interval,
                    timestamp=bar.timestamp,
                    open=(bar.open * fx_close) / OZ_TO_GRAM + settings.domestic_premium_cny_per_g,
                    high=(bar.high * fx_close) / OZ_TO_GRAM + settings.domestic_premium_cny_per_g,
                    low=(bar.low * fx_close) / OZ_TO_GRAM + settings.domestic_premium_cny_per_g,
                    close=(bar.close * fx_close) / OZ_TO_GRAM + settings.domestic_premium_cny_per_g,
                    volume=None,
                    source=self.name,
                )
            )

        return output
