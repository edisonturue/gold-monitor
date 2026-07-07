from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(slots=True)
class IndicatorSeries:
    ma5: list[float | None]
    ma20: list[float | None]
    ma60: list[float | None]
    rsi14: list[float | None]
    macd: list[float | None]
    signal: list[float | None]
    hist: list[float | None]


def sma(values: Sequence[float], window: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if window <= 0:
        return out

    running = 0.0
    for idx, value in enumerate(values):
        running += value
        if idx >= window:
            running -= values[idx - window]
        if idx >= window - 1:
            out[idx] = running / window
    return out


def ema(values: Sequence[float], window: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if window <= 0 or not values:
        return out

    k = 2 / (window + 1)
    seed = sum(values[: min(window, len(values))]) / min(window, len(values))
    current = seed
    start_idx = min(window - 1, len(values) - 1)
    out[start_idx] = current
    for idx in range(start_idx + 1, len(values)):
        current = values[idx] * k + current * (1 - k)
        out[idx] = current
    return out


def rsi(values: Sequence[float], period: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if period <= 0 or len(values) <= period:
        return out

    gains = [0.0] * len(values)
    losses = [0.0] * len(values)
    for idx in range(1, len(values)):
        delta = values[idx] - values[idx - 1]
        gains[idx] = max(delta, 0.0)
        losses[idx] = abs(min(delta, 0.0))

    avg_gain = sum(gains[1 : period + 1]) / period
    avg_loss = sum(losses[1 : period + 1]) / period

    rs = avg_gain / avg_loss if avg_loss != 0 else float("inf")
    out[period] = 100 - (100 / (1 + rs))

    for idx in range(period + 1, len(values)):
        avg_gain = ((avg_gain * (period - 1)) + gains[idx]) / period
        avg_loss = ((avg_loss * (period - 1)) + losses[idx]) / period
        rs = avg_gain / avg_loss if avg_loss != 0 else float("inf")
        out[idx] = 100 - (100 / (1 + rs))

    return out


def macd(values: Sequence[float], fast: int = 12, slow: int = 26, signal_window: int = 9) -> tuple[list[float | None], list[float | None], list[float | None]]:
    if not values:
        return [], [], []
    fast_ema = ema(values, fast)
    slow_ema = ema(values, slow)

    macd_line: list[float | None] = [None] * len(values)
    for idx in range(len(values)):
        if fast_ema[idx] is None or slow_ema[idx] is None:
            continue
        macd_line[idx] = fast_ema[idx] - slow_ema[idx]

    clean_macd = [value for value in macd_line if value is not None]
    signal_values = ema(clean_macd, signal_window)

    signal_line: list[float | None] = [None] * len(values)
    hist_line: list[float | None] = [None] * len(values)

    pointer = 0
    for idx, value in enumerate(macd_line):
        if value is None:
            continue
        signal_value = signal_values[pointer]
        pointer += 1
        if signal_value is None:
            continue
        signal_line[idx] = signal_value
        hist_line[idx] = value - signal_value

    return macd_line, signal_line, hist_line


def compute_indicator_series(closes: Sequence[float]) -> IndicatorSeries:
    ma5 = sma(closes, 5)
    ma20 = sma(closes, 20)
    ma60 = sma(closes, 60)
    rsi14 = rsi(closes, 14)
    macd_line, signal_line, hist_line = macd(closes)
    return IndicatorSeries(ma5=ma5, ma20=ma20, ma60=ma60, rsi14=rsi14, macd=macd_line, signal=signal_line, hist=hist_line)


def trend_label(ma5: float | None, ma20: float | None, ma60: float | None, hist: float | None, rsi14: float | None) -> tuple[str, list[str], float]:
    reasons: list[str] = []

    bullish = False
    bearish = False
    score = 0.5

    if ma5 and ma20 and ma60:
        if ma5 > ma20 > ma60:
            bullish = True
            score += 0.2
            reasons.append("MA5 > MA20 > MA60")
        elif ma5 < ma20 < ma60:
            bearish = True
            score += 0.2
            reasons.append("MA5 < MA20 < MA60")

    if hist is not None:
        if hist > 0:
            reasons.append("MACD柱线为正")
            score += 0.15
            if not bearish:
                bullish = True
        elif hist < 0:
            reasons.append("MACD柱线为负")
            score += 0.15
            if not bullish:
                bearish = True

    if rsi14 is not None:
        if 50 <= rsi14 <= 75:
            reasons.append("RSI位于强势区间")
            score += 0.1
        elif 25 <= rsi14 < 50:
            reasons.append("RSI偏弱")
        elif rsi14 > 75:
            reasons.append("RSI偏高，注意回撤")
        elif rsi14 < 25:
            reasons.append("RSI偏低，可能超卖")

    score = max(0.35, min(0.95, score))
    if bullish and not bearish:
        return "bullish", reasons, score
    if bearish and not bullish:
        return "bearish", reasons, score
    return "neutral", reasons if reasons else ["指标分歧，维持震荡判断"], min(score, 0.65)
