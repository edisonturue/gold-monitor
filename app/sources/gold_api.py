from __future__ import annotations

from datetime import datetime, timezone

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError
from app.sources.coingecko import CoinGeckoGoldProxyAdapter


class GoldApiAdapter:
    """
    Free realtime gold source.
    History falls back to CoinGecko proxy bars.
    """

    def __init__(self, client: HttpClient | None = None, history_adapter: CoinGeckoGoldProxyAdapter | None = None) -> None:
        self.name = "gold_api_xau"
        self.symbol = "XAUUSD"
        self.market = "international"
        self.currency = "USD"
        self.unit = "oz"
        self.client = client or HttpClient()
        self.history_adapter = history_adapter or CoinGeckoGoldProxyAdapter(token_id="pax-gold")

    def fetch_realtime(self) -> PriceTick:
        payload = self.client.get_json("https://api.gold-api.com/price/XAU")
        if payload.get("symbol") != "XAU":
            raise SourceError(f"gold-api returned unexpected symbol payload: {payload}")
        if "price" not in payload:
            raise SourceError("gold-api payload missing price field")

        ts_raw = str(payload.get("updatedAt") or "").strip()
        if ts_raw.endswith("Z"):
            ts_raw = ts_raw[:-1] + "+00:00"
        timestamp = datetime.now(tz=timezone.utc)
        if ts_raw:
            try:
                timestamp = datetime.fromisoformat(ts_raw).astimezone(timezone.utc)
            except ValueError:
                pass

        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=float(payload["price"]),
            currency=self.currency,
            unit=self.unit,
            timestamp=timestamp,
            source=self.name,
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        bars = self.history_adapter.fetch_history(start, end, interval)
        for bar in bars:
            bar.source = f"{self.name}_history_proxy"
        return bars
