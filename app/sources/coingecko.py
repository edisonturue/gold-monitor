from __future__ import annotations

from datetime import datetime, timezone
from math import ceil

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError


class CoinGeckoGoldProxyAdapter:
    """
    Free fallback adapter using tokenized gold spot proxies:
    - pax-gold (PAXG)
    - tether-gold (XAUT)
    """

    def __init__(self, token_id: str = "pax-gold", client: HttpClient | None = None) -> None:
        if token_id not in {"pax-gold", "tether-gold"}:
            raise ValueError("token_id must be pax-gold or tether-gold")
        self.token_id = token_id
        self.name = f"coingecko_{token_id}"
        self.symbol = "XAUUSD"
        self.market = "international"
        self.currency = "USD"
        self.unit = "oz"
        self.client = client or HttpClient()

    def fetch_realtime(self) -> PriceTick:
        payload = self.client.get_json(
            f"https://api.coingecko.com/api/v3/simple/price?ids={self.token_id}&vs_currencies=usd"
        )
        if self.token_id not in payload or "usd" not in payload[self.token_id]:
            raise SourceError(f"CoinGecko realtime payload missing {self.token_id}.usd")
        price = float(payload[self.token_id]["usd"])
        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=price,
            currency=self.currency,
            unit=self.unit,
            timestamp=datetime.now(tz=timezone.utc),
            source=self.name,
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        if interval != "1d":
            raise SourceError("CoinGeckoGoldProxyAdapter supports daily history only")

        days = max(1, ceil((end - start).total_seconds() / 86400))
        payload = self.client.get_json(
            f"https://api.coingecko.com/api/v3/coins/{self.token_id}/market_chart?vs_currency=usd&days={days}&interval=daily"
        )
        price_points = payload.get("prices") or []
        if not price_points:
            raise SourceError("CoinGecko history payload missing prices")

        bars: list[PriceBar] = []
        prev_close: float | None = None
        for point in price_points:
            if not isinstance(point, list) or len(point) < 2:
                continue
            epoch_ms = point[0]
            close = float(point[1])
            ts = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
            if ts < start or ts > end:
                continue

            open_price = prev_close if prev_close is not None else close
            high = max(open_price, close)
            low = min(open_price, close)
            bars.append(
                PriceBar(
                    symbol=self.symbol,
                    market=self.market,
                    timeframe="1d",
                    timestamp=ts,
                    open=open_price,
                    high=high,
                    low=low,
                    close=close,
                    volume=None,
                    source=self.name,
                )
            )
            prev_close = close

        if not bars:
            raise SourceError("CoinGecko history has no usable bars in requested range")
        return bars
