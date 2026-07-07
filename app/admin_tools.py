from __future__ import annotations

import hmac
from typing import Any

from app.config import Settings
from app.db import Database
from app.server import GoldRequestHandler


def _normalize(value: str | None) -> str:
    return str(value or "").strip()


def _enabled_admin_candidates(db: Database) -> list[str]:
    result: list[str] = []
    for user in db.list_users():
        if not bool(user.get("is_admin")):
            continue
        if not bool(user.get("enabled")):
            continue
        username = _normalize(str(user.get("username") or ""))
        if username:
            result.append(username)
    return result[:10]


def reset_account_password(
    *,
    db: Database,
    settings: Settings,
    account: str,
    new_password: str,
) -> dict[str, Any]:
    account_value = _normalize(account)
    if not account_value:
        return {"ok": False, "code": "account_required", "message": "account is required"}

    password_value = str(new_password or "")
    if not password_value:
        return {"ok": False, "code": "new_password_required", "message": "new_password is required"}
    if len(password_value) > 128:
        return {"ok": False, "code": "new_password_too_long", "message": "new_password too long"}

    user = db.get_user_by_login(account_value)
    if user is None:
        return {
            "ok": False,
            "code": "account_not_found",
            "message": "account not found",
            "admin_candidates": _enabled_admin_candidates(db),
        }

    user_id = int(user.get("id"))
    username = _normalize(str(user.get("username") or ""))
    password_hash = GoldRequestHandler._hash_secret(password_value)
    updated = db.set_user_password_hash(user_id, password_hash)
    if not updated:
        return {"ok": False, "code": "update_failed", "message": "failed to update password"}

    configured_user = _normalize(db.get_setting("basic_auth_user")) or _normalize(settings.basic_auth_user)
    updated_basic_auth_pass = False
    if configured_user and hmac.compare_digest(configured_user.lower(), username.lower()):
        db.set_setting("basic_auth_pass", password_hash)
        updated_basic_auth_pass = True

    return {
        "ok": True,
        "code": "password_updated",
        "username": username,
        "email": _normalize(str(user.get("email") or "")),
        "updated_basic_auth_pass": updated_basic_auth_pass,
    }
