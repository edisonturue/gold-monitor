from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError
from app.sources.yahoo import YahooChartAdapter


class YahooFxAdapter(YahooChartAdapter):
    def __init__(self, client: HttpClient | None = None) -> None:
        super().__init__(
            name="yahoo_usdcny",
            ticker="CNY=X",
            symbol="USDCNY",
            market="fx",
            currency="CNY",
            unit="rate",
            client=client,
        )


class OpenExchangeFxAdapter:
    def __init__(self, client: HttpClient | None = None) -> None:
        self.name = "open_er_usdcny"
        self.symbol = "USDCNY"
        self.market = "fx"
        self.currency = "CNY"
        self.unit = "rate"
        self.client = client or HttpClient()

    def fetch_realtime(self) -> PriceTick:
        payload = self.client.get_json("https://open.er-api.com/v6/latest/USD")
        if payload.get("result") != "success":
            raise SourceError(f"open.er-api error payload: {payload}")

        rates = payload.get("rates", {})
        cny = rates.get("CNY")
        if cny is None:
            raise SourceError("open.er-api missing CNY rate")

        updated = payload.get("time_last_update_unix")
        timestamp = datetime.now(tz=timezone.utc) if updated is None else datetime.fromtimestamp(updated, tz=timezone.utc)
        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=float(cny),
            currency=self.currency,
            unit=self.unit,
            timestamp=timestamp,
            source=self.name,
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        tick = self.fetch_realtime()
        bars: list[PriceBar] = []
        cursor = start
        while cursor <= end:
            bars.append(
                PriceBar(
                    symbol=self.symbol,
                    market=self.market,
                    timeframe=interval,
                    timestamp=cursor,
                    open=tick.price,
                    high=tick.price,
                    low=tick.price,
                    close=tick.price,
                    volume=None,
                    source=self.name,
                )
            )
            cursor += timedelta(days=1)
        return bars
