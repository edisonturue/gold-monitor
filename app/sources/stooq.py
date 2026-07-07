from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO

from app.models import PriceBar, PriceTick
from app.sources.base import HttpClient, SourceError


class StooqGoldAdapter:
    def __init__(self, client: HttpClient | None = None) -> None:
        self.name = "stooq_xauusd"
        self.symbol = "XAUUSD"
        self.market = "international"
        self.currency = "USD"
        self.unit = "oz"
        self.client = client or HttpClient()

    def fetch_realtime(self) -> PriceTick:
        text = self.client.get_text("https://stooq.com/q/l/?s=xauusd&i=1")
        rows = list(csv.DictReader(StringIO(text)))
        if not rows:
            raise SourceError("Stooq realtime returned empty CSV")
        row = rows[0]
        close_text = row.get("Close")
        date_text = row.get("Date")
        time_text = row.get("Time", "00:00:00")
        if close_text in (None, "N/D"):
            raise SourceError("Stooq realtime close unavailable")
        dt = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return PriceTick(
            symbol=self.symbol,
            market=self.market,
            price=float(close_text),
            currency=self.currency,
            unit=self.unit,
            timestamp=dt,
            source=self.name,
        )

    def fetch_history(self, start: datetime, end: datetime, interval: str = "1d") -> list[PriceBar]:
        text = self.client.get_text("https://stooq.com/q/d/l/?s=xauusd&i=d")
        rows = list(csv.DictReader(StringIO(text)))
        if not rows:
            raise SourceError("Stooq history returned empty CSV")

        start_date = start.date()
        end_date = end.date()
        bars: list[PriceBar] = []
        for row in rows:
            date_text = row.get("Date")
            if not date_text:
                continue
            dt = datetime.strptime(date_text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if dt.date() < start_date or dt.date() > end_date:
                continue
            values = (row.get("Open"), row.get("High"), row.get("Low"), row.get("Close"))
            if any(value in (None, "N/D") for value in values):
                continue
            volume = row.get("Volume")
            vol = None if volume in (None, "", "N/D") else float(volume)
            bars.append(
                PriceBar(
                    symbol=self.symbol,
                    market=self.market,
                    timeframe=interval,
                    timestamp=dt,
                    open=float(values[0]),
                    high=float(values[1]),
                    low=float(values[2]),
                    close=float(values[3]),
                    volume=vol,
                    source=self.name,
                )
            )
        return bars
