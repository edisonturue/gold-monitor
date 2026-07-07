from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def utc_now() -> datetime:
    return datetime.now(tz=ZoneInfo("UTC"))


def parse_range_to_timedelta(range_str: str) -> timedelta:
    normalized = (range_str or "12m").strip().lower()
    if normalized.endswith("m"):
        try:
            months = int(normalized[:-1])
            return timedelta(days=months * 30)
        except ValueError:
            return timedelta(days=360)
    if normalized.endswith("d"):
        try:
            days = int(normalized[:-1])
            return timedelta(days=days)
        except ValueError:
            return timedelta(days=360)
    return timedelta(days=360)


def to_iso_day(dt: datetime, tz: ZoneInfo) -> str:
    return dt.astimezone(tz).strftime("%Y-%m-%d")


def from_iso(text: str) -> datetime:
    return datetime.fromisoformat(text)
