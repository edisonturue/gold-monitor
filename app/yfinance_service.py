from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Iterable


class YFinanceService:
    # Reference: yfinance docs / README.
    VALID_PERIODS = {
        "1d",
        "5d",
        "1mo",
        "3mo",
        "6mo",
        "1y",
        "2y",
        "5y",
        "10y",
        "ytd",
        "max",
    }
    VALID_INTERVALS = {
        "1m",
        "2m",
        "5m",
        "15m",
        "30m",
        "60m",
        "90m",
        "1h",
        "1d",
        "5d",
        "1wk",
        "1mo",
        "3mo",
    }
    DEFAULT_PERIOD = "6mo"
    DEFAULT_INTERVAL = "1d"
    _TICKER_RE = re.compile(r"^[A-Za-z0-9=^._-]{1,24}$")

    @classmethod
    def normalize_ticker(cls, value: str | None) -> str:
        ticker = str(value or "").strip().upper()
        if not ticker:
            raise ValueError("ticker is required")
        if not cls._TICKER_RE.match(ticker):
            raise ValueError("ticker format is invalid")
        return ticker

    @classmethod
    def normalize_period(cls, value: str | None) -> str:
        candidate = str(value or cls.DEFAULT_PERIOD).strip().lower()
        if candidate in cls.VALID_PERIODS:
            return candidate
        return cls.DEFAULT_PERIOD

    @classmethod
    def normalize_interval(cls, value: str | None) -> str:
        candidate = str(value or cls.DEFAULT_INTERVAL).strip().lower()
        if candidate in cls.VALID_INTERVALS:
            return candidate
        return cls.DEFAULT_INTERVAL

    @staticmethod
    def _import_yfinance() -> Any:
        try:
            import yfinance as yf  # type: ignore

            return yf
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("yfinance package is not installed") from exc

    @staticmethod
    def _safe_get(factory, default: Any = None) -> Any:
        try:
            return factory()
        except Exception:  # noqa: BLE001
            return default

    @staticmethod
    def _to_mapping(payload: Any) -> dict[str, Any]:
        if isinstance(payload, dict):
            return payload
        try:
            return dict(payload or {})
        except Exception:  # noqa: BLE001
            return {}

    @staticmethod
    def _to_float(value: Any) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number != number:  # NaN
            return None
        return number

    @staticmethod
    def _to_int(value: Any) -> int | None:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_iso(value: Any) -> str:
        dt: datetime | None = None
        if isinstance(value, datetime):
            dt = value
        else:
            to_dt = getattr(value, "to_pydatetime", None)
            if callable(to_dt):
                try:
                    raw = to_dt()
                    if isinstance(raw, datetime):
                        dt = raw
                except Exception:  # noqa: BLE001
                    dt = None

        if dt is None:
            return ""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

    @staticmethod
    def _iter_history_rows(history: Any) -> Iterable[tuple[Any, Any]]:
        iterrows = getattr(history, "iterrows", None)
        if callable(iterrows):
            try:
                yield from iterrows()
            except Exception:  # noqa: BLE001
                return
            return

        if isinstance(history, list):
            for row in history:
                if not isinstance(row, dict):
                    continue
                ts = row.get("ts")
                if ts is None:
                    continue
                yield ts, row

    def _history_to_bars(self, history: Any, interval: str) -> list[dict[str, Any]]:
        bars: list[dict[str, Any]] = []
        for idx, row in self._iter_history_rows(history):
            get_value = row.get if hasattr(row, "get") else None
            if not callable(get_value):
                continue
            open_value = self._to_float(get_value("Open"))
            high_value = self._to_float(get_value("High"))
            low_value = self._to_float(get_value("Low"))
            close_value = self._to_float(get_value("Close"))
            if None in {open_value, high_value, low_value, close_value}:
                continue
            bars.append(
                {
                    "ts": self._to_iso(idx),
                    "open": open_value,
                    "high": high_value,
                    "low": low_value,
                    "close": close_value,
                    "volume": self._to_float(get_value("Volume")),
                    "interval": interval,
                }
            )
        return [row for row in bars if row["ts"]]

    def _extract_news(self, raw_items: Any) -> list[dict[str, str]]:
        if not isinstance(raw_items, list):
            return []
        output: list[dict[str, str]] = []
        for item in raw_items[:10]:
            if not isinstance(item, dict):
                continue

            content = item.get("content")
            content_map = content if isinstance(content, dict) else item

            canonical = content_map.get("canonicalUrl")
            canonical_map = canonical if isinstance(canonical, dict) else {}
            provider = content_map.get("provider")
            provider_map = provider if isinstance(provider, dict) else {}

            title = str(content_map.get("title") or item.get("title") or "").strip()
            url = str(canonical_map.get("url") or content_map.get("link") or item.get("link") or "").strip()
            publisher = str(
                content_map.get("publisher")
                or provider_map.get("displayName")
                or provider_map.get("name")
                or item.get("publisher")
                or ""
            ).strip()
            summary = str(content_map.get("summary") or item.get("summary") or "").strip()

            published_raw = content_map.get("pubDate") or content_map.get("providerPublishTime") or item.get("providerPublishTime")
            published_at = ""
            if isinstance(published_raw, (int, float)):
                published_at = datetime.fromtimestamp(int(published_raw), tz=timezone.utc).isoformat()
            elif isinstance(published_raw, str):
                published_at = published_raw.strip()

            if not title:
                continue
            output.append(
                {
                    "title": title,
                    "url": url,
                    "publisher": publisher,
                    "published_at": published_at,
                    "summary": summary,
                }
            )
        return output

    def get_overview(self, *, ticker: str, period: str = DEFAULT_PERIOD, interval: str = DEFAULT_INTERVAL, prepost: bool = False) -> dict[str, Any]:
        normalized_ticker = self.normalize_ticker(ticker)
        normalized_period = self.normalize_period(period)
        normalized_interval = self.normalize_interval(interval)

        yf = self._import_yfinance()
        ticker_obj = yf.Ticker(normalized_ticker)
        try:
            history = ticker_obj.history(
                period=normalized_period,
                interval=normalized_interval,
                auto_adjust=False,
                prepost=bool(prepost),
            )
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"failed to fetch yfinance history for {normalized_ticker}: {exc}") from exc

        bars = self._history_to_bars(history, normalized_interval)
        if not bars:
            raise ValueError(f"no data returned for ticker={normalized_ticker}")

        fast_info = self._to_mapping(self._safe_get(lambda: ticker_obj.fast_info, {}))
        info = self._to_mapping(self._safe_get(lambda: ticker_obj.info, {}))
        metadata = self._to_mapping(self._safe_get(lambda: getattr(ticker_obj, "history_metadata", {}), {}))
        news = self._extract_news(self._safe_get(lambda: getattr(ticker_obj, "news", []), []))

        latest = bars[-1]
        previous_close = bars[-2]["close"] if len(bars) >= 2 else None
        if previous_close is None:
            previous_close = self._to_float(fast_info.get("previousClose")) or self._to_float(info.get("previousClose"))

        price_now = latest["close"]
        change = None
        change_pct = None
        if previous_close not in {None, 0}:
            change = price_now - float(previous_close)
            change_pct = (change / float(previous_close)) * 100

        quote = {
            "ticker": normalized_ticker,
            "short_name": str(info.get("shortName") or info.get("longName") or "").strip(),
            "exchange": str(info.get("exchange") or metadata.get("exchangeName") or fast_info.get("exchange") or "").strip(),
            "currency": str(fast_info.get("currency") or info.get("currency") or "").strip(),
            "timezone": str(metadata.get("timezone") or "").strip(),
            "price": price_now,
            "open": latest.get("open"),
            "high": latest.get("high"),
            "low": latest.get("low"),
            "volume": self._to_int(latest.get("volume")),
            "previous_close": previous_close,
            "change": change,
            "change_pct": change_pct,
            "market_cap": self._to_int(fast_info.get("marketCap") or info.get("marketCap")),
            "fifty_two_week_high": self._to_float(fast_info.get("fiftyTwoWeekHigh") or info.get("fiftyTwoWeekHigh")),
            "fifty_two_week_low": self._to_float(fast_info.get("fiftyTwoWeekLow") or info.get("fiftyTwoWeekLow")),
            "as_of": str(latest.get("ts") or ""),
        }

        return {
            "ticker": normalized_ticker,
            "period": normalized_period,
            "interval": normalized_interval,
            "prepost": bool(prepost),
            "quote": quote,
            "bars": bars,
            "news": news,
            "meta": {
                "source": "yfinance",
                "docs_hint": "https://github.com/ranaroussi/yfinance",
                "legal_note": "Yahoo! finance data is intended for personal use only.",
            },
        }
