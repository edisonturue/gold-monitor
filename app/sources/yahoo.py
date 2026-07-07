from __future__ import annotations

from datetime import datetime, timezone

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError


class YahooChartAdapter:
    def __init__(self, *, name: str, ticker: str, symbol: str, market: str, currency: str, unit: str, client: HttpClient | None = None) -> None:
        self.name = name
        self.ticker = ticker
        self.symbol = symbol
        self.market = market
        self.currency = currency
        self.unit = unit
        self.client = client or HttpClient()

    def fetch_realtime(self) -> PriceTick:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{self.ticker}?range=1d&interval=1m"
        payload = self.client.get_json(url)
        result = payload.get("chart", {}).get("result")
        if not result:
            raise SourceError(f"Yahoo realtime payload missing result for {self.ticker}")

        data = result[0]
        timestamps = data.get("timestamp") or []
        quote = data.get("indicators", {}).get("quote", [{}])[0]
        closes = quote.get("close") or []

        for idx in range(len(closes) - 1, -1, -1):
            price = closes[idx]
            if price is None:
                continue
            epoch = timestamps[idx]
            return PriceTick(
                symbol=self.symbol,
                market=self.market,
                price=float(price),
                currency=self.currency,
                unit=self.unit,
                timestamp=datetime.fromtimestamp(epoch, tz=timezone.utc),
                source=self.name,
            )

        raise SourceError(f"Yahoo realtime close not found for {self.ticker}")

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        start_epoch = int(start.timestamp())
        end_epoch = int(end.timestamp())
        url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/{self.ticker}"
            f"?period1={start_epoch}&period2={end_epoch}&interval={interval}&events=div%2Csplits"
        )
        payload = self.client.get_json(url)
        result = payload.get("chart", {}).get("result")
        if not result:
            raise SourceError(f"Yahoo history payload missing result for {self.ticker}")

        data = result[0]
        timestamps = data.get("timestamp") or []
        quote = data.get("indicators", {}).get("quote", [{}])[0]
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []

        bars: list[PriceBar] = []
        for idx, epoch in enumerate(timestamps):
            try:
                o = opens[idx]
                h = highs[idx]
                l = lows[idx]
                c = closes[idx]
            except IndexError:
                continue
            if None in (o, h, l, c):
                continue
            volume = None
            if idx < len(volumes) and volumes[idx] is not None:
                volume = float(volumes[idx])

            bars.append(
                PriceBar(
                    symbol=self.symbol,
                    market=self.market,
                    timeframe=interval,
                    timestamp=datetime.fromtimestamp(epoch, tz=timezone.utc),
                    open=float(o),
                    high=float(h),
                    low=float(l),
                    close=float(c),
                    volume=volume,
                    source=self.name,
                )
            )
        return bars
