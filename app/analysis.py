from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db import Database
from app.indicators import compute_indicator_series, trend_label
from app.models import ForecastSignal
from app.utils import parse_range_to_timedelta


class AnalysisService:
    def __init__(self, db: Database) -> None:
        self.db = db

    def get_kline(self, symbol: str, timeframe: str = "1d", range_str: str = "12m") -> list[dict]:
        end = datetime.now(tz=timezone.utc)
        start = end - parse_range_to_timedelta(range_str)
        return self.db.get_bars(symbol=symbol, timeframe=timeframe, start=start, end=end)

    def get_indicator_payload(self, symbol: str, timeframe: str = "1d", range_str: str = "12m") -> dict:
        bars = self.get_kline(symbol=symbol, timeframe=timeframe, range_str=range_str)
        closes = [float(bar["close"]) for bar in bars]

        if not bars:
            return {
                "symbol": symbol,
                "timeframe": timeframe,
                "series": {
                    "ma5": [],
                    "ma20": [],
                    "ma60": [],
                    "rsi14": [],
                    "macd": [],
                    "signal": [],
                    "hist": [],
                },
                "latest": None,
            }

        indicator = compute_indicator_series(closes)
        latest_index = len(bars) - 1
        label, reasons, confidence = trend_label(
            indicator.ma5[latest_index],
            indicator.ma20[latest_index],
            indicator.ma60[latest_index],
            indicator.hist[latest_index],
            indicator.rsi14[latest_index],
        )

        latest = {
            "timestamp": bars[latest_index]["ts"],
            "ma5": indicator.ma5[latest_index],
            "ma20": indicator.ma20[latest_index],
            "ma60": indicator.ma60[latest_index],
            "rsi14": indicator.rsi14[latest_index],
            "macd": indicator.macd[latest_index],
            "signal": indicator.signal[latest_index],
            "hist": indicator.hist[latest_index],
            "trend_label": label,
            "confidence": confidence,
            "reasons": reasons,
        }

        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "series": {
                "ma5": indicator.ma5,
                "ma20": indicator.ma20,
                "ma60": indicator.ma60,
                "rsi14": indicator.rsi14,
                "macd": indicator.macd,
                "signal": indicator.signal,
                "hist": indicator.hist,
            },
            "latest": latest,
        }

    def forecast_signal(self, symbol: str, timeframe: str = "1d", range_str: str = "12m") -> ForecastSignal:
        payload = self.get_indicator_payload(symbol=symbol, timeframe=timeframe, range_str=range_str)
        latest = payload.get("latest")

        if not latest:
            return ForecastSignal(
                symbol=symbol,
                timeframe=timeframe,
                bias="neutral",
                confidence=0.35,
                reasons=["历史数据不足，暂不输出趋势判断"],
            )

        return ForecastSignal(
            symbol=symbol,
            timeframe=timeframe,
            bias=latest["trend_label"],
            confidence=float(latest["confidence"]),
            reasons=list(latest["reasons"]),
        )

    def spread_payload(self) -> dict:
        intl = self.db.get_latest_tick("XAUUSD")
        domestic = self.db.get_latest_tick("AUCN")
        fx = self.db.get_latest_tick("USDCNY")

        if not intl or not domestic or not fx:
            return {
                "available": False,
                "reason": "latest tick missing",
            }

        theoretical_domestic = float(intl["price"]) * float(fx["price"]) / 31.1034768
        spread = float(domestic["price"]) - theoretical_domestic
        spread_rate = (spread / theoretical_domestic) * 100 if theoretical_domestic else 0.0

        return {
            "available": True,
            "intl_price_usd_oz": float(intl["price"]),
            "domestic_price_cny_g": float(domestic["price"]),
            "fx_usdcny": float(fx["price"]),
            "theoretical_domestic_cny_g": theoretical_domestic,
            "spread_cny_g": spread,
            "spread_rate_pct": spread_rate,
            "timestamps": {
                "intl": intl["ts"],
                "domestic": domestic["ts"],
                "fx": fx["ts"],
            },
        }

    def hourly_change_pct(self, symbol: str) -> float | None:
        end = datetime.now(tz=timezone.utc)
        start = end - timedelta(hours=2)
        bars = self.db.get_bars(symbol=symbol, timeframe="1d", start=start - timedelta(days=1), end=end)
        if len(bars) < 2:
            return None
        prev = float(bars[-2]["close"])
        curr = float(bars[-1]["close"])
        if prev == 0:
            return None
        return ((curr - prev) / prev) * 100
