from __future__ import annotations

from pathlib import Path
from zoneinfo import ZoneInfo

from app.analysis import AnalysisService
from app.backtest import BacktestService
from app.collector import PriceCollector
from app.config import Settings, settings
from app.db import Database
from app.insight import InsightEngine
from app.mailer import SmtpMailer
from app.notifier import Notifier
from app.rules import RuleEngine
from app.server import ApiContext, run_http_server
from app.yfinance_service import YFinanceService
from app.sources.factory import build_symbol_sources


def _apply_persisted_settings(db: Database, runtime_settings: Settings) -> None:
    persisted = db.list_settings()
    if not persisted:
        return

    if "poll_interval_sec" in persisted:
        try:
            runtime_settings.poll_interval_sec = max(5, int(persisted["poll_interval_sec"]))
        except ValueError:
            pass
    if "domestic_premium_cny_per_g" in persisted:
        try:
            runtime_settings.domestic_premium_cny_per_g = float(persisted["domestic_premium_cny_per_g"])
        except ValueError:
            pass
    if "wecom_webhook_url" in persisted:
        value = persisted["wecom_webhook_url"].strip()
        runtime_settings.wecom_webhook_url = value or None
    if "enable_console_notifications" in persisted:
        runtime_settings.enable_console_notifications = persisted["enable_console_notifications"].lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
    if "notify_on_trigger" in persisted:
        runtime_settings.notify_on_trigger = persisted["notify_on_trigger"].lower() in {"1", "true", "yes", "on"}
    if "notify_on_recover" in persisted:
        runtime_settings.notify_on_recover = persisted["notify_on_recover"].lower() in {"1", "true", "yes", "on"}
    if "notify_on_source" in persisted:
        runtime_settings.notify_on_source = persisted["notify_on_source"].lower() in {"1", "true", "yes", "on"}
    if "notify_on_heartbeat" in persisted:
        runtime_settings.notify_on_heartbeat = persisted["notify_on_heartbeat"].lower() in {"1", "true", "yes", "on"}
    if "notify_style" in persisted:
        style = persisted["notify_style"].strip().lower()
        runtime_settings.notify_style = "compact" if style == "compact" else "detailed"
    if "notify_title_prefix" in persisted:
        runtime_settings.notify_title_prefix = persisted["notify_title_prefix"].strip()
    if "basic_auth_user" in persisted:
        runtime_settings.basic_auth_user = persisted["basic_auth_user"].strip()
    if "basic_auth_pass" in persisted:
        runtime_settings.basic_auth_pass = persisted["basic_auth_pass"]
    if "session_secret" in persisted:
        runtime_settings.session_secret = persisted["session_secret"]
    if "session_ttl_sec" in persisted:
        try:
            runtime_settings.session_ttl_sec = max(300, int(persisted["session_ttl_sec"]))
        except ValueError:
            pass
    if "auth_max_failures" in persisted:
        try:
            runtime_settings.auth_max_failures = max(2, int(persisted["auth_max_failures"]))
        except ValueError:
            pass
    if "auth_window_sec" in persisted:
        try:
            runtime_settings.auth_window_sec = max(30, int(persisted["auth_window_sec"]))
        except ValueError:
            pass
    if "auth_ban_sec" in persisted:
        try:
            runtime_settings.auth_ban_sec = max(60, int(persisted["auth_ban_sec"]))
        except ValueError:
            pass
    if "smtp_host" in persisted:
        runtime_settings.smtp_host = persisted["smtp_host"].strip()
    if "smtp_port" in persisted:
        try:
            runtime_settings.smtp_port = max(1, int(persisted["smtp_port"]))
        except ValueError:
            pass
    if "smtp_user" in persisted:
        runtime_settings.smtp_user = persisted["smtp_user"].strip()
    if "smtp_pass" in persisted:
        runtime_settings.smtp_pass = persisted["smtp_pass"]
    if "smtp_from" in persisted:
        runtime_settings.smtp_from = persisted["smtp_from"].strip()
    if "smtp_use_tls" in persisted:
        runtime_settings.smtp_use_tls = persisted["smtp_use_tls"].lower() in {"1", "true", "yes", "on"}
    if "smtp_use_ssl" in persisted:
        runtime_settings.smtp_use_ssl = persisted["smtp_use_ssl"].lower() in {"1", "true", "yes", "on"}
    if "bootstrap_code_ttl_sec" in persisted:
        try:
            runtime_settings.bootstrap_code_ttl_sec = max(120, int(persisted["bootstrap_code_ttl_sec"]))
        except ValueError:
            pass
    if "bootstrap_code_resend_sec" in persisted:
        try:
            runtime_settings.bootstrap_code_resend_sec = max(15, int(persisted["bootstrap_code_resend_sec"]))
        except ValueError:
            pass
    if "host" in persisted:
        host = persisted["host"].strip()
        if host:
            runtime_settings.host = host
    if "port" in persisted:
        try:
            runtime_settings.port = min(65535, max(1, int(persisted["port"])))
        except ValueError:
            pass
    if "timezone_name" in persisted:
        tz_name = persisted["timezone_name"].strip()
        if tz_name:
            try:
                ZoneInfo(tz_name)
                runtime_settings.timezone_name = tz_name
            except Exception:  # noqa: BLE001
                pass


def bootstrap() -> tuple[Database, PriceCollector, InsightEngine, object]:
    db = Database(settings.db_path)
    _apply_persisted_settings(db, settings)
    notifier = Notifier(settings)
    mailer = SmtpMailer(settings)
    analysis = AnalysisService(db)
    rule_engine = RuleEngine(db, notifier)
    backtest = BacktestService(db)
    insight_engine = InsightEngine(db=db, settings=settings, notifier=notifier)
    insight_engine.start()

    yfinance_service = YFinanceService()

    symbol_sources = build_symbol_sources()
    allowed_source_pairs: set[tuple[str, str]] = set()
    for symbol, adapters in symbol_sources.items():
        for adapter in adapters:
            allowed_source_pairs.add((adapter.name, symbol))
    db.prune_source_status(allowed_source_pairs)

    collector = PriceCollector(
        db=db,
        settings=settings,
        notifier=notifier,
        rule_engine=rule_engine,
        analysis=analysis,
        symbol_sources=symbol_sources,
        insight_engine=insight_engine,
    )
    collector.start()

    static_dir = Path(__file__).resolve().parent / "static"
    context = ApiContext(
        db=db,
        analysis=analysis,
        static_dir=static_dir,
        settings=settings,
        notifier=notifier,
        mailer=mailer,
        yfinance=yfinance_service,
        active_source_pairs=allowed_source_pairs,
        collector=collector,
        insight=insight_engine,
        backtest=backtest,
    )
    server = run_http_server(settings.host, settings.port, context)
    return db, collector, insight_engine, server


def main() -> None:
    db, collector, insight_engine, server = bootstrap()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[Server] shutting down...")
        collector.stop()
        insight_engine.stop()
        server.server_close()
        db.close()


if __name__ == "__main__":
    main()
