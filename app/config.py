from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(slots=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = _env_int("PORT", 8080)
    timezone_name: str = os.getenv("TIMEZONE", "Asia/Shanghai")
    poll_interval_sec: int = _env_int("POLL_INTERVAL_SEC", 5)
    request_timeout_sec: int = _env_int("REQUEST_TIMEOUT_SEC", 10)
    stale_fallback_max_age_sec: int = _env_int("STALE_FALLBACK_MAX_AGE_SEC", 7200)
    fx_stale_threshold_sec: int = _env_int("FX_STALE_THRESHOLD_SEC", 108000)
    session_ttl_sec: int = _env_int("SESSION_TTL_SEC", 43200)
    session_secret: str = os.getenv("SESSION_SECRET", "")
    auth_max_failures: int = _env_int("AUTH_MAX_FAILURES", 10)
    auth_window_sec: int = _env_int("AUTH_WINDOW_SEC", 300)
    auth_ban_sec: int = _env_int("AUTH_BAN_SEC", 120)
    data_dir: Path = Path(os.getenv("DATA_DIR", "data"))
    db_path: Path = Path(os.getenv("DB_PATH", "data/gold_monitor.db"))
    wecom_webhook_url: str | None = os.getenv("WECOM_WEBHOOK_URL")
    domestic_premium_cny_per_g: float = _env_float("DOMESTIC_PREMIUM_CNY_PER_G", 0.0)
    initial_backfill_days: int = _env_int("INITIAL_BACKFILL_DAYS", 365)
    enable_console_notifications: bool = _env_bool("ENABLE_CONSOLE_NOTIFICATIONS", True)
    notify_on_trigger: bool = _env_bool("NOTIFY_ON_TRIGGER", True)
    notify_on_recover: bool = _env_bool("NOTIFY_ON_RECOVER", True)
    notify_on_source: bool = _env_bool("NOTIFY_ON_SOURCE", True)
    notify_on_heartbeat: bool = _env_bool("NOTIFY_ON_HEARTBEAT", False)
    notify_style: str = os.getenv("NOTIFY_STYLE", "detailed")
    notify_title_prefix: str = os.getenv("NOTIFY_TITLE_PREFIX", "")
    basic_auth_user: str = os.getenv("BASIC_AUTH_USER", "")
    basic_auth_pass: str = os.getenv("BASIC_AUTH_PASS", "")
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = _env_int("SMTP_PORT", 587)
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_pass: str = os.getenv("SMTP_PASS", "")
    smtp_from: str = os.getenv("SMTP_FROM", "")
    smtp_use_tls: bool = _env_bool("SMTP_USE_TLS", True)
    smtp_use_ssl: bool = _env_bool("SMTP_USE_SSL", False)
    bootstrap_code_ttl_sec: int = _env_int("BOOTSTRAP_CODE_TTL_SEC", 600)
    bootstrap_code_resend_sec: int = _env_int("BOOTSTRAP_CODE_RESEND_SEC", 60)

    @property
    def timezone(self) -> ZoneInfo:
        return ZoneInfo(self.timezone_name)


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.db_path.parent.mkdir(parents=True, exist_ok=True)
