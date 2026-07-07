from __future__ import annotations

from app.sources.coingecko import CoinGeckoGoldProxyAdapter
from app.sources.domestic import DomesticReferenceAdapter
from app.sources.fx import OpenExchangeFxAdapter, YahooFxAdapter
from app.sources.gold_api import GoldApiAdapter
from app.sources.interfaces import SourceAdapter
from app.sources.stooq import StooqGoldAdapter
from app.sources.yahoo import YahooChartAdapter


def build_symbol_sources() -> dict[str, list[SourceAdapter]]:
    intl_primary = GoldApiAdapter()
    intl_backup_paxg = CoinGeckoGoldProxyAdapter(token_id="pax-gold")
    intl_backup_xaut = CoinGeckoGoldProxyAdapter(token_id="tether-gold")
    intl_backup_stooq = StooqGoldAdapter()
    intl_backup_yahoo = YahooChartAdapter(
        name="yahoo_gc_futures",
        ticker="GC=F",
        symbol="XAUUSD",
        market="international",
        currency="USD",
        unit="oz",
    )

    fx_primary = OpenExchangeFxAdapter()
    fx_backup = YahooFxAdapter()

    intl_sources = [
        intl_primary,
        intl_backup_paxg,
        intl_backup_xaut,
        intl_backup_stooq,
        intl_backup_yahoo,
    ]
    # Prefer minute-level quotes first; keep daily-ish source as fallback.
    fx_sources = [fx_backup, fx_primary]

    domestic_primary = DomesticReferenceAdapter(
        gold_sources=intl_sources,
        fx_sources=fx_sources,
        name="domestic_reference_primary",
    )

    return {
        "XAUUSD": intl_sources,
        "AUCN": [domestic_primary],
        "USDCNY": fx_sources,
    }
