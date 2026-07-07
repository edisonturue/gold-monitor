from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from app.analysis import AnalysisService
from app.config import Settings
from app.db import Database
from app.models import AlertRule, as_serializable
from app.notifier import Notifier
from app.utils import parse_range_to_timedelta


class ApiContext:
    def __init__(
        self,
        db: Database,
        analysis: AnalysisService,
        static_dir: Path,
        settings: Settings,
        notifier: Notifier,
        mailer: object | None,
        active_source_pairs: set[tuple[str, str]],
        collector: object | None = None,
        insight: object | None = None,
        backtest: object | None = None,
        yfinance: object | None = None,
    ) -> None:
        self.db = db
        self.analysis = analysis
        self.static_dir = static_dir
        self.settings = settings
        self.notifier = notifier
        self.mailer = mailer
        self.active_source_pairs = active_source_pairs
        self.collector = collector
        self.insight = insight
        self.backtest = backtest
        self.yfinance = yfinance


class GoldRequestHandler(BaseHTTPRequestHandler):
    server_version = "GoldMonitor/1.0"
    context: ApiContext
    _PASSWORD_HASH_PREFIX = "pbkdf2_sha256"
    _BOOTSTRAP_CODE_MAX_FAILURES = 8
    _REGISTRATION_CODE_MAX_FAILURES = 8
    _PASSWORD_RESET_CODE_MAX_FAILURES = 8
    _auth_state_lock = threading.Lock()
    _failed_login_attempts: dict[str, list[float]] = {}
    _login_ban_until: dict[str, float] = {}
    _SOURCE_EXPECTED_UPDATE_SEC: dict[str, int] = {
        "gold_api_xau": 10,
        "coingecko_pax-gold": 45,
        "coingecko_tether-gold": 45,
        "stooq_xauusd": 60,
        "yahoo_gc_futures": 60,
        "yahoo_usdcny": 60,
        "open_er_usdcny": 86400,
        "jdjygold_zheshang_aucn": 30,
        "jdjygold_minsheng_aucn": 30,
        "domestic_reference_primary": 30,
        "domestic_reference_backup": 30,
    }
    _CHAT_HISTORY_DEFAULT_LIMIT = 80
    _CHAT_HISTORY_MAX_LIMIT = 200
    _CHAT_MEMORY_CONTEXT_LIMIT = 18

    def _send_json(self, payload: dict | list, status: int = 200, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self._set_common_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_sse_headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self._set_common_security_headers()
        self.end_headers()

    def _send_sse_event(self, payload: dict | str) -> None:
        if isinstance(payload, str):
            data = payload
        else:
            data = json.dumps(payload, ensure_ascii=False, default=str)
        body = f"data: {data}\n\n".encode("utf-8")
        self.wfile.write(body)
        self.wfile.flush()

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _send_file(self, path: Path, content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404, "Not Found")
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self._set_common_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _set_common_security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")

    def _resolve_symbol(self, query: dict[str, list[str]], default: str = "XAUUSD") -> str:
        symbol = (query.get("symbol") or [None])[0]
        if symbol:
            return symbol
        market = (query.get("market") or [None])[0]
        if market == "international":
            return "XAUUSD"
        if market == "domestic":
            return "AUCN"
        if market == "fx":
            return "USDCNY"
        return default

    @staticmethod
    def _mask_secret(value: str | None) -> str:
        if not value:
            return ""
        if len(value) <= 10:
            return "*" * len(value)
        return f"{value[:8]}...{value[-4:]}"

    @staticmethod
    def _parse_iso_timestamp(value: str | None) -> datetime | None:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = f"{raw[:-1]}+00:00"
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None

    @staticmethod
    def _validate_wecom_webhook_url(url: str) -> tuple[bool, str]:
        raw = str(url or "").strip()
        if not raw:
            return True, ""
        parsed = urlparse(raw)
        if parsed.scheme not in {"http", "https"}:
            return False, "wecom_webhook_url 必须是 http/https 链接"
        if not parsed.netloc:
            return False, "wecom_webhook_url 缺少域名，请检查链接是否完整"

        host = parsed.netloc.strip().lower()
        if host == "qyapi.weixin.qq.com":
            if not str(parsed.path).startswith("/cgi-bin/webhook/send"):
                return False, "企业微信 Webhook 路径应为 /cgi-bin/webhook/send"
            query = parse_qs(parsed.query)
            key = str((query.get("key") or [""])[0]).strip()
            if not key:
                return False, "企业微信 Webhook 缺少 key 参数"
        return True, ""

    def _auth_enabled(self) -> bool:
        self._ensure_legacy_admin_user_seeded()
        if self.context.db.count_users() > 0:
            return True
        user, password = self._expected_credentials()
        return bool(user and password)

    def _bootstrap_required(self) -> bool:
        self._ensure_legacy_admin_user_seeded()
        if self.context.db.has_admin_user():
            return False
        user, password = self._expected_credentials()
        return not bool(user and password)

    def _expected_credentials(self) -> tuple[str, str]:
        return (
            str(self.context.settings.basic_auth_user or "").strip(),
            str(self.context.settings.basic_auth_pass or "").strip(),
        )

    def _ensure_legacy_admin_user_seeded(self) -> None:
        username, password = self._expected_credentials()
        if not username or not password:
            return
        email = username if self._is_valid_email(username) else None
        self.context.db.seed_admin_user_if_missing(username=username, password_hash=password, email=email)

    @classmethod
    def _is_hashed_secret(cls, value: str | None) -> bool:
        raw = str(value or "")
        return raw.startswith(f"{cls._PASSWORD_HASH_PREFIX}$")

    @classmethod
    def _hash_secret(cls, secret: str, salt: str | None = None, iterations: int = 260000) -> str:
        salt_value = salt or secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            secret.encode("utf-8"),
            salt_value.encode("utf-8"),
            max(120000, int(iterations)),
        ).hex()
        return f"{cls._PASSWORD_HASH_PREFIX}${max(120000, int(iterations))}${salt_value}${digest}"

    @classmethod
    def _verify_secret(cls, candidate: str, stored: str) -> bool:
        raw = str(stored or "")
        if not cls._is_hashed_secret(raw):
            return hmac.compare_digest(candidate, raw)

        try:
            _prefix, iterations_raw, salt, expected_digest = raw.split("$", 3)
            iterations = max(120000, int(iterations_raw))
        except (TypeError, ValueError):
            return False

        got_digest = hashlib.pbkdf2_hmac(
            "sha256",
            candidate.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(got_digest, expected_digest)

    @staticmethod
    def _normalize_email(value: str | None) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _is_valid_email(value: str) -> bool:
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value))

    @staticmethod
    def _user_payload(user: dict) -> dict:
        return {
            "id": user.get("id"),
            "username": user.get("username"),
            "email": user.get("email"),
            "is_admin": bool(user.get("is_admin")),
            "enabled": bool(user.get("enabled")),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
        }

    def _smtp_configured(self) -> bool:
        s = self.context.settings
        return bool(
            str(s.smtp_host or "").strip()
            and int(s.smtp_port or 0) > 0
            and str(s.smtp_user or "").strip()
            and str(s.smtp_pass or "").strip()
            and str(s.smtp_from or "").strip()
        )

    def _bootstrap_email_verification_enabled(self) -> bool:
        return self._smtp_configured() and self.context.mailer is not None

    def _bootstrap_code_ttl_sec(self) -> int:
        return max(120, int(self.context.settings.bootstrap_code_ttl_sec))

    def _bootstrap_code_resend_sec(self) -> int:
        return max(15, int(self.context.settings.bootstrap_code_resend_sec))

    def _clear_bootstrap_verification_state(self) -> None:
        for key in (
            "bootstrap_email_target",
            "bootstrap_code_hash",
            "bootstrap_code_expires_at",
            "bootstrap_code_sent_at",
            "bootstrap_code_failures",
        ):
            self.context.db.set_setting(key, "")

    def _registration_code_ttl_sec(self) -> int:
        return self._bootstrap_code_ttl_sec()

    def _registration_code_resend_sec(self) -> int:
        return self._bootstrap_code_resend_sec()

    def _password_reset_code_ttl_sec(self) -> int:
        return self._registration_code_ttl_sec()

    def _password_reset_code_resend_sec(self) -> int:
        return self._registration_code_resend_sec()

    @staticmethod
    def _now_utc() -> datetime:
        return datetime.now(tz=timezone.utc)

    def _parse_iso_utc(self, value: str | None) -> datetime | None:
        parsed = self._parse_iso_timestamp(value)
        if parsed is None:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _normalize_chat_text(value: object, *, max_chars: int = 4000) -> str:
        text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
        if len(text) > max(120, int(max_chars)):
            text = text[: max(120, int(max_chars))]
        return text

    def _extract_last_chat_user_message(self, body: dict | None) -> str:
        payload = body if isinstance(body, dict) else {}
        direct = self._normalize_chat_text(payload.get("message"), max_chars=4000)
        if direct:
            return direct
        rows = payload.get("messages")
        if isinstance(rows, list):
            for row in reversed(rows):
                if not isinstance(row, dict):
                    continue
                role = str(row.get("role") or "").strip().lower()
                if role != "user":
                    continue
                content = self._normalize_chat_text(row.get("content"), max_chars=4000)
                if content:
                    return content
        return ""

    def _load_chat_memory_messages(self, username: str, *, limit: int | None = None) -> list[dict[str, str]]:
        safe_limit = max(2, min(40, int(limit or self._CHAT_MEMORY_CONTEXT_LIMIT)))
        rows = self.context.db.list_insight_chat_messages(username, limit=safe_limit)
        output: list[dict[str, str]] = []
        for row in rows:
            role = str(row.get("role") or "").strip().lower()
            if role not in {"user", "assistant"}:
                continue
            content = self._normalize_chat_text(row.get("content"), max_chars=4000)
            if not content:
                continue
            output.append({"role": role, "content": content})
        return output

    def _prepare_chat_payload_for_user(self, *, username: str, body: dict | None) -> tuple[dict, str]:
        payload = dict(body or {})
        user_message = self._extract_last_chat_user_message(payload)
        if not user_message:
            raise ValueError("message is required")

        memory_messages = self._load_chat_memory_messages(username, limit=self._CHAT_MEMORY_CONTEXT_LIMIT)
        merged_messages = [*memory_messages, {"role": "user", "content": user_message}]
        if len(merged_messages) > 24:
            merged_messages = merged_messages[-24:]

        payload["message"] = user_message
        payload["messages"] = merged_messages
        return payload, user_message

    def _persist_chat_exchange(self, *, username: str, user_message: str, assistant_reply: str) -> None:
        owner = str(username or "").strip()
        if not owner:
            return
        try:
            if user_message:
                self.context.db.append_insight_chat_message(
                    username=owner,
                    role="user",
                    content=self._normalize_chat_text(user_message, max_chars=4000),
                )
            if assistant_reply:
                self.context.db.append_insight_chat_message(
                    username=owner,
                    role="assistant",
                    content=self._normalize_chat_text(assistant_reply, max_chars=6000),
                )
        except Exception:  # noqa: BLE001
            # Chat history persistence should not break main response flow.
            return

    def _validate_invite_code(self, invite_code: str) -> tuple[bool, dict | None, str]:
        code = str(invite_code or "").strip().upper()
        if not code:
            return False, None, "invite_code is required"
        record = self.context.db.get_invite_code(code)
        if not record:
            return False, None, "invite code is invalid"
        if not bool(record.get("enabled")):
            return False, None, "invite code is disabled"
        expires_at = self._parse_iso_utc(str(record.get("expires_at") or ""))
        if expires_at is None or expires_at <= self._now_utc():
            return False, None, "invite code expired"
        used_count = int(record.get("used_count") or 0)
        max_uses = max(1, int(record.get("max_uses") or 1))
        if used_count >= max_uses:
            return False, None, "invite code exhausted"
        return True, record, ""

    def _session_secret(self) -> str:
        explicit = str(self.context.settings.session_secret or "").strip()
        if explicit:
            return explicit
        user, password = self._expected_credentials()
        return f"{user}:{password}:gold-monitor-session"

    @staticmethod
    def _b64url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    @staticmethod
    def _b64url_decode(text: str) -> bytes:
        padding = "=" * (-len(text) % 4)
        return base64.urlsafe_b64decode((text + padding).encode("utf-8"))

    def _create_session_token(self, username: str) -> str:
        ttl = max(300, int(self.context.settings.session_ttl_sec))
        payload = {
            "u": username,
            "exp": int(time.time()) + ttl,
        }
        payload_b64 = self._b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8"))
        signature = hmac.new(
            self._session_secret().encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return f"{payload_b64}.{self._b64url_encode(signature)}"

    def _validate_session_token(self, token: str) -> str | None:
        if not token or "." not in token:
            return None
        try:
            payload_b64, signature_b64 = token.split(".", 1)
            expected_sig = hmac.new(
                self._session_secret().encode("utf-8"),
                payload_b64.encode("utf-8"),
                hashlib.sha256,
            ).digest()
            got_sig = self._b64url_decode(signature_b64)
            if not hmac.compare_digest(got_sig, expected_sig):
                return None
            payload_raw = self._b64url_decode(payload_b64).decode("utf-8")
            payload = json.loads(payload_raw)
        except Exception:  # noqa: BLE001
            return None

        exp = int(payload.get("exp", 0))
        if exp <= int(time.time()):
            return None
        username = str(payload.get("u", "")).strip()
        if not username:
            return None

        user = self.context.db.get_user_by_username(username)
        if user and bool(user.get("enabled")):
            return str(user.get("username"))

        expected_user, _ = self._expected_credentials()
        if expected_user and hmac.compare_digest(username, expected_user):
            return expected_user
        return None

    def _session_cookie_header(self, token: str, clear: bool = False) -> str:
        attrs = ["gm_session=" + ("" if clear else token), "Path=/", "HttpOnly", "SameSite=Lax"]
        if clear:
            attrs.append("Max-Age=0")
        else:
            attrs.append(f"Max-Age={max(300, int(self.context.settings.session_ttl_sec))}")

        proto = str(self.headers.get("X-Forwarded-Proto", "")).strip().lower()
        if proto == "https":
            attrs.append("Secure")
        return "; ".join(attrs)

    def _client_ip(self) -> str:
        forwarded = str(self.headers.get("X-Forwarded-For", "")).strip()
        if forwarded:
            return forwarded.split(",")[0].strip()
        client_address = getattr(self, "client_address", None)
        if client_address and len(client_address) >= 1:
            return str(client_address[0])
        return "unknown"

    def _is_local_request(self) -> bool:
        ip = self._client_ip().strip().lower()
        return ip in {"127.0.0.1", "::1", "localhost"}

    def _client_user_agent(self) -> str:
        return str(self.headers.get("User-Agent", "")).strip()

    def _record_login_audit(self, *, username: str | None, success: bool, reason: str) -> None:
        try:
            self.context.db.insert_login_audit_event(
                username=(str(username).strip() if username else None),
                ip=self._client_ip(),
                user_agent=self._client_user_agent(),
                success=success,
                reason=reason,
            )
        except Exception:  # noqa: BLE001
            return

    def _is_login_banned(self, ip: str) -> tuple[bool, int]:
        now = time.time()
        with self._auth_state_lock:
            banned_until = float(self._login_ban_until.get(ip, 0))
            if banned_until <= now:
                if ip in self._login_ban_until:
                    self._login_ban_until.pop(ip, None)
                return False, 0
            return True, max(1, int(banned_until - now))

    def _record_login_failure(self, ip: str) -> None:
        now = time.time()
        max_failures = max(2, int(self.context.settings.auth_max_failures))
        window_sec = max(30, int(self.context.settings.auth_window_sec))
        ban_sec = max(10, int(self.context.settings.auth_ban_sec))
        with self._auth_state_lock:
            recent = [ts for ts in self._failed_login_attempts.get(ip, []) if now - ts <= window_sec]
            recent.append(now)
            self._failed_login_attempts[ip] = recent
            if len(recent) >= max_failures:
                self._login_ban_until[ip] = now + ban_sec

    def _clear_login_failures(self, ip: str) -> None:
        with self._auth_state_lock:
            self._failed_login_attempts.pop(ip, None)
            self._login_ban_until.pop(ip, None)

    @staticmethod
    def _parse_basic_auth_header(header: str) -> tuple[str, str] | None:
        if not header.startswith("Basic "):
            return None
        try:
            encoded = header.split(" ", 1)[1]
            decoded = base64.b64decode(encoded).decode("utf-8")
            username, password = decoded.split(":", 1)
        except Exception:  # noqa: BLE001
            return None
        return username, password

    def _verify_credentials(self, username: str, password: str) -> str | None:
        self._ensure_legacy_admin_user_seeded()
        user = self.context.db.get_user_by_login(username)
        if user and bool(user.get("enabled")) and self._verify_secret(password, str(user.get("password_hash", ""))):
            return str(user.get("username"))

        expected_user, expected_pass = self._expected_credentials()
        if expected_user and expected_pass:
            if hmac.compare_digest(username, expected_user) and self._verify_secret(password, expected_pass):
                return expected_user
        return None

    def _authenticated_username(self) -> str | None:
        if self._bootstrap_required():
            return None

        auth_header = str(self.headers.get("Authorization", "")).strip()
        parsed = self._parse_basic_auth_header(auth_header)
        if parsed is not None:
            username, password = parsed
            return self._verify_credentials(username, password)

        cookie_header = str(self.headers.get("Cookie", "")).strip()
        if not cookie_header:
            return None
        jar = cookies.SimpleCookie()
        try:
            jar.load(cookie_header)
        except cookies.CookieError:
            return None
        morsel = jar.get("gm_session")
        if morsel is None:
            return None
        return self._validate_session_token(morsel.value)

    def _is_authenticated(self) -> bool:
        return bool(self._authenticated_username())

    def _is_admin_user(self, username: str) -> bool:
        self._ensure_legacy_admin_user_seeded()
        user = self.context.db.get_user_by_username(username)
        if user is not None:
            return bool(user.get("enabled")) and bool(user.get("is_admin"))
        expected_user, _ = self._expected_credentials()
        return bool(expected_user and hmac.compare_digest(username, expected_user))

    def _redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        self._set_common_security_headers()
        self.end_headers()

    def _ensure_authorized(self, path: str) -> bool:
        if path in {
            "/api/health",
            "/login",
            "/logout",
            "/setup",
            "/register",
            "/forgot-password",
            "/api/auth/status",
            "/api/auth/bootstrap/status",
            "/api/auth/bootstrap/send_code",
            "/api/auth/login",
            "/api/auth/bootstrap/init",
            "/api/auth/register/send_code",
            "/api/auth/register",
            "/api/auth/password_reset/send_code",
            "/api/auth/password_reset/confirm",
        }:
            return True

        if self._bootstrap_required():
            if getattr(self, "command", "GET") == "GET" and path == "/":
                self._redirect("/setup")
                return False
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._set_common_security_headers()
            self.end_headers()
            self.wfile.write(b'{"error":"bootstrap required"}')
            return False

        if self._is_authenticated():
            return True
        if getattr(self, "command", "GET") == "GET" and path == "/":
            self._redirect("/login")
            return False
        self.send_response(401)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_common_security_headers()
        self.end_headers()
        self.wfile.write(b'{"error":"unauthorized"}')
        return False

    def _settings_payload(self) -> dict:
        s = self.context.settings
        auth_username = self._authenticated_username()
        pass_mask = "已加密保存" if self._is_hashed_secret(str(s.basic_auth_pass or "")) else self._mask_secret(s.basic_auth_pass)
        smtp_mask = "已配置" if str(s.smtp_pass or "").strip() else ""
        return {
            "poll_interval_sec": s.poll_interval_sec,
            "domestic_premium_cny_per_g": s.domestic_premium_cny_per_g,
            "enable_console_notifications": s.enable_console_notifications,
            "wecom_webhook_configured": bool(s.wecom_webhook_url),
            "wecom_webhook_masked": self._mask_secret(s.wecom_webhook_url),
            "notify_on_trigger": s.notify_on_trigger,
            "notify_on_recover": s.notify_on_recover,
            "notify_on_source": s.notify_on_source,
            "notify_on_heartbeat": s.notify_on_heartbeat,
            "notify_style": "compact" if str(s.notify_style).lower() == "compact" else "detailed",
            "notify_title_prefix": s.notify_title_prefix,
            "source_expected_update_sec_map": self._source_expected_update_map(),
            "basic_auth_user": str(s.basic_auth_user or ""),
            "basic_auth_pass_masked": pass_mask,
            "session_secret_configured": bool(str(s.session_secret or "")),
            "session_secret_masked": self._mask_secret(s.session_secret),
            "auth_max_failures": int(s.auth_max_failures),
            "auth_window_sec": int(s.auth_window_sec),
            "auth_ban_sec": int(s.auth_ban_sec),
            "auth_enabled": self._auth_enabled(),
            "session_ttl_sec": max(300, int(s.session_ttl_sec)),
            "smtp_host": str(s.smtp_host or ""),
            "smtp_port": int(s.smtp_port),
            "smtp_user": str(s.smtp_user or ""),
            "smtp_pass_masked": smtp_mask,
            "smtp_from": str(s.smtp_from or ""),
            "smtp_use_tls": bool(s.smtp_use_tls),
            "smtp_use_ssl": bool(s.smtp_use_ssl),
            "smtp_configured": self._smtp_configured(),
            "bootstrap_email_verification_enabled": self._bootstrap_email_verification_enabled(),
            "bootstrap_code_ttl_sec": self._bootstrap_code_ttl_sec(),
            "bootstrap_code_resend_sec": self._bootstrap_code_resend_sec(),
            "registration_email_verification_enabled": self._bootstrap_email_verification_enabled(),
            "user_count": self.context.db.count_users(),
            "authenticated_user": auth_username,
            "is_admin": bool(auth_username and self._is_admin_user(auth_username)),
            "deploy_host": str(s.host),
            "deploy_port": int(s.port),
            "deploy_timezone": str(s.timezone_name),
            "deploy_db_path": str(s.db_path),
            "restart_required_fields": ["deploy_host", "deploy_port", "deploy_timezone"],
        }

    @staticmethod
    def _filter_visible_sources(source_rows: list[dict]) -> list[dict]:
        up_by_symbol: dict[str, bool] = {}
        for row in source_rows:
            symbol = str(row.get("symbol", ""))
            status = str(row.get("status", "")).lower()
            if status == "up":
                up_by_symbol[symbol] = True
            elif symbol not in up_by_symbol:
                up_by_symbol[symbol] = False

        visible: list[dict] = []
        for row in source_rows:
            symbol = str(row.get("symbol", ""))
            status = str(row.get("status", "")).lower()
            # Keep down rows only when the whole symbol has no live source.
            if status == "down" and up_by_symbol.get(symbol, False):
                continue
            visible.append(row)
        return visible

    def _source_expected_update_map(self) -> dict[str, int]:
        merged = {key: int(value) for key, value in self._SOURCE_EXPECTED_UPDATE_SEC.items()}
        raw = self.context.db.get_setting("source_expected_update_sec_map")
        if not raw:
            return merged
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return merged
        if not isinstance(payload, dict):
            return merged

        for key, value in payload.items():
            source_name = str(key).strip()
            if source_name not in merged:
                continue
            try:
                merged[source_name] = max(5, int(value))
            except (TypeError, ValueError):
                continue
        return merged

    @staticmethod
    def _source_parts(source_name: str | None) -> list[str]:
        if not source_name:
            return []
        normalized = str(source_name).replace(" (cached_fallback)", "").strip()
        if not normalized:
            return []
        parts: list[str] = []
        for section in normalized.split(":"):
            for token in section.split("+"):
                value = token.strip()
                if value:
                    parts.append(value)
        return parts

    def _expected_update_sec(self, symbol: str, source_name: str | None, source_expected_map: dict[str, int]) -> int:
        symbol_defaults = {
            "XAUUSD": 30,
            "AUCN": 30,
            "USDCNY": 3600,
        }
        fallback = int(symbol_defaults.get(symbol, max(15, int(self.context.settings.poll_interval_sec) * 2)))
        parts = self._source_parts(source_name)
        if not parts:
            return fallback
        expected: list[int] = []
        for part in parts:
            value = source_expected_map.get(part)
            if value is not None:
                expected.append(int(value))
            elif part.startswith("coingecko_"):
                expected.append(45)
            elif part.startswith("yahoo_"):
                expected.append(60)
            elif part.startswith("open_er_"):
                expected.append(86400)
        if not expected:
            return fallback
        return max(5, min(expected))

    def _annotate_staleness(self, rows: list[dict]) -> list[dict]:
        now = datetime.now(tz=timezone.utc)
        source_expected_map = self._source_expected_update_map()
        symbols = [str(row.get("symbol") or "") for row in rows if row.get("symbol")]
        last_changed = self.context.db.get_last_changed_timestamps(symbols)
        market_threshold: dict[str, int] = {
            "USDCNY": max(3600, int(self.context.settings.fx_stale_threshold_sec)),
        }
        default_threshold = max(15, int(self.context.settings.poll_interval_sec) * 3)
        output: list[dict] = []
        for row in rows:
            item = dict(row)
            symbol = str(item.get("symbol") or "")
            source_name = str(item.get("source") or "")
            expected_update_sec = self._expected_update_sec(symbol, source_name, source_expected_map)
            threshold = market_threshold.get(symbol, max(default_threshold, expected_update_sec * 3))
            ts = self._parse_iso_timestamp(item.get("ts"))
            item["expected_update_sec"] = expected_update_sec
            item["last_changed_at"] = last_changed.get(symbol) or item.get("ts")
            if ts is None:
                item["age_sec"] = None
                item["stale"] = True
                item["freshness_status"] = "cached" if "cached_fallback" in source_name else "delayed"
            else:
                age_sec = max(0, int((now - ts.astimezone(timezone.utc)).total_seconds()))
                item["age_sec"] = age_sec
                item["stale"] = age_sec > threshold
                if "cached_fallback" in source_name:
                    item["freshness_status"] = "cached"
                elif age_sec <= expected_update_sec:
                    item["freshness_status"] = "live"
                else:
                    item["freshness_status"] = "delayed"
            output.append(item)
        return output

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        bootstrap_required = self._bootstrap_required()

        if path == "/":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if not self._is_authenticated():
                self._redirect("/login")
                return
            return self._redirect("/market")

        if path == "/market":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if not self._is_authenticated():
                self._redirect("/login")
                return
            return self._send_file(self.context.static_dir / "market.html", "text/html; charset=utf-8")

        if path == "/ai":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if not self._is_authenticated():
                self._redirect("/login")
                return
            return self._send_file(self.context.static_dir / "ai.html", "text/html; charset=utf-8")

        if path == "/system":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if not self._is_authenticated():
                self._redirect("/login")
                return
            return self._send_file(self.context.static_dir / "system.html", "text/html; charset=utf-8")

        if path == "/setup":
            if not bootstrap_required:
                self._redirect("/login")
                return
            return self._send_file(self.context.static_dir / "setup.html", "text/html; charset=utf-8")

        if path == "/logout":
            self.send_response(302)
            self.send_header("Location", "/login")
            self.send_header("Set-Cookie", self._session_cookie_header("", clear=True))
            self._set_common_security_headers()
            self.end_headers()
            return

        if path == "/login":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if self._is_authenticated():
                self._redirect("/market")
                return
            return self._send_file(self.context.static_dir / "login.html", "text/html; charset=utf-8")

        if path == "/register":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if self._is_authenticated():
                self._redirect("/market")
                return
            return self._send_file(self.context.static_dir / "register.html", "text/html; charset=utf-8")

        if path == "/forgot-password":
            if bootstrap_required:
                self._redirect("/setup")
                return
            if self._is_authenticated():
                self._redirect("/market")
                return
            return self._send_file(self.context.static_dir / "forgot_password.html", "text/html; charset=utf-8")

        if path == "/api/auth/bootstrap/status":
            return self._send_json(
                {
                    "bootstrap_required": bootstrap_required,
                    "email_verification_enabled": self._bootstrap_email_verification_enabled(),
                    "smtp_configured": self._smtp_configured(),
                    "code_ttl_sec": self._bootstrap_code_ttl_sec(),
                    "resend_interval_sec": self._bootstrap_code_resend_sec(),
                }
            )

        if path == "/api/auth/status":
            username = self._authenticated_username()
            return self._send_json(
                {
                    "bootstrap_required": bootstrap_required,
                    "auth_enabled": self._auth_enabled(),
                    "authenticated": bool(username),
                    "authenticated_user": username,
                    "is_admin": bool(username and self._is_admin_user(username)),
                    "email_verification_enabled": self._bootstrap_email_verification_enabled(),
                }
            )

        if not self._ensure_authorized(path):
            return

        if path == "/api/health":
            collector = self.context.collector
            collector_running = bool(getattr(collector, "is_running", lambda: False)())
            return self._send_json(
                {
                    "ok": True,
                    "service": "gold-monitor",
                    "time": datetime.now(tz=timezone.utc).isoformat(),
                    "collector_running": collector_running,
                }
            )

        if path == "/static/styles.css":
            return self._send_file(self.context.static_dir / "styles.css", "text/css; charset=utf-8")
        if path == "/static/app.js":
            return self._send_file(self.context.static_dir / "app.js", "application/javascript; charset=utf-8")
        if path.startswith("/static/js/") and path.endswith(".js"):
            js_name = path[len("/static/js/"):]
            js_path = self.context.static_dir / "js" / js_name
            return self._send_file(js_path, "application/javascript; charset=utf-8")

        if path == "/api/prices/latest":
            latest = self._annotate_staleness(self.context.db.get_latest_ticks(["XAUUSD", "AUCN", "USDCNY"]))
            forecast_intl = self.context.analysis.forecast_signal("XAUUSD", "1d", "12m")
            forecast_dom = self.context.analysis.forecast_signal("AUCN", "1d", "12m")
            source_rows = self.context.db.list_source_status_for_pairs(self.context.active_source_pairs)
            visible_sources = self._filter_visible_sources(source_rows)

            payload = {
                "items": latest,
                "spread": self.context.analysis.spread_payload(),
                "forecast": {
                    "XAUUSD": {
                        "bias": forecast_intl.bias,
                        "confidence": forecast_intl.confidence,
                        "reasons": forecast_intl.reasons,
                    },
                    "AUCN": {
                        "bias": forecast_dom.bias,
                        "confidence": forecast_dom.confidence,
                        "reasons": forecast_dom.reasons,
                    },
                },
                "sources": visible_sources,
            }
            return self._send_json(payload)

        if path == "/api/kline":
            symbol = self._resolve_symbol(query)
            timeframe = (query.get("timeframe") or ["1d"])[0]
            range_str = (query.get("range") or ["12m"])[0]
            bars = self.context.analysis.get_kline(symbol=symbol, timeframe=timeframe, range_str=range_str)
            return self._send_json(
                {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "range": range_str,
                    "bars": bars,
                }
            )

        if path == "/api/indicators":
            symbol = self._resolve_symbol(query)
            timeframe = (query.get("timeframe") or ["1d"])[0]
            range_str = (query.get("range") or ["12m"])[0]
            payload = self.context.analysis.get_indicator_payload(symbol=symbol, timeframe=timeframe, range_str=range_str)
            return self._send_json(payload)

        if path == "/api/forecast/signal":
            symbol = self._resolve_symbol(query)
            timeframe = (query.get("timeframe") or ["1d"])[0]
            signal = self.context.analysis.forecast_signal(symbol=symbol, timeframe=timeframe, range_str=(query.get("range") or ["12m"])[0])
            return self._send_json(
                {
                    "symbol": signal.symbol,
                    "timeframe": signal.timeframe,
                    "bias": signal.bias,
                    "confidence": signal.confidence,
                    "reasons": signal.reasons,
                }
            )

        if path == "/api/rules":
            rules = self.context.db.list_rules()
            payload = [as_serializable(rule) for rule in rules]
            return self._send_json(payload)

        if path == "/api/alerts":
            events = self.context.db.list_alert_events(limit=120)
            return self._send_json(events)

        if path == "/api/chart/config":
            return self._send_json(
                {
                    "default_range": "12m",
                    "default_timeframe": "1d",
                    "default_indicators": ["MA5", "MA20", "MA60", "RSI14", "MACD"],
                    "layout_modes": ["split", "all", "intl", "domestic", "dual-axis"],
                    "symbols": ["XAUUSD", "AUCN"],
                }
            )

        if path == "/api/yfinance/overview":
            service = getattr(self.context, "yfinance", None)
            if service is None or not hasattr(service, "get_overview"):
                return self._send_json({"error": "yfinance service unavailable"}, status=503)

            ticker = str((query.get("ticker") or ["AAPL"])[0] or "")
            period = str((query.get("period") or ["6mo"])[0] or "")
            interval = str((query.get("interval") or ["1d"])[0] or "")
            prepost_raw = str((query.get("prepost") or ["false"])[0] or "").strip().lower()
            prepost = prepost_raw in {"1", "true", "yes", "on"}

            try:
                payload = service.get_overview(  # type: ignore[attr-defined]
                    ticker=ticker,
                    period=period,
                    interval=interval,
                    prepost=prepost,
                )
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            except RuntimeError as exc:
                return self._send_json({"error": str(exc)}, status=503)
            except Exception as exc:  # noqa: BLE001
                return self._send_json({"error": f"yfinance fetch failed: {exc}"}, status=502)
            return self._send_json(payload)

        if path == "/api/settings":
            return self._send_json(self._settings_payload())

        if path == "/api/admin/login_audit":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)
            try:
                limit = max(1, min(500, int((query.get("limit") or ["120"])[0])))
            except (TypeError, ValueError):
                return self._send_json({"error": "limit must be integer"}, status=400)
            events = self.context.db.list_login_audit_events(limit=limit)
            return self._send_json({"operator": operator, "events": events})

        if path == "/api/admin/users":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            users = self.context.db.list_users()
            result = [self._user_payload(user) for user in users]
            return self._send_json(
                {
                    "operator": operator,
                    "users": result,
                    "enabled_admin_count": self.context.db.count_enabled_admin_users(),
                }
            )

        if path == "/api/insight/chat/history":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            try:
                limit = int((query.get("limit") or [str(self._CHAT_HISTORY_DEFAULT_LIMIT)])[0])
            except (TypeError, ValueError):
                return self._send_json({"error": "limit must be integer"}, status=400)
            safe_limit = max(1, min(self._CHAT_HISTORY_MAX_LIMIT, limit))
            messages = self.context.db.list_insight_chat_messages(operator, limit=safe_limit)
            return self._send_json(
                {
                    "ok": True,
                    "username": operator,
                    "limit": safe_limit,
                    "messages": messages,
                    "count": len(messages),
                }
            )

        if path == "/api/insight/settings":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "get_settings_payload"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            payload = insight.get_settings_payload()  # type: ignore[attr-defined]
            return self._send_json(payload)

        if path == "/api/insight/events":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "list_events"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                limit = max(1, min(200, int((query.get("limit") or ["20"])[0])))
            except (TypeError, ValueError):
                return self._send_json({"error": "limit must be integer"}, status=400)
            symbol = str((query.get("symbol") or [""])[0]).strip().upper() or None
            direction = str((query.get("direction") or [""])[0]).strip().lower() or None
            if direction not in {None, "up", "down"}:
                return self._send_json({"error": "direction must be up or down"}, status=400)
            start_text = str((query.get("start") or [""])[0]).strip()
            end_text = str((query.get("end") or [""])[0]).strip()
            range_text = str((query.get("range") or [""])[0]).strip().lower()
            start_at = self._parse_iso_utc(start_text) if start_text else None
            end_at = self._parse_iso_utc(end_text) if end_text else None
            if (start_text and start_at is None) or (end_text and end_at is None):
                return self._send_json({"error": "start/end must be ISO datetime"}, status=400)
            if range_text and start_at is None and end_at is None:
                if range_text not in {"1m", "3m", "6m", "12m"}:
                    return self._send_json({"error": "range must be one of 1m/3m/6m/12m"}, status=400)
                end_at = datetime.now(tz=timezone.utc)
                start_at = end_at - parse_range_to_timedelta(range_text)
            if start_at is not None and end_at is not None and start_at > end_at:
                return self._send_json({"error": "start must be <= end"}, status=400)
            payload = insight.list_events(  # type: ignore[attr-defined]
                limit=limit,
                symbol=symbol,
                direction=direction,
                start_at=start_at,
                end_at=end_at,
            )
            return self._send_json(payload)

        segments = [seg for seg in path.split("/") if seg]
        if len(segments) == 5 and segments[:3] == ["api", "insight", "events"] and segments[4] == "progress":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "get_event_progress"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                event_id = int(segments[3])
            except ValueError:
                return self._send_json({"error": "invalid event id"}, status=400)
            payload = insight.get_event_progress(event_id)  # type: ignore[attr-defined]
            if not payload:
                return self._send_json({"error": "event not found"}, status=404)
            return self._send_json(payload)

        if len(segments) == 4 and segments[:3] == ["api", "insight", "events"]:
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "get_event"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                event_id = int(segments[3])
            except ValueError:
                return self._send_json({"error": "invalid event id"}, status=400)
            payload = insight.get_event(event_id)  # type: ignore[attr-defined]
            if not payload:
                return self._send_json({"error": "event not found"}, status=404)
            return self._send_json(payload)

        self.send_error(404, "Not Found")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/auth/bootstrap/send_code":
            if not self._bootstrap_required():
                return self._send_json({"error": "bootstrap already completed"}, status=409)
            if not self._bootstrap_email_verification_enabled():
                return self._send_json({"error": "email verification is not enabled"}, status=400)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            email = self._normalize_email(body.get("email"))
            if not self._is_valid_email(email):
                return self._send_json({"error": "invalid email"}, status=400)

            now = int(time.time())
            resend_sec = self._bootstrap_code_resend_sec()
            last_sent_raw = self.context.db.get_setting("bootstrap_code_sent_at") or "0"
            try:
                last_sent = int(float(last_sent_raw))
            except ValueError:
                last_sent = 0
            remaining = (last_sent + resend_sec) - now
            if remaining > 0:
                return self._send_json({"error": "too many requests", "retry_after_sec": remaining}, status=429)

            code = f"{secrets.randbelow(1000000):06d}"
            ttl_sec = self._bootstrap_code_ttl_sec()
            mailer = self.context.mailer
            if mailer is None or not hasattr(mailer, "send_bootstrap_verification"):
                return self._send_json({"error": "mailer unavailable"}, status=503)
            try:
                mailer.send_bootstrap_verification(email, code, ttl_sec)  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001
                return self._send_json({"error": "failed to send verification email"}, status=502)

            self.context.db.set_setting("bootstrap_email_target", email)
            self.context.db.set_setting("bootstrap_code_hash", self._hash_secret(code))
            self.context.db.set_setting("bootstrap_code_expires_at", str(now + ttl_sec))
            self.context.db.set_setting("bootstrap_code_sent_at", str(now))
            self.context.db.set_setting("bootstrap_code_failures", "0")
            return self._send_json({"ok": True, "expires_in_sec": ttl_sec}, status=200)

        if parsed.path == "/api/auth/bootstrap/init":
            if not self._bootstrap_required():
                return self._send_json({"error": "bootstrap already completed"}, status=409)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            raw_username = str(body.get("username", "")).strip()
            password = str(body.get("password", ""))
            email = self._normalize_email(body.get("email"))
            verification_code = str(body.get("verification_code", "")).strip()
            username = raw_username
            if self._bootstrap_email_verification_enabled():
                if not self._is_valid_email(email):
                    return self._send_json({"error": "valid email is required"}, status=400)
                if not verification_code:
                    return self._send_json({"error": "verification_code is required"}, status=400)
                if not username:
                    username = email

                pending_email = self._normalize_email(self.context.db.get_setting("bootstrap_email_target"))
                stored_hash = str(self.context.db.get_setting("bootstrap_code_hash") or "")
                expires_raw = str(self.context.db.get_setting("bootstrap_code_expires_at") or "0")
                failures_raw = str(self.context.db.get_setting("bootstrap_code_failures") or "0")
                try:
                    expires_at = int(float(expires_raw))
                except ValueError:
                    expires_at = 0
                try:
                    failures = max(0, int(failures_raw))
                except ValueError:
                    failures = 0

                if not pending_email or not stored_hash:
                    return self._send_json({"error": "verification code not sent"}, status=400)
                if pending_email != email:
                    return self._send_json({"error": "email mismatch"}, status=400)
                if expires_at <= int(time.time()):
                    self._clear_bootstrap_verification_state()
                    return self._send_json({"error": "verification code expired"}, status=400)
                if failures >= self._BOOTSTRAP_CODE_MAX_FAILURES:
                    self._clear_bootstrap_verification_state()
                    return self._send_json({"error": "verification failed too many times"}, status=429)
                if not self._verify_secret(verification_code, stored_hash):
                    self.context.db.set_setting("bootstrap_code_failures", str(failures + 1))
                    return self._send_json({"error": "invalid verification code"}, status=400)
                self._clear_bootstrap_verification_state()

            if not username or not password:
                return self._send_json({"error": "username and password are required"}, status=400)
            if len(username) > 64:
                return self._send_json({"error": "username too long"}, status=400)
            if len(password) > 128:
                return self._send_json({"error": "password too long"}, status=400)

            session_secret = str(body.get("session_secret", "")).strip()
            secret_generated = False
            if not session_secret:
                session_secret = secrets.token_urlsafe(32)
                secret_generated = True

            settings = self.context.settings
            settings.basic_auth_user = username
            settings.basic_auth_pass = self._hash_secret(password)
            settings.session_secret = session_secret
            self.context.db.set_setting("basic_auth_user", username)
            self.context.db.set_setting("basic_auth_pass", settings.basic_auth_pass)
            self.context.db.set_setting("session_secret", session_secret)
            # Also write session_secret to .env so user can find it easily
            try:
                env_path = self.context.static_dir.parent / ".env"
                if env_path.is_file():
                    env_lines = env_path.read_text().splitlines(keepends=True)
                    found = False
                    for i, line in enumerate(env_lines):
                        if line.strip().startswith("SESSION_SECRET="):
                            env_lines[i] = f"SESSION_SECRET={session_secret}\n"
                            found = True
                            break
                    if not found:
                        env_lines.append(f"SESSION_SECRET={session_secret}\n")
                    env_path.write_text("".join(env_lines))
            except Exception:
                pass
            account_email = email if self._is_valid_email(email) else (username if self._is_valid_email(username) else None)
            self.context.db.upsert_admin_user(
                username=username,
                password_hash=settings.basic_auth_pass,
                email=account_email,
            )
            return self._send_json(
                {
                    "ok": True,
                    "bootstrap_required": False,
                    "username": username,
                    "session_secret_generated": secret_generated,
                },
                status=201,
            )

        if parsed.path == "/api/auth/register/send_code":
            if self._bootstrap_required():
                return self._send_json({"error": "bootstrap required"}, status=409)
            if not self._bootstrap_email_verification_enabled():
                return self._send_json({"error": "email verification is not enabled"}, status=400)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            invite_code = str(body.get("invite_code", "")).strip().upper()
            if invite_code:
                valid_invite, _invite_record, invite_error = self._validate_invite_code(invite_code)
                if not valid_invite:
                    return self._send_json({"error": invite_error}, status=400)

            email = self._normalize_email(body.get("email"))
            if not self._is_valid_email(email):
                return self._send_json({"error": "invalid email"}, status=400)
            if self.context.db.get_user_by_email(email):
                return self._send_json({"error": "email already registered"}, status=409)

            now = self._now_utc()
            resend_sec = self._registration_code_resend_sec()
            existing_code = self.context.db.get_register_code(email)
            if existing_code:
                sent_at = self._parse_iso_utc(str(existing_code.get("sent_at") or ""))
                if sent_at is not None:
                    retry_at = sent_at + timedelta(seconds=resend_sec)
                    if retry_at > now:
                        retry_after = max(1, int((retry_at - now).total_seconds()))
                        return self._send_json({"error": "too many requests", "retry_after_sec": retry_after}, status=429)

            code = f"{secrets.randbelow(1000000):06d}"
            ttl_sec = self._registration_code_ttl_sec()
            mailer = self.context.mailer
            if mailer is None or not hasattr(mailer, "send_registration_verification"):
                return self._send_json({"error": "mailer unavailable"}, status=503)
            try:
                mailer.send_registration_verification(email, code, ttl_sec)  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001
                return self._send_json({"error": "failed to send verification email"}, status=502)

            self.context.db.upsert_register_code(
                email=email,
                invite_code=invite_code,
                code_hash=self._hash_secret(code),
                expires_at=now + timedelta(seconds=ttl_sec),
                sent_at=now,
            )
            return self._send_json({"ok": True, "expires_in_sec": ttl_sec}, status=200)

        if parsed.path == "/api/auth/register":
            if self._bootstrap_required():
                return self._send_json({"error": "bootstrap required"}, status=409)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            invite_code = str(body.get("invite_code", "")).strip().upper()
            if invite_code:
                valid_invite, _invite_record, invite_error = self._validate_invite_code(invite_code)
                if not valid_invite:
                    return self._send_json({"error": invite_error}, status=400)

            email = self._normalize_email(body.get("email"))
            if not self._is_valid_email(email):
                return self._send_json({"error": "valid email is required"}, status=400)
            username = str(body.get("username", "")).strip() or email
            password = str(body.get("password", ""))
            verification_code = str(body.get("verification_code", "")).strip()

            if not username or not password or not verification_code:
                return self._send_json({"error": "username, password and verification_code are required"}, status=400)
            if len(username) > 64:
                return self._send_json({"error": "username too long"}, status=400)
            if len(password) > 128:
                return self._send_json({"error": "password too long"}, status=400)
            if self.context.db.get_user_by_username(username):
                return self._send_json({"error": "username already exists"}, status=409)
            if self.context.db.get_user_by_email(email):
                return self._send_json({"error": "email already registered"}, status=409)

            row = self.context.db.get_register_code(email)
            if not row:
                return self._send_json({"error": "verification code not sent"}, status=400)

            expires_at = self._parse_iso_utc(str(row.get("expires_at") or ""))
            if expires_at is None or expires_at <= self._now_utc():
                self.context.db.delete_register_code(email)
                return self._send_json({"error": "verification code expired"}, status=400)

            failures = max(0, int(row.get("failures") or 0))
            if failures >= self._REGISTRATION_CODE_MAX_FAILURES:
                self.context.db.delete_register_code(email)
                return self._send_json({"error": "verification failed too many times"}, status=429)

            stored_hash = str(row.get("code_hash") or "")
            if not self._verify_secret(verification_code, stored_hash):
                self.context.db.increment_register_code_failures(email)
                return self._send_json({"error": "invalid verification code"}, status=400)

            password_hash = self._hash_secret(password)
            try:
                self.context.db.create_user(
                    username=username,
                    email=email,
                    password_hash=password_hash,
                    is_admin=False,
                    enabled=True,
                )
            except Exception:  # noqa: BLE001
                return self._send_json({"error": "username or email already exists"}, status=409)
            if invite_code:
                self.context.db.increment_invite_used_count(invite_code)
            self.context.db.delete_register_code(email)
            return self._send_json({"ok": True, "username": username, "email": email}, status=201)

        if parsed.path == "/api/auth/password_reset/send_code":
            if self._bootstrap_required():
                return self._send_json({"error": "bootstrap required"}, status=409)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            raw_input = str(body.get("email") or "").strip()
            if not raw_input:
                return self._send_json({"error": "email or username is required"}, status=400)

            # Determine if input is email or username
            is_email_input = "@" in raw_input
            email = self._normalize_email(raw_input) if is_email_input else ""

            ttl_sec = self._password_reset_code_ttl_sec()
            resend_sec = self._password_reset_code_resend_sec()
            now = self._now_utc()

            # Look up user by email or username
            user = None
            if email:
                user = self.context.db.get_user_by_email(email)
            if user is None:
                user = self.context.db.get_user_by_login(raw_input)
            if user is not None:
                email = self._normalize_email(str(user.get("email") or user.get("username") or ""))
                if not self._is_valid_email(email):
                    email = ""

            if email:
                existing = self.context.db.get_password_reset_code(email)
                if existing:
                    sent_at = self._parse_iso_utc(str(existing.get("sent_at") or ""))
                    if sent_at is not None:
                        retry_at = sent_at + timedelta(seconds=resend_sec)
                        if retry_at > now:
                            retry_after = max(1, int((retry_at - now).total_seconds()))
                            return self._send_json({"error": "too many requests", "retry_after_sec": retry_after}, status=429)

            self._ensure_legacy_admin_user_seeded()
            smtp_enabled = self._bootstrap_email_verification_enabled()
            if not smtp_enabled and not self._is_local_request():
                return self._send_json(
                    {
                        "error": "email verification is not enabled; configure SMTP or use recovery_secret (SESSION_SECRET) on /forgot-password",
                        "code": "smtp_not_configured",
                    },
                    status=400,
                )

            if user is None:
                return self._send_json({"ok": True, "expires_in_sec": ttl_sec}, status=200)

            code = f"{secrets.randbelow(1000000):06d}"

            if smtp_enabled:
                mailer = self.context.mailer
                if mailer is None or not hasattr(mailer, "send_password_reset_verification"):
                    return self._send_json({"error": "mailer unavailable"}, status=503)
                try:
                    mailer.send_password_reset_verification(email, code, ttl_sec)  # type: ignore[attr-defined]
                except Exception:  # noqa: BLE001
                    return self._send_json({"error": "failed to send verification email"}, status=502)
                self.context.db.upsert_password_reset_code(
                    email=email,
                    code_hash=self._hash_secret(code),
                    expires_at=now + timedelta(seconds=ttl_sec),
                    sent_at=now,
                )
                return self._send_json({"ok": True, "expires_in_sec": ttl_sec, "delivery": "email"}, status=200)

            if self._is_local_request():
                # Local fallback keeps recovery available for self-hosted users even if SMTP is not configured.
                self.context.db.upsert_password_reset_code(
                    email=email,
                    code_hash=self._hash_secret(code),
                    expires_at=now + timedelta(seconds=ttl_sec),
                    sent_at=now,
                )
                return self._send_json(
                    {
                        "ok": True,
                        "expires_in_sec": ttl_sec,
                        "delivery": "local_dev",
                        "dev_verification_code": code,
                    },
                    status=200,
                )

            return self._send_json({"ok": True, "expires_in_sec": ttl_sec}, status=200)

        if parsed.path == "/api/auth/password_reset/confirm":
            if self._bootstrap_required():
                return self._send_json({"error": "bootstrap required"}, status=409)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            account_input = str(body.get("email", "")).strip()
            email = self._normalize_email(account_input)
            verification_code = str(body.get("verification_code", "")).strip()
            recovery_secret = str(body.get("recovery_secret", "")).strip()
            new_password = str(body.get("new_password", ""))
            if not account_input:
                return self._send_json({"error": "email is required"}, status=400)
            if not new_password:
                return self._send_json({"error": "email and new_password are required"}, status=400)
            if len(new_password) > 128:
                return self._send_json({"error": "new_password too long"}, status=400)

            if recovery_secret:
                configured_secret = str(self.context.settings.session_secret or "").strip()
                if not configured_secret:
                    return self._send_json({"error": "recovery_secret mode unavailable"}, status=400)
                if not hmac.compare_digest(recovery_secret, configured_secret):
                    return self._send_json({"error": "invalid recovery_secret"}, status=401)
                user = self.context.db.get_user_by_login(account_input)
                if user is None:
                    self._ensure_legacy_admin_user_seeded()
                    user = self.context.db.get_user_by_login(account_input)
                if user is None:
                    enabled_admins = [
                        item
                        for item in self.context.db.list_users()
                        if bool(item.get("is_admin")) and bool(item.get("enabled"))
                    ]
                    admin_candidates = [
                        str(item.get("username") or "").strip()
                        for item in enabled_admins
                        if str(item.get("username") or "").strip()
                    ]
                    return self._send_json(
                        {
                            "error": "verification target not found; account mismatch",
                            "admin_candidates": admin_candidates[:10],
                        },
                        status=400,
                    )

                new_hash = self._hash_secret(new_password)
                updated = self.context.db.set_user_password_hash(int(user.get("id")), new_hash)
                if not updated:
                    return self._send_json({"error": "user not found"}, status=404)

                username = str(user.get("username") or "")
                expected_user, _expected_pass = self._expected_credentials()
                if expected_user and hmac.compare_digest(expected_user, username):
                    self.context.settings.basic_auth_pass = new_hash
                    self.context.db.set_setting("basic_auth_pass", new_hash)
                    resolved_email = self._normalize_email(str(user.get("email") or ""))
                    admin_email = resolved_email if self._is_valid_email(resolved_email) else None
                    self.context.db.upsert_admin_user(username=username, password_hash=new_hash, email=admin_email)
                resolved_email = self._normalize_email(str(user.get("email") or ""))
                if self._is_valid_email(resolved_email):
                    self.context.db.delete_password_reset_code(resolved_email)
                return self._send_json(
                    {
                        "ok": True,
                        "password_updated": True,
                        "username": username,
                        "mode": "recovery_secret",
                    },
                    status=200,
                )

            if not verification_code:
                return self._send_json({"error": "verification_code or recovery_secret is required"}, status=400)
            if not self._is_valid_email(email):
                return self._send_json({"error": "valid email is required"}, status=400)

            user = self.context.db.get_user_by_email(email)
            if user is None:
                return self._send_json({"error": "verification target not found"}, status=400)

            row = self.context.db.get_password_reset_code(email)
            if not row:
                return self._send_json({"error": "verification code not sent"}, status=400)

            expires_at = self._parse_iso_utc(str(row.get("expires_at") or ""))
            if expires_at is None or expires_at <= self._now_utc():
                self.context.db.delete_password_reset_code(email)
                return self._send_json({"error": "verification code expired"}, status=400)

            failures = max(0, int(row.get("failures") or 0))
            if failures >= self._PASSWORD_RESET_CODE_MAX_FAILURES:
                self.context.db.delete_password_reset_code(email)
                return self._send_json({"error": "verification failed too many times"}, status=429)

            if not self._verify_secret(verification_code, str(row.get("code_hash") or "")):
                self.context.db.increment_password_reset_code_failures(email)
                return self._send_json({"error": "invalid verification code"}, status=400)

            new_hash = self._hash_secret(new_password)
            updated = self.context.db.set_user_password_hash(int(user.get("id")), new_hash)
            if not updated:
                return self._send_json({"error": "user not found"}, status=404)

            username = str(user.get("username") or "")
            expected_user, _expected_pass = self._expected_credentials()
            if expected_user and hmac.compare_digest(expected_user, username):
                self.context.settings.basic_auth_pass = new_hash
                self.context.db.set_setting("basic_auth_pass", new_hash)
                admin_email = email if self._is_valid_email(email) else None
                self.context.db.upsert_admin_user(username=username, password_hash=new_hash, email=admin_email)

            self.context.db.delete_password_reset_code(email)
            return self._send_json({"ok": True, "password_updated": True, "username": username}, status=200)

        if parsed.path == "/api/auth/login":
            if self._bootstrap_required():
                self._record_login_audit(username=None, success=False, reason="bootstrap required")
                return self._send_json({"error": "bootstrap required"}, status=409)
            if not self._auth_enabled():
                self._record_login_audit(username=None, success=False, reason="auth disabled")
                return self._send_json({"error": "auth not enabled"}, status=400)
            ip = self._client_ip()
            is_banned, retry_after = self._is_login_banned(ip)
            if is_banned:
                self._record_login_audit(username=None, success=False, reason="login banned")
                return self._send_json(
                    {"error": "too many attempts", "retry_after_sec": retry_after},
                    status=429,
                )
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                self._record_login_audit(username=None, success=False, reason="invalid json")
                return self._send_json({"error": "invalid json"}, status=400)

            username = str(body.get("username", "")).strip()
            password = str(body.get("password", ""))
            verified_user = self._verify_credentials(username, password)
            if not verified_user:
                self._record_login_audit(username=username or None, success=False, reason="invalid credentials")
                self._record_login_failure(ip)
                is_banned, retry_after = self._is_login_banned(ip)
                if is_banned:
                    return self._send_json(
                        {"error": "too many attempts", "retry_after_sec": retry_after},
                        status=429,
                    )
                return self._send_json({"error": "invalid credentials"}, status=401)

            token = self._create_session_token(verified_user)
            self._clear_login_failures(ip)
            self._record_login_audit(username=verified_user, success=True, reason="login success")
            return self._send_json(
                {"ok": True, "expires_in_sec": max(300, int(self.context.settings.session_ttl_sec))},
                status=200,
                headers={"Set-Cookie": self._session_cookie_header(token)},
            )

        if parsed.path == "/api/auth/change_password":
            if self._bootstrap_required():
                return self._send_json({"error": "bootstrap required"}, status=409)
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            current_password = str(body.get("current_password", ""))
            new_password = str(body.get("new_password", ""))
            if not current_password or not new_password:
                return self._send_json({"error": "current_password and new_password are required"}, status=400)
            if len(new_password) > 128:
                return self._send_json({"error": "new_password too long"}, status=400)
            if hmac.compare_digest(current_password, new_password):
                return self._send_json({"error": "new_password must differ from current_password"}, status=400)

            user = self.context.db.get_user_by_username(operator)
            next_hash = self._hash_secret(new_password)
            if user is not None:
                stored_hash = str(user.get("password_hash") or "")
                if not self._verify_secret(current_password, stored_hash):
                    return self._send_json({"error": "current_password is invalid"}, status=401)
                updated = self.context.db.set_user_password_hash(int(user.get("id")), next_hash)
                if not updated:
                    return self._send_json({"error": "user not found"}, status=404)
            else:
                expected_user, expected_pass = self._expected_credentials()
                if not (expected_user and hmac.compare_digest(operator, expected_user) and self._verify_secret(current_password, expected_pass)):
                    return self._send_json({"error": "current_password is invalid"}, status=401)

            settings = self.context.settings
            expected_user, _ = self._expected_credentials()
            if expected_user and hmac.compare_digest(operator, expected_user):
                settings.basic_auth_pass = next_hash
                self.context.db.set_setting("basic_auth_pass", next_hash)
                email = operator if self._is_valid_email(operator) else None
                self.context.db.upsert_admin_user(username=operator, password_hash=next_hash, email=email)

            return self._send_json({"ok": True, "username": operator, "password_updated": True}, status=200)

        if parsed.path == "/api/auth/logout":
            return self._send_json(
                {"ok": True},
                status=200,
                headers={"Set-Cookie": self._session_cookie_header("", clear=True)},
            )

        if not self._ensure_authorized(parsed.path):
            return

        if parsed.path == "/api/admin/users":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            username = str(body.get("username", "")).strip()
            email = self._normalize_email(body.get("email"))
            new_password = str(body.get("new_password", ""))
            is_admin = bool(body.get("is_admin", False))
            enabled = bool(body.get("enabled", True))

            if not username:
                return self._send_json({"error": "username is required"}, status=400)
            if len(username) > 64:
                return self._send_json({"error": "username too long"}, status=400)
            if not new_password:
                return self._send_json({"error": "new_password is required"}, status=400)
            if len(new_password) > 128:
                return self._send_json({"error": "new_password too long"}, status=400)

            if not email and self._is_valid_email(username):
                email = self._normalize_email(username)
            if email and not self._is_valid_email(email):
                return self._send_json({"error": "email is invalid"}, status=400)

            if self.context.db.get_user_by_username(username):
                return self._send_json({"error": "username already exists"}, status=409)
            if email and self.context.db.get_user_by_email(email):
                return self._send_json({"error": "email already exists"}, status=409)

            try:
                created = self.context.db.create_user(
                    username=username,
                    email=email or None,
                    password_hash=self._hash_secret(new_password),
                    is_admin=is_admin,
                    enabled=enabled,
                )
            except Exception:  # noqa: BLE001
                return self._send_json({"error": "failed to create user"}, status=500)

            return self._send_json(
                {
                    "ok": True,
                    "operator": operator,
                    "user": self._user_payload(created),
                },
                status=201,
            )

        if parsed.path == "/api/auth/invite/create":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            try:
                max_uses = max(1, min(1000, int(body.get("max_uses", 1))))
            except (TypeError, ValueError):
                return self._send_json({"error": "max_uses must be integer >= 1"}, status=400)
            try:
                expires_in_days = max(1, min(180, int(body.get("expires_in_days", 7))))
            except (TypeError, ValueError):
                return self._send_json({"error": "expires_in_days must be integer >= 1"}, status=400)

            now = self._now_utc()
            expires_at = now + timedelta(days=expires_in_days)
            code = ""
            created = None
            for _ in range(6):
                candidate = "INV" + secrets.token_hex(4).upper()
                try:
                    created = self.context.db.create_invite_code(
                        code=candidate,
                        created_by=operator,
                        max_uses=max_uses,
                        expires_at=expires_at,
                        enabled=True,
                    )
                    code = candidate
                    break
                except Exception:  # noqa: BLE001
                    continue

            if not created or not code:
                return self._send_json({"error": "failed to create invite code"}, status=500)

            return self._send_json(
                {
                    "ok": True,
                    "invite_code": code,
                    "max_uses": max_uses,
                    "expires_at": created.get("expires_at"),
                    "created_by": operator,
                },
                status=201,
            )

        if parsed.path == "/api/collect/once":
            collector = self.context.collector
            if collector is None or not hasattr(collector, "collect_once"):
                self._send_json({"error": "collector unavailable"}, status=503)
                return
            payload = collector.collect_once()  # type: ignore[call-arg]
            return self._send_json(payload, status=200)

        if parsed.path == "/api/settings/test_notify":
            try:
                provider_response = self.context.notifier.send_test_message()
            except ValueError as exc:
                message = str(exc)
                status = 400 if "未配置企业微信 Webhook URL" in message else 502
                return self._send_json({"ok": False, "error": message}, status=status)
            response_payload: dict[str, object] = {
                "ok": True,
                "message": "test message sent",
            }
            if isinstance(provider_response, dict):
                response_payload["provider_response"] = provider_response
            elif isinstance(provider_response, str) and provider_response.strip():
                response_payload["provider_response_text"] = provider_response[:240]
            return self._send_json(
                response_payload
            )

        if parsed.path == "/api/backtest/run":
            backtest = getattr(self.context, "backtest", None)
            if backtest is None or not hasattr(backtest, "run"):
                return self._send_json({"error": "backtest service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = backtest.run(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=200)

        if parsed.path == "/api/backtest/compare":
            backtest = getattr(self.context, "backtest", None)
            if backtest is None or not hasattr(backtest, "compare"):
                return self._send_json({"error": "backtest service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = backtest.compare(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=200)

        if parsed.path == "/api/insight/models/discover":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "discover_models"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = insight.discover_models(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=200)

        if parsed.path == "/api/insight/test_ai":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "test_ai_connection"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = insight.test_ai_connection(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=200)

        if parsed.path == "/api/insight/chat/history/clear":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            deleted = self.context.db.clear_insight_chat_messages(operator)
            return self._send_json({"ok": True, "deleted": deleted, "username": operator}, status=200)

        if parsed.path == "/api/insight/chat":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "chat_with_ai"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                chat_body, user_message = self._prepare_chat_payload_for_user(username=operator, body=body)
                payload = insight.chat_with_ai(chat_body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            reply = self._normalize_chat_text((payload or {}).get("reply"), max_chars=6000)
            self._persist_chat_exchange(username=operator, user_message=user_message, assistant_reply=reply)
            return self._send_json(payload, status=200)

        if parsed.path == "/api/insight/chat/stream":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "chat_with_ai_stream"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                chat_body, user_message = self._prepare_chat_payload_for_user(username=operator, body=body)
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)

            self._send_sse_headers(status=200)
            self._persist_chat_exchange(username=operator, user_message=user_message, assistant_reply="")
            try:
                stream_iter = insight.chat_with_ai_stream(chat_body)  # type: ignore[attr-defined]
                reply = ""
                for item in stream_iter:
                    if isinstance(item, dict) and str(item.get("type") or "").strip().lower() == "done":
                        reply = self._normalize_chat_text(item.get("reply"), max_chars=6000)
                    self._send_sse_event(item if isinstance(item, dict) else {"type": "message", "content": str(item)})
                if reply:
                    self._persist_chat_exchange(username=operator, user_message="", assistant_reply=reply)
                self._send_sse_event("[DONE]")
            except ValueError as exc:
                try:
                    self._send_sse_event({"type": "error", "error": str(exc)})
                    self._send_sse_event("[DONE]")
                except (BrokenPipeError, ConnectionResetError):
                    return
            except (BrokenPipeError, ConnectionResetError):
                return
            return

        if parsed.path == "/api/insight/trigger":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "trigger_summary_now"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = insight.trigger_summary_now(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=202)

        if parsed.path == "/api/insight/simulate":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "enqueue_simulation"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = insight.enqueue_simulation(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=202)

        admin_user_reset_segments = [seg for seg in parsed.path.split("/") if seg]
        if len(admin_user_reset_segments) == 5 and admin_user_reset_segments[:3] == ["api", "admin", "users"] and admin_user_reset_segments[4] == "reset_password":
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            try:
                user_id = int(admin_user_reset_segments[3])
            except ValueError:
                return self._send_json({"error": "invalid user id"}, status=400)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            new_password = str(body.get("new_password", ""))
            if not new_password:
                return self._send_json({"error": "new_password is required"}, status=400)
            if len(new_password) > 128:
                return self._send_json({"error": "new_password too long"}, status=400)

            target = self.context.db.get_user_by_id(user_id)
            if target is None:
                return self._send_json({"error": "user not found"}, status=404)

            updated = self.context.db.set_user_password_hash(user_id, self._hash_secret(new_password))
            if not updated:
                return self._send_json({"error": "user not found"}, status=404)
            return self._send_json(
                {
                    "ok": True,
                    "user_id": user_id,
                    "username": target.get("username"),
                    "password_reset": True,
                },
                status=200,
            )

        if parsed.path != "/api/rules":
            self.send_error(404, "Not Found")
            return

        try:
            body = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"error": "invalid json"}, status=400)
            return

        try:
            symbol = str(body["symbol"])
            condition = str(body["condition"])
            threshold = float(body["threshold"])
        except (KeyError, TypeError, ValueError):
            self._send_json({"error": "symbol, condition, threshold are required"}, status=400)
            return

        if condition not in {"gte", "lte"}:
            self._send_json({"error": "condition must be gte/lte"}, status=400)
            return

        logic_operator = str(body.get("logic_operator", "and")).strip().lower()
        if logic_operator not in {"and", "or"}:
            return self._send_json({"error": "logic_operator must be and/or"}, status=400)

        clauses_raw = body.get("clauses")
        if clauses_raw is None:
            clauses_raw = [{"type": "price", "condition": condition, "threshold": threshold}]
            indicator_filter = str(body.get("indicator_filter", "any")).strip().lower()
            indicator_mapping = {
                "bullish_only": "bullish",
                "bearish_only": "bearish",
                "neutral_only": "neutral",
            }
            mapped_bias = indicator_mapping.get(indicator_filter)
            if mapped_bias:
                clauses_raw.append({"type": "indicator_bias", "bias": mapped_bias})
        elif not isinstance(clauses_raw, list):
            return self._send_json({"error": "clauses must be array"}, status=400)

        rule = AlertRule(
            id=None,
            symbol=symbol,
            condition=condition,
            threshold=threshold,
            cooldown_sec=max(1, int(body.get("cooldown_sec", 900))),
            debounce_count=max(1, int(body.get("debounce_count", 2))),
            enabled=bool(body.get("enabled", True)),
            indicator_filter=body.get("indicator_filter"),
            logic_operator=logic_operator,
            clauses=clauses_raw,
        )
        try:
            created = self.context.db.create_rule(rule)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, status=400)
        self._send_json(as_serializable(created), status=201)

    def do_PATCH(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if not self._ensure_authorized(parsed.path):
            return

        if parsed.path == "/api/settings":
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                self._send_json({"error": "invalid json"}, status=400)
                return

            settings = self.context.settings
            restart_required = False
            restart_reasons: list[str] = []
            if "poll_interval_sec" in body:
                try:
                    settings.poll_interval_sec = max(5, int(body["poll_interval_sec"]))
                    self.context.db.set_setting("poll_interval_sec", str(settings.poll_interval_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "poll_interval_sec must be integer >= 5"}, status=400)
                    return

            if "domestic_premium_cny_per_g" in body:
                try:
                    settings.domestic_premium_cny_per_g = float(body["domestic_premium_cny_per_g"])
                    self.context.db.set_setting("domestic_premium_cny_per_g", str(settings.domestic_premium_cny_per_g))
                except (TypeError, ValueError):
                    self._send_json({"error": "domestic_premium_cny_per_g must be numeric"}, status=400)
                    return

            if "enable_console_notifications" in body:
                settings.enable_console_notifications = bool(body["enable_console_notifications"])
                self.context.db.set_setting(
                    "enable_console_notifications",
                    "true" if settings.enable_console_notifications else "false",
                )

            if "wecom_webhook_url" in body:
                raw = str(body["wecom_webhook_url"]).strip()
                valid, error_text = self._validate_wecom_webhook_url(raw)
                if not valid:
                    self._send_json({"error": error_text}, status=400)
                    return
                settings.wecom_webhook_url = raw or None
                self.context.db.set_setting("wecom_webhook_url", raw)

            if "notify_on_trigger" in body:
                settings.notify_on_trigger = bool(body["notify_on_trigger"])
                self.context.db.set_setting("notify_on_trigger", "true" if settings.notify_on_trigger else "false")

            if "notify_on_recover" in body:
                settings.notify_on_recover = bool(body["notify_on_recover"])
                self.context.db.set_setting("notify_on_recover", "true" if settings.notify_on_recover else "false")

            if "notify_on_source" in body:
                settings.notify_on_source = bool(body["notify_on_source"])
                self.context.db.set_setting("notify_on_source", "true" if settings.notify_on_source else "false")

            if "notify_on_heartbeat" in body:
                settings.notify_on_heartbeat = bool(body["notify_on_heartbeat"])
                self.context.db.set_setting("notify_on_heartbeat", "true" if settings.notify_on_heartbeat else "false")

            if "notify_style" in body:
                style = str(body["notify_style"]).strip().lower()
                settings.notify_style = "compact" if style == "compact" else "detailed"
                self.context.db.set_setting("notify_style", settings.notify_style)

            if "notify_title_prefix" in body:
                prefix = str(body["notify_title_prefix"]).strip()
                settings.notify_title_prefix = prefix
                self.context.db.set_setting("notify_title_prefix", prefix)

            if "basic_auth_user" in body:
                username = str(body["basic_auth_user"]).strip()
                settings.basic_auth_user = username
                self.context.db.set_setting("basic_auth_user", username)

            if "basic_auth_pass" in body:
                password = str(body["basic_auth_pass"])
                settings.basic_auth_pass = self._hash_secret(password)
                self.context.db.set_setting("basic_auth_pass", settings.basic_auth_pass)

            if "session_secret" in body:
                secret = str(body["session_secret"])
                settings.session_secret = secret
                self.context.db.set_setting("session_secret", secret)

            if settings.basic_auth_user and settings.basic_auth_pass:
                admin_email = settings.basic_auth_user if self._is_valid_email(settings.basic_auth_user) else None
                self.context.db.upsert_admin_user(
                    username=settings.basic_auth_user,
                    password_hash=settings.basic_auth_pass,
                    email=admin_email,
                )

            if "session_ttl_sec" in body:
                try:
                    settings.session_ttl_sec = max(300, int(body["session_ttl_sec"]))
                    self.context.db.set_setting("session_ttl_sec", str(settings.session_ttl_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "session_ttl_sec must be integer >= 300"}, status=400)
                    return

            if "auth_max_failures" in body:
                try:
                    settings.auth_max_failures = max(2, int(body["auth_max_failures"]))
                    self.context.db.set_setting("auth_max_failures", str(settings.auth_max_failures))
                except (TypeError, ValueError):
                    self._send_json({"error": "auth_max_failures must be integer >= 2"}, status=400)
                    return

            if "auth_window_sec" in body:
                try:
                    settings.auth_window_sec = max(30, int(body["auth_window_sec"]))
                    self.context.db.set_setting("auth_window_sec", str(settings.auth_window_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "auth_window_sec must be integer >= 30"}, status=400)
                    return

            if "auth_ban_sec" in body:
                try:
                    settings.auth_ban_sec = max(10, int(body["auth_ban_sec"]))
                    self.context.db.set_setting("auth_ban_sec", str(settings.auth_ban_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "auth_ban_sec must be integer >= 10"}, status=400)
                    return

            if "smtp_host" in body:
                settings.smtp_host = str(body["smtp_host"]).strip()
                self.context.db.set_setting("smtp_host", settings.smtp_host)

            if "smtp_port" in body:
                try:
                    smtp_port = max(1, int(body["smtp_port"]))
                except (TypeError, ValueError):
                    self._send_json({"error": "smtp_port must be integer >= 1"}, status=400)
                    return
                settings.smtp_port = smtp_port
                self.context.db.set_setting("smtp_port", str(smtp_port))

            if "smtp_user" in body:
                settings.smtp_user = str(body["smtp_user"]).strip()
                self.context.db.set_setting("smtp_user", settings.smtp_user)

            if "smtp_pass" in body:
                settings.smtp_pass = str(body["smtp_pass"])
                self.context.db.set_setting("smtp_pass", settings.smtp_pass)

            if "smtp_from" in body:
                settings.smtp_from = str(body["smtp_from"]).strip()
                self.context.db.set_setting("smtp_from", settings.smtp_from)

            if "smtp_use_tls" in body:
                settings.smtp_use_tls = bool(body["smtp_use_tls"])
                self.context.db.set_setting("smtp_use_tls", "true" if settings.smtp_use_tls else "false")

            if "smtp_use_ssl" in body:
                settings.smtp_use_ssl = bool(body["smtp_use_ssl"])
                self.context.db.set_setting("smtp_use_ssl", "true" if settings.smtp_use_ssl else "false")

            if "bootstrap_code_ttl_sec" in body:
                try:
                    settings.bootstrap_code_ttl_sec = max(120, int(body["bootstrap_code_ttl_sec"]))
                    self.context.db.set_setting("bootstrap_code_ttl_sec", str(settings.bootstrap_code_ttl_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "bootstrap_code_ttl_sec must be integer >= 120"}, status=400)
                    return

            if "bootstrap_code_resend_sec" in body:
                try:
                    settings.bootstrap_code_resend_sec = max(15, int(body["bootstrap_code_resend_sec"]))
                    self.context.db.set_setting("bootstrap_code_resend_sec", str(settings.bootstrap_code_resend_sec))
                except (TypeError, ValueError):
                    self._send_json({"error": "bootstrap_code_resend_sec must be integer >= 15"}, status=400)
                    return

            if "deploy_host" in body:
                deploy_host = str(body["deploy_host"]).strip()
                if not deploy_host:
                    self._send_json({"error": "deploy_host cannot be empty"}, status=400)
                    return
                settings.host = deploy_host
                self.context.db.set_setting("host", deploy_host)
                restart_required = True
                restart_reasons.append("监听地址")

            if "deploy_port" in body:
                try:
                    deploy_port = int(body["deploy_port"])
                except (TypeError, ValueError):
                    self._send_json({"error": "deploy_port must be integer between 1 and 65535"}, status=400)
                    return
                if deploy_port < 1 or deploy_port > 65535:
                    self._send_json({"error": "deploy_port must be integer between 1 and 65535"}, status=400)
                    return
                settings.port = deploy_port
                self.context.db.set_setting("port", str(deploy_port))
                restart_required = True
                restart_reasons.append("监听端口")

            if "deploy_timezone" in body:
                deploy_timezone = str(body["deploy_timezone"]).strip()
                if not deploy_timezone:
                    self._send_json({"error": "deploy_timezone cannot be empty"}, status=400)
                    return
                try:
                    ZoneInfo(deploy_timezone)
                except Exception:  # noqa: BLE001
                    self._send_json({"error": "deploy_timezone is invalid IANA timezone"}, status=400)
                    return
                settings.timezone_name = deploy_timezone
                self.context.db.set_setting("timezone_name", deploy_timezone)
                restart_required = True
                restart_reasons.append("时区")

            if "source_expected_update_sec_map" in body:
                raw_map = body["source_expected_update_sec_map"]
                if not isinstance(raw_map, dict):
                    self._send_json({"error": "source_expected_update_sec_map must be object"}, status=400)
                    return

                allowed = set(self._SOURCE_EXPECTED_UPDATE_SEC.keys())
                unknown = [str(key) for key in raw_map.keys() if str(key) not in allowed]
                if unknown:
                    self._send_json(
                        {"error": f"unknown source names: {', '.join(sorted(unknown))}"},
                        status=400,
                    )
                    return

                normalized: dict[str, int] = {}
                for key, value in raw_map.items():
                    source_name = str(key)
                    try:
                        normalized[source_name] = max(5, int(value))
                    except (TypeError, ValueError):
                        self._send_json({"error": f"invalid expected_update_sec for {source_name}"}, status=400)
                        return

                self.context.db.set_setting(
                    "source_expected_update_sec_map",
                    json.dumps(normalized, ensure_ascii=False, separators=(",", ":")),
                )

            payload = self._settings_payload()
            payload["restart_required"] = restart_required
            if restart_required:
                reason_text = "、".join(dict.fromkeys(restart_reasons))
                payload["restart_notice"] = f"已保存部署参数（{reason_text}），需重启服务后生效。"
            else:
                payload["restart_notice"] = ""
            return self._send_json(payload, status=200)

        if parsed.path == "/api/insight/settings":
            insight = getattr(self.context, "insight", None)
            if insight is None or not hasattr(insight, "patch_settings") or not hasattr(insight, "get_settings_payload"):
                return self._send_json({"error": "insight service unavailable"}, status=503)
            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)
            try:
                payload = insight.patch_settings(body)  # type: ignore[attr-defined]
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)
            return self._send_json(payload, status=200)

        admin_user_segments = [seg for seg in parsed.path.split("/") if seg]
        if len(admin_user_segments) == 4 and admin_user_segments[:3] == ["api", "admin", "users"]:
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            try:
                user_id = int(admin_user_segments[3])
            except ValueError:
                return self._send_json({"error": "invalid user id"}, status=400)

            try:
                body = self._read_json_body()
            except json.JSONDecodeError:
                return self._send_json({"error": "invalid json"}, status=400)

            has_enabled = "enabled" in body
            has_is_admin = "is_admin" in body
            if not has_enabled and not has_is_admin:
                return self._send_json({"error": "enabled or is_admin is required"}, status=400)
            target = self.context.db.get_user_by_id(user_id)
            if target is None:
                return self._send_json({"error": "user not found"}, status=404)
            target_username = str(target.get("username", ""))
            current_enabled = bool(target.get("enabled"))
            current_is_admin = bool(target.get("is_admin"))
            next_enabled = bool(body["enabled"]) if has_enabled else current_enabled
            next_is_admin = bool(body["is_admin"]) if has_is_admin else current_is_admin

            if hmac.compare_digest(target_username, operator):
                if has_enabled and not next_enabled:
                    return self._send_json({"error": "cannot disable current operator"}, status=400)
                if has_is_admin and not next_is_admin:
                    return self._send_json({"error": "cannot remove admin from current operator"}, status=400)

            if current_is_admin and current_enabled and not (next_is_admin and next_enabled):
                if self.context.db.count_enabled_admin_users() <= 1:
                    return self._send_json({"error": "cannot disable last enabled admin"}, status=400)

            if has_enabled and next_enabled != current_enabled:
                updated = self.context.db.set_user_enabled(user_id, next_enabled)
                if not updated:
                    return self._send_json({"error": "user not found"}, status=404)
            if has_is_admin and next_is_admin != current_is_admin:
                updated = self.context.db.set_user_admin(user_id, next_is_admin)
                if not updated:
                    return self._send_json({"error": "user not found"}, status=404)

            refreshed = self.context.db.get_user_by_id(user_id)
            if refreshed is None:
                return self._send_json({"error": "user not found"}, status=404)
            return self._send_json(
                {
                    "ok": True,
                    "user": self._user_payload(refreshed),
                },
                status=200,
            )

        segments = [seg for seg in parsed.path.split("/") if seg]
        if len(segments) != 3 or segments[:2] != ["api", "rules"]:
            self.send_error(404, "Not Found")
            return

        try:
            rule_id = int(segments[2])
        except ValueError:
            self._send_json({"error": "invalid rule id"}, status=400)
            return

        try:
            body = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"error": "invalid json"}, status=400)
            return

        try:
            updated = self.context.db.patch_rule(rule_id, body)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
            return
        if not updated:
            self._send_json({"error": "rule not found"}, status=404)
            return

        self._send_json(as_serializable(updated), status=200)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if not self._ensure_authorized(parsed.path):
            return

        segments = [seg for seg in parsed.path.split("/") if seg]
        if len(segments) == 4 and segments[:3] == ["api", "admin", "users"]:
            operator = self._authenticated_username()
            if not operator:
                return self._send_json({"error": "unauthorized"}, status=401)
            if not self._is_admin_user(operator):
                return self._send_json({"error": "admin privileges required"}, status=403)

            try:
                user_id = int(segments[3])
            except ValueError:
                return self._send_json({"error": "invalid user id"}, status=400)

            target = self.context.db.get_user_by_id(user_id)
            if target is None:
                return self._send_json({"error": "user not found"}, status=404)

            target_username = str(target.get("username") or "")
            if bool(target.get("is_admin")) and bool(target.get("enabled")):
                if self.context.db.count_enabled_admin_users() <= 1:
                    return self._send_json({"error": "cannot delete last enabled admin"}, status=400)
            if hmac.compare_digest(target_username, operator):
                return self._send_json({"error": "cannot delete current operator"}, status=400)

            deleted = self.context.db.delete_user(user_id)
            if not deleted:
                return self._send_json({"error": "user not found"}, status=404)
            return self._send_json(
                {
                    "ok": True,
                    "deleted": True,
                    "user_id": user_id,
                    "username": target_username,
                },
                status=200,
            )

        if len(segments) != 3 or segments[:2] != ["api", "rules"]:
            self.send_error(404, "Not Found")
            return

        try:
            rule_id = int(segments[2])
        except ValueError:
            self._send_json({"error": "invalid rule id"}, status=400)
            return

        deleted = self.context.db.delete_rule(rule_id)
        if not deleted:
            self._send_json({"error": "rule not found"}, status=404)
            return
        self._send_json({"deleted": True, "rule_id": rule_id}, status=200)

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return


class GoldHttpServer(ThreadingHTTPServer):
    def __init__(self, host: str, port: int, context: ApiContext) -> None:
        super().__init__((host, port), GoldRequestHandler)
        GoldRequestHandler.context = context


def run_http_server(host: str, port: int, context: ApiContext) -> GoldHttpServer:
    server = GoldHttpServer(host, port, context)
    print(f"[Server] listening on http://{host}:{port}")
    return server
