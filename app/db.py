from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.models import AlertRule, PriceBar, PriceTick, RuleClause


class Database:
    def __init__(self, db_path: Path) -> None:
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            cursor = self._conn.cursor()
            cursor.executescript(
                """
                CREATE TABLE IF NOT EXISTS price_ticks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    market TEXT NOT NULL,
                    price REAL NOT NULL,
                    currency TEXT NOT NULL,
                    unit TEXT NOT NULL,
                    source TEXT NOT NULL,
                    ts TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_price_ticks_symbol_ts
                    ON price_ticks(symbol, ts DESC);

                CREATE TABLE IF NOT EXISTS price_bars (
                    symbol TEXT NOT NULL,
                    market TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    ts TEXT NOT NULL,
                    open REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    close REAL NOT NULL,
                    volume REAL,
                    source TEXT NOT NULL,
                    PRIMARY KEY(symbol, timeframe, ts)
                );

                CREATE INDEX IF NOT EXISTS idx_price_bars_symbol_ts
                    ON price_bars(symbol, timeframe, ts DESC);

                CREATE TABLE IF NOT EXISTS alert_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    condition TEXT NOT NULL CHECK(condition IN ('gte', 'lte')),
                    threshold REAL NOT NULL,
                    cooldown_sec INTEGER NOT NULL DEFAULT 900,
                    debounce_count INTEGER NOT NULL DEFAULT 2,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    indicator_filter TEXT,
                    logic_operator TEXT NOT NULL DEFAULT 'and',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS alert_rule_clauses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_id INTEGER NOT NULL,
                    clause_order INTEGER NOT NULL,
                    clause_type TEXT NOT NULL,
                    condition TEXT,
                    threshold REAL,
                    bias TEXT,
                    status TEXT,
                    max_age_sec INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(rule_id) REFERENCES alert_rules(id)
                );

                CREATE INDEX IF NOT EXISTS idx_alert_rule_clauses_rule_order
                    ON alert_rule_clauses(rule_id, clause_order ASC);

                CREATE TABLE IF NOT EXISTS rule_state (
                    rule_id INTEGER PRIMARY KEY,
                    consecutive_hits INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'idle',
                    last_alert_at TEXT,
                    last_hit_at TEXT,
                    FOREIGN KEY(rule_id) REFERENCES alert_rules(id)
                );

                CREATE TABLE IF NOT EXISTS alert_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    hit_price REAL NOT NULL,
                    hit_time TEXT NOT NULL,
                    message_id TEXT,
                    payload TEXT,
                    FOREIGN KEY(rule_id) REFERENCES alert_rules(id)
                );

                CREATE TABLE IF NOT EXISTS source_status (
                    source_name TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    status TEXT NOT NULL,
                    last_success_at TEXT,
                    last_error TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(source_name, symbol)
                );

                CREATE TABLE IF NOT EXISTS insight_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    direction TEXT NOT NULL CHECK(direction IN ('up', 'down')),
                    change_pct REAL NOT NULL,
                    window_minutes INTEGER NOT NULL,
                    triggered_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    authoritative_count INTEGER NOT NULL DEFAULT 0,
                    supplemental_count INTEGER NOT NULL DEFAULT 0,
                    confidence REAL,
                    confidence_reason TEXT,
                    summary TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_insight_events_symbol_triggered
                    ON insight_events(symbol, triggered_at DESC);

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    is_admin INTEGER NOT NULL DEFAULT 0,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_users_email
                    ON users(email);

                CREATE TABLE IF NOT EXISTS invite_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    created_by TEXT,
                    max_uses INTEGER NOT NULL DEFAULT 1,
                    used_count INTEGER NOT NULL DEFAULT 0,
                    expires_at TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS register_codes (
                    email TEXT PRIMARY KEY,
                    invite_code TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    sent_at TEXT NOT NULL,
                    failures INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS password_reset_codes (
                    email TEXT PRIMARY KEY,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    sent_at TEXT NOT NULL,
                    failures INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS login_audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    ip TEXT,
                    user_agent TEXT,
                    success INTEGER NOT NULL DEFAULT 0,
                    reason TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_login_audit_created
                    ON login_audit_events(created_at DESC);

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            self._ensure_alert_rule_schema(cursor)
            self._conn.commit()

    @staticmethod
    def _column_exists(cursor: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
        rows = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
        for row in rows:
            if str(row[1]) == column_name:
                return True
        return False

    def _ensure_alert_rule_schema(self, cursor: sqlite3.Cursor) -> None:
        if not self._column_exists(cursor, "alert_rules", "logic_operator"):
            cursor.execute("ALTER TABLE alert_rules ADD COLUMN logic_operator TEXT NOT NULL DEFAULT 'and'")
        cursor.execute(
            """
            UPDATE alert_rules
            SET logic_operator = 'and'
            WHERE logic_operator IS NULL OR trim(logic_operator) = ''
            """
        )

    @staticmethod
    def _iso(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

    @staticmethod
    def _from_iso(value: str) -> datetime:
        return datetime.fromisoformat(value)

    def insert_tick(self, tick: PriceTick) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO price_ticks(symbol, market, price, currency, unit, source, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tick.symbol,
                    tick.market,
                    tick.price,
                    tick.currency,
                    tick.unit,
                    tick.source,
                    self._iso(tick.timestamp),
                ),
            )
            self._conn.commit()

    def upsert_bar(self, bar: PriceBar) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO price_bars(symbol, market, timeframe, ts, open, high, low, close, volume, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, timeframe, ts) DO UPDATE SET
                    market=excluded.market,
                    open=excluded.open,
                    high=excluded.high,
                    low=excluded.low,
                    close=excluded.close,
                    volume=excluded.volume,
                    source=excluded.source
                """,
                (
                    bar.symbol,
                    bar.market,
                    bar.timeframe,
                    self._iso(bar.timestamp),
                    bar.open,
                    bar.high,
                    bar.low,
                    bar.close,
                    bar.volume,
                    bar.source,
                ),
            )
            self._conn.commit()

    def merge_tick_into_daily_bar(self, tick: PriceTick) -> None:
        day_ts = tick.timestamp.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        ts_iso = self._iso(day_ts)

        with self._lock:
            row = self._conn.execute(
                """
                SELECT open, high, low, close FROM price_bars
                WHERE symbol = ? AND timeframe = '1d' AND ts = ?
                """,
                (tick.symbol, ts_iso),
            ).fetchone()

            if row is None:
                self._conn.execute(
                    """
                    INSERT INTO price_bars(symbol, market, timeframe, ts, open, high, low, close, volume, source)
                    VALUES (?, ?, '1d', ?, ?, ?, ?, ?, NULL, ?)
                    """,
                    (tick.symbol, tick.market, ts_iso, tick.price, tick.price, tick.price, tick.price, tick.source),
                )
            else:
                high = max(row["high"], tick.price)
                low = min(row["low"], tick.price)
                self._conn.execute(
                    """
                    UPDATE price_bars
                    SET high = ?, low = ?, close = ?, source = ?
                    WHERE symbol = ? AND timeframe = '1d' AND ts = ?
                    """,
                    (high, low, tick.price, tick.source, tick.symbol, ts_iso),
                )
            self._conn.commit()

    def upsert_many_bars(self, bars: list[PriceBar]) -> None:
        if not bars:
            return
        with self._lock:
            self._conn.executemany(
                """
                INSERT INTO price_bars(symbol, market, timeframe, ts, open, high, low, close, volume, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, timeframe, ts) DO UPDATE SET
                    market=excluded.market,
                    open=excluded.open,
                    high=excluded.high,
                    low=excluded.low,
                    close=excluded.close,
                    volume=excluded.volume,
                    source=excluded.source
                """,
                [
                    (
                        bar.symbol,
                        bar.market,
                        bar.timeframe,
                        self._iso(bar.timestamp),
                        bar.open,
                        bar.high,
                        bar.low,
                        bar.close,
                        bar.volume,
                        bar.source,
                    )
                    for bar in bars
                ],
            )
            self._conn.commit()

    def get_latest_ticks(self, symbols: list[str] | None = None) -> list[dict]:
        with self._lock:
            if symbols:
                placeholders = ",".join("?" for _ in symbols)
                rows = self._conn.execute(
                    f"""
                    SELECT t.symbol, t.market, t.price, t.currency, t.unit, t.source, t.ts
                    FROM price_ticks t
                    JOIN (
                        SELECT symbol, MAX(id) AS max_id
                        FROM price_ticks
                        WHERE symbol IN ({placeholders})
                        GROUP BY symbol
                    ) latest ON latest.symbol = t.symbol AND latest.max_id = t.id
                    ORDER BY t.symbol
                    """,
                    symbols,
                ).fetchall()
            else:
                rows = self._conn.execute(
                    """
                    SELECT t.symbol, t.market, t.price, t.currency, t.unit, t.source, t.ts
                    FROM price_ticks t
                    JOIN (
                        SELECT symbol, MAX(id) AS max_id
                        FROM price_ticks
                        GROUP BY symbol
                    ) latest ON latest.symbol = t.symbol AND latest.max_id = t.id
                    ORDER BY t.symbol
                    """
                ).fetchall()
        return [dict(row) for row in rows]

    def get_latest_tick(self, symbol: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT symbol, market, price, currency, unit, source, ts
                FROM price_ticks
                WHERE symbol = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (symbol,),
            ).fetchone()
        return dict(row) if row else None

    def get_reference_tick(self, symbol: str, target_time: datetime) -> dict | None:
        ts_iso = self._iso(target_time)
        with self._lock:
            row = self._conn.execute(
                """
                SELECT symbol, market, price, currency, unit, source, ts
                FROM price_ticks
                WHERE symbol = ? AND ts <= ?
                ORDER BY ts DESC, id DESC
                LIMIT 1
                """,
                (symbol, ts_iso),
            ).fetchone()
            if row is not None:
                return dict(row)

            fallback = self._conn.execute(
                """
                SELECT symbol, market, price, currency, unit, source, ts
                FROM price_ticks
                WHERE symbol = ? AND ts >= ?
                ORDER BY ts ASC, id ASC
                LIMIT 1
                """,
                (symbol, ts_iso),
            ).fetchone()
        return dict(fallback) if fallback else None

    def get_last_changed_timestamps(
        self,
        symbols: list[str],
        *,
        epsilon: float = 1e-9,
        max_rows_per_symbol: int = 5000,
    ) -> dict[str, str | None]:
        if not symbols:
            return {}

        normalized_symbols = [str(symbol) for symbol in symbols if str(symbol).strip()]
        if not normalized_symbols:
            return {}

        result: dict[str, str | None] = {symbol: None for symbol in normalized_symbols}
        limit = max(10, int(max_rows_per_symbol))

        with self._lock:
            for symbol in normalized_symbols:
                rows = self._conn.execute(
                    """
                    SELECT price, ts
                    FROM price_ticks
                    WHERE symbol = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (symbol, limit),
                ).fetchall()
                if not rows:
                    continue

                latest_price = float(rows[0]["price"])
                last_changed_at = str(rows[0]["ts"])
                for row in rows[1:]:
                    price = float(row["price"])
                    if abs(price - latest_price) > epsilon:
                        break
                    last_changed_at = str(row["ts"])
                result[symbol] = last_changed_at

        return result

    def get_bars(self, symbol: str, timeframe: str, start: datetime, end: datetime) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT symbol, market, timeframe, ts, open, high, low, close, volume, source
                FROM price_bars
                WHERE symbol = ?
                  AND timeframe = ?
                  AND ts >= ?
                  AND ts <= ?
                ORDER BY ts ASC
                """,
                (symbol, timeframe, self._iso(start), self._iso(end)),
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def _normalize_logic_operator(value: str | None) -> str:
        normalized = str(value or "and").strip().lower()
        if normalized not in {"and", "or"}:
            return "and"
        return normalized

    @staticmethod
    def _legacy_clauses(condition: str, threshold: float, indicator_filter: str | None) -> list[RuleClause]:
        clauses: list[RuleClause] = [
            RuleClause(type="price", condition=condition if condition in {"gte", "lte"} else "gte", threshold=float(threshold))
        ]
        indicator_mapping = {
            "bullish_only": "bullish",
            "bearish_only": "bearish",
            "neutral_only": "neutral",
        }
        mapped_bias = indicator_mapping.get(str(indicator_filter or "").strip().lower())
        if mapped_bias:
            clauses.append(RuleClause(type="indicator_bias", bias=mapped_bias))
        return clauses

    @staticmethod
    def _normalize_clause(clause: RuleClause | dict) -> RuleClause:
        if isinstance(clause, RuleClause):
            payload = {
                "type": clause.type,
                "condition": clause.condition,
                "threshold": clause.threshold,
                "bias": clause.bias,
                "status": clause.status,
                "max_age_sec": clause.max_age_sec,
            }
        else:
            payload = dict(clause or {})

        clause_type = str(payload.get("type") or "").strip().lower()
        if clause_type == "price":
            condition = str(payload.get("condition") or "").strip().lower()
            if condition not in {"gte", "lte"}:
                raise ValueError("price clause condition must be gte or lte")
            try:
                threshold = float(payload.get("threshold"))
            except (TypeError, ValueError):
                raise ValueError("price clause threshold must be numeric") from None
            return RuleClause(type="price", condition=condition, threshold=threshold)

        if clause_type == "indicator_bias":
            bias = str(payload.get("bias") or "").strip().lower()
            if bias not in {"bullish", "bearish", "neutral"}:
                raise ValueError("indicator_bias clause bias must be bullish/bearish/neutral")
            return RuleClause(type="indicator_bias", bias=bias)

        if clause_type == "freshness":
            status = str(payload.get("status") or "").strip().lower()
            max_age_sec_raw = payload.get("max_age_sec")
            max_age_sec: int | None = None
            if max_age_sec_raw not in {None, ""}:
                try:
                    max_age_sec = max(0, int(max_age_sec_raw))
                except (TypeError, ValueError):
                    raise ValueError("freshness clause max_age_sec must be integer >= 0") from None
            if status and status not in {"live", "delayed", "cached"}:
                raise ValueError("freshness clause status must be live/delayed/cached")
            if not status and max_age_sec is None:
                raise ValueError("freshness clause requires status or max_age_sec")
            return RuleClause(type="freshness", status=status or None, max_age_sec=max_age_sec)

        raise ValueError("unsupported clause type")

    def _normalize_clauses(self, clauses: list[RuleClause | dict] | None) -> list[RuleClause]:
        if clauses is None:
            return []
        if not isinstance(clauses, list):
            raise ValueError("clauses must be array")
        return [self._normalize_clause(clause) for clause in clauses]

    def _list_rule_clauses_locked(self, rule_ids: list[int]) -> dict[int, list[RuleClause]]:
        if not rule_ids:
            return {}
        placeholders = ",".join("?" for _ in rule_ids)
        rows = self._conn.execute(
            f"""
            SELECT rule_id, clause_order, clause_type, condition, threshold, bias, status, max_age_sec
            FROM alert_rule_clauses
            WHERE rule_id IN ({placeholders})
            ORDER BY rule_id ASC, clause_order ASC, id ASC
            """,
            rule_ids,
        ).fetchall()
        grouped: dict[int, list[RuleClause]] = {rule_id: [] for rule_id in rule_ids}
        for row in rows:
            rule_id = int(row["rule_id"])
            grouped.setdefault(rule_id, []).append(
                RuleClause(
                    type=str(row["clause_type"]),
                    condition=row["condition"],
                    threshold=(float(row["threshold"]) if row["threshold"] is not None else None),
                    bias=row["bias"],
                    status=row["status"],
                    max_age_sec=(int(row["max_age_sec"]) if row["max_age_sec"] is not None else None),
                )
            )
        return grouped

    def _replace_rule_clauses_locked(self, rule_id: int, clauses: list[RuleClause], now_iso: str) -> None:
        self._conn.execute("DELETE FROM alert_rule_clauses WHERE rule_id = ?", (rule_id,))
        if not clauses:
            return
        self._conn.executemany(
            """
            INSERT INTO alert_rule_clauses(
                rule_id, clause_order, clause_type, condition, threshold, bias, status, max_age_sec, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    rule_id,
                    index,
                    clause.type,
                    clause.condition,
                    clause.threshold,
                    clause.bias,
                    clause.status,
                    clause.max_age_sec,
                    now_iso,
                    now_iso,
                )
                for index, clause in enumerate(clauses)
            ],
        )

    def _build_rule_from_row(self, row: sqlite3.Row, clauses: list[RuleClause] | None = None) -> AlertRule:
        normalized_clauses = clauses or self._legacy_clauses(row["condition"], row["threshold"], row["indicator_filter"])
        return AlertRule(
            id=row["id"],
            symbol=row["symbol"],
            condition=row["condition"],
            threshold=row["threshold"],
            cooldown_sec=row["cooldown_sec"],
            debounce_count=row["debounce_count"],
            enabled=bool(row["enabled"]),
            indicator_filter=row["indicator_filter"],
            logic_operator=self._normalize_logic_operator(row["logic_operator"]),
            clauses=normalized_clauses,
        )

    def list_rules(self) -> list[AlertRule]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, symbol, condition, threshold, cooldown_sec, debounce_count, enabled, indicator_filter, logic_operator
                FROM alert_rules
                ORDER BY id ASC
                """
            ).fetchall()
            rule_ids = [int(row["id"]) for row in rows]
            clause_map = self._list_rule_clauses_locked(rule_ids)

        return [self._build_rule_from_row(row, clause_map.get(int(row["id"])) or None) for row in rows]

    def get_rule(self, rule_id: int) -> AlertRule | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, symbol, condition, threshold, cooldown_sec, debounce_count, enabled, indicator_filter, logic_operator
                FROM alert_rules
                WHERE id = ?
                """,
                (rule_id,),
            ).fetchone()
        if row is None:
            return None
        with self._lock:
            clause_map = self._list_rule_clauses_locked([int(row["id"])])
        return self._build_rule_from_row(row, clause_map.get(int(row["id"])) or None)

    def create_rule(self, rule: AlertRule) -> AlertRule:
        now = self._iso(datetime.now(tz=timezone.utc))
        logic_operator = self._normalize_logic_operator(rule.logic_operator)
        normalized_clauses = self._normalize_clauses(rule.clauses)
        if not normalized_clauses:
            normalized_clauses = self._legacy_clauses(rule.condition, rule.threshold, rule.indicator_filter)
        with self._lock:
            cursor = self._conn.execute(
                """
                INSERT INTO alert_rules(symbol, condition, threshold, cooldown_sec, debounce_count, enabled, indicator_filter, logic_operator, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rule.symbol,
                    rule.condition,
                    rule.threshold,
                    rule.cooldown_sec,
                    rule.debounce_count,
                    1 if rule.enabled else 0,
                    rule.indicator_filter,
                    logic_operator,
                    now,
                    now,
                ),
            )
            rule_id = cursor.lastrowid
            self._conn.execute(
                """
                INSERT INTO rule_state(rule_id, consecutive_hits, status)
                VALUES (?, 0, 'idle')
                ON CONFLICT(rule_id) DO NOTHING
                """,
                (rule_id,),
            )
            self._replace_rule_clauses_locked(int(rule_id), normalized_clauses, now)
            self._conn.commit()
        created = self.get_rule(int(rule_id))
        if created is None:
            raise RuntimeError("failed to create rule")
        return created

    def patch_rule(self, rule_id: int, payload: dict) -> AlertRule | None:
        current = self.get_rule(rule_id)
        if current is None:
            return None

        next_symbol = payload.get("symbol", current.symbol)
        next_condition = payload.get("condition", current.condition)
        next_threshold = float(payload.get("threshold", current.threshold))
        next_indicator_filter = payload.get("indicator_filter", current.indicator_filter)
        next_logic_operator = self._normalize_logic_operator(payload.get("logic_operator", current.logic_operator))
        should_rebuild_legacy = any(key in payload for key in ("condition", "threshold", "indicator_filter"))
        if "clauses" in payload:
            next_clauses = self._normalize_clauses(payload.get("clauses"))
        elif should_rebuild_legacy:
            next_clauses = self._legacy_clauses(next_condition, next_threshold, next_indicator_filter)
        else:
            next_clauses = self._normalize_clauses(current.clauses)
        if not next_clauses:
            next_clauses = self._legacy_clauses(next_condition, next_threshold, next_indicator_filter)

        next_rule = AlertRule(
            id=current.id,
            symbol=next_symbol,
            condition=next_condition,
            threshold=next_threshold,
            cooldown_sec=int(payload.get("cooldown_sec", current.cooldown_sec)),
            debounce_count=max(1, int(payload.get("debounce_count", current.debounce_count))),
            enabled=bool(payload.get("enabled", current.enabled)),
            indicator_filter=next_indicator_filter,
            logic_operator=next_logic_operator,
            clauses=next_clauses,
        )

        now = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            self._conn.execute(
                """
                UPDATE alert_rules
                SET symbol = ?, condition = ?, threshold = ?, cooldown_sec = ?, debounce_count = ?, enabled = ?, indicator_filter = ?, logic_operator = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    next_rule.symbol,
                    next_rule.condition,
                    next_rule.threshold,
                    next_rule.cooldown_sec,
                    next_rule.debounce_count,
                    1 if next_rule.enabled else 0,
                    next_rule.indicator_filter,
                    next_rule.logic_operator,
                    now,
                    rule_id,
                ),
            )
            self._replace_rule_clauses_locked(rule_id, next_clauses, now)
            self._conn.commit()
        return self.get_rule(rule_id)

    def delete_rule(self, rule_id: int) -> bool:
        with self._lock:
            existing = self._conn.execute(
                """
                SELECT 1 FROM alert_rules
                WHERE id = ?
                """,
                (rule_id,),
            ).fetchone()
            if existing is None:
                return False

            self._conn.execute(
                """
                DELETE FROM alert_events
                WHERE rule_id = ?
                """,
                (rule_id,),
            )
            self._conn.execute(
                """
                DELETE FROM rule_state
                WHERE rule_id = ?
                """,
                (rule_id,),
            )
            self._conn.execute(
                """
                DELETE FROM alert_rule_clauses
                WHERE rule_id = ?
                """,
                (rule_id,),
            )
            self._conn.execute(
                """
                DELETE FROM alert_rules
                WHERE id = ?
                """,
                (rule_id,),
            )
            self._conn.commit()
            return True

    def get_rule_state(self, rule_id: int) -> dict:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT rule_id, consecutive_hits, status, last_alert_at, last_hit_at
                FROM rule_state
                WHERE rule_id = ?
                """,
                (rule_id,),
            ).fetchone()
            if row is None:
                self._conn.execute(
                    "INSERT INTO rule_state(rule_id, consecutive_hits, status) VALUES (?, 0, 'idle')",
                    (rule_id,),
                )
                self._conn.commit()
                return {
                    "rule_id": rule_id,
                    "consecutive_hits": 0,
                    "status": "idle",
                    "last_alert_at": None,
                    "last_hit_at": None,
                }
        return dict(row)

    def update_rule_state(
        self,
        rule_id: int,
        *,
        consecutive_hits: int,
        status: str,
        last_alert_at: datetime | None,
        last_hit_at: datetime | None,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO rule_state(rule_id, consecutive_hits, status, last_alert_at, last_hit_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(rule_id) DO UPDATE SET
                    consecutive_hits=excluded.consecutive_hits,
                    status=excluded.status,
                    last_alert_at=excluded.last_alert_at,
                    last_hit_at=excluded.last_hit_at
                """,
                (
                    rule_id,
                    consecutive_hits,
                    status,
                    self._iso(last_alert_at) if last_alert_at else None,
                    self._iso(last_hit_at) if last_hit_at else None,
                ),
            )
            self._conn.commit()

    def insert_alert_event(self, rule_id: int, status: str, price: float, hit_time: datetime, payload: str | None = None) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO alert_events(rule_id, status, hit_price, hit_time, payload)
                VALUES (?, ?, ?, ?, ?)
                """,
                (rule_id, status, price, self._iso(hit_time), payload),
            )
            self._conn.commit()

    def list_alert_events(self, limit: int = 100) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, rule_id, status, hit_price, hit_time, message_id, payload
                FROM alert_events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def update_source_status(self, source_name: str, symbol: str, status: str, last_success_at: datetime | None, last_error: str | None) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO source_status(source_name, symbol, status, last_success_at, last_error, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_name, symbol) DO UPDATE SET
                    status=excluded.status,
                    last_success_at=excluded.last_success_at,
                    last_error=excluded.last_error,
                    updated_at=excluded.updated_at
                """,
                (
                    source_name,
                    symbol,
                    status,
                    self._iso(last_success_at) if last_success_at else None,
                    last_error,
                    self._iso(datetime.now(tz=timezone.utc)),
                ),
            )
            self._conn.commit()

    def list_source_status(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT source_name, symbol, status, last_success_at, last_error, updated_at
                FROM source_status
                ORDER BY symbol, source_name
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def list_source_status_for_pairs(self, allowed_pairs: set[tuple[str, str]]) -> list[dict]:
        if not allowed_pairs:
            return []
        rows = self.list_source_status()
        return [row for row in rows if (str(row["source_name"]), str(row["symbol"])) in allowed_pairs]

    def prune_source_status(self, allowed_pairs: set[tuple[str, str]]) -> None:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT source_name, symbol
                FROM source_status
                """
            ).fetchall()
            to_delete: list[tuple[str, str]] = []
            for row in rows:
                pair = (str(row["source_name"]), str(row["symbol"]))
                if pair not in allowed_pairs:
                    to_delete.append(pair)

            if to_delete:
                self._conn.executemany(
                    """
                    DELETE FROM source_status
                    WHERE source_name = ? AND symbol = ?
                    """,
                    to_delete,
                )
                self._conn.commit()

    @staticmethod
    def _user_row_to_dict(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        payload = dict(row)
        payload["is_admin"] = bool(payload.get("is_admin"))
        payload["enabled"] = bool(payload.get("enabled"))
        return payload

    def count_users(self) -> int:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM users
                """
            ).fetchone()
        return int(row["total"]) if row else 0

    def has_admin_user(self) -> bool:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT 1
                FROM users
                WHERE is_admin = 1 AND enabled = 1
                LIMIT 1
                """
            ).fetchone()
        return row is not None

    def get_user_by_username(self, username: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, username, email, password_hash, is_admin, enabled, created_at, updated_at
                FROM users
                WHERE lower(username) = lower(?)
                LIMIT 1
                """,
                (username,),
            ).fetchone()
        return self._user_row_to_dict(row)

    def get_user_by_email(self, email: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, username, email, password_hash, is_admin, enabled, created_at, updated_at
                FROM users
                WHERE lower(email) = lower(?)
                LIMIT 1
                """,
                (email,),
            ).fetchone()
        return self._user_row_to_dict(row)

    def get_user_by_login(self, login: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, username, email, password_hash, is_admin, enabled, created_at, updated_at
                FROM users
                WHERE lower(username) = lower(?) OR (email IS NOT NULL AND lower(email) = lower(?))
                ORDER BY is_admin DESC, id ASC
                LIMIT 1
                """,
                (login, login),
            ).fetchone()
        return self._user_row_to_dict(row)

    def get_user_by_id(self, user_id: int) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, username, email, password_hash, is_admin, enabled, created_at, updated_at
                FROM users
                WHERE id = ?
                LIMIT 1
                """,
                (int(user_id),),
            ).fetchone()
        return self._user_row_to_dict(row)

    def list_users(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, username, email, password_hash, is_admin, enabled, created_at, updated_at
                FROM users
                ORDER BY is_admin DESC, id ASC
                """
            ).fetchall()
        return [item for item in (self._user_row_to_dict(row) for row in rows) if item is not None]

    def count_enabled_admin_users(self) -> int:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM users
                WHERE is_admin = 1 AND enabled = 1
                """
            ).fetchone()
        return int(row["total"]) if row else 0

    def create_user(
        self,
        *,
        username: str,
        password_hash: str,
        email: str | None = None,
        is_admin: bool = False,
        enabled: bool = True,
    ) -> dict:
        now = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            cursor = self._conn.execute(
                """
                INSERT INTO users(username, email, password_hash, is_admin, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    email.strip().lower() if isinstance(email, str) and email.strip() else None,
                    password_hash,
                    1 if is_admin else 0,
                    1 if enabled else 0,
                    now,
                    now,
                ),
            )
            user_id = int(cursor.lastrowid)
            self._conn.commit()
        return {
            "id": user_id,
            "username": username,
            "email": email.strip().lower() if isinstance(email, str) and email.strip() else None,
            "password_hash": password_hash,
            "is_admin": bool(is_admin),
            "enabled": bool(enabled),
            "created_at": now,
            "updated_at": now,
        }

    def seed_admin_user_if_missing(self, *, username: str, password_hash: str, email: str | None = None) -> None:
        if not username or not password_hash:
            return
        with self._lock:
            existing = self._conn.execute(
                """
                SELECT id
                FROM users
                WHERE lower(username) = lower(?)
                LIMIT 1
                """,
                (username,),
            ).fetchone()
            if existing is not None:
                return
            now = self._iso(datetime.now(tz=timezone.utc))
            self._conn.execute(
                """
                INSERT INTO users(username, email, password_hash, is_admin, enabled, created_at, updated_at)
                VALUES (?, ?, ?, 1, 1, ?, ?)
                """,
                (
                    username,
                    email.strip().lower() if isinstance(email, str) and email.strip() else None,
                    password_hash,
                    now,
                    now,
                ),
            )
            self._conn.commit()

    def upsert_admin_user(self, *, username: str, password_hash: str, email: str | None = None) -> None:
        if not username or not password_hash:
            return
        normalized_email = email.strip().lower() if isinstance(email, str) and email.strip() else None
        now = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            existing = self._conn.execute(
                """
                SELECT id
                FROM users
                WHERE lower(username) = lower(?)
                LIMIT 1
                """,
                (username,),
            ).fetchone()
            if existing is None:
                self._conn.execute(
                    """
                    INSERT INTO users(username, email, password_hash, is_admin, enabled, created_at, updated_at)
                    VALUES (?, ?, ?, 1, 1, ?, ?)
                    """,
                    (username, normalized_email, password_hash, now, now),
                )
                self._conn.commit()
                return

            self._conn.execute(
                """
                UPDATE users
                SET email = ?, password_hash = ?, is_admin = 1, enabled = 1, updated_at = ?
                WHERE lower(username) = lower(?)
                """,
                (normalized_email, password_hash, now, username),
            )
            self._conn.commit()

    def set_user_enabled(self, user_id: int, enabled: bool) -> bool:
        now = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            cursor = self._conn.execute(
                """
                UPDATE users
                SET enabled = ?, updated_at = ?
                WHERE id = ?
                """,
                (1 if enabled else 0, now, int(user_id)),
            )
            self._conn.commit()
            return int(cursor.rowcount or 0) > 0

    def set_user_password_hash(self, user_id: int, password_hash: str) -> bool:
        now = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            cursor = self._conn.execute(
                """
                UPDATE users
                SET password_hash = ?, updated_at = ?
                WHERE id = ?
                """,
                (password_hash, now, int(user_id)),
            )
            self._conn.commit()
            return int(cursor.rowcount or 0) > 0

    def insert_login_audit_event(
        self,
        *,
        username: str | None,
        ip: str | None,
        user_agent: str | None,
        success: bool,
        reason: str | None = None,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO login_audit_events(username, ip, user_agent, success, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    ip,
                    user_agent,
                    1 if success else 0,
                    reason or "",
                    self._iso(datetime.now(tz=timezone.utc)),
                ),
            )
            self._conn.commit()

    def list_login_audit_events(self, *, limit: int = 100) -> list[dict]:
        safe_limit = max(1, min(500, int(limit)))
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT id, username, ip, user_agent, success, reason, created_at
                FROM login_audit_events
                ORDER BY id DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        output: list[dict] = []
        for row in rows:
            item = dict(row)
            item["success"] = bool(item.get("success"))
            output.append(item)
        return output

    def create_invite_code(
        self,
        *,
        code: str,
        created_by: str | None,
        max_uses: int,
        expires_at: datetime,
        enabled: bool = True,
    ) -> dict:
        now = self._iso(datetime.now(tz=timezone.utc))
        expires_iso = self._iso(expires_at)
        with self._lock:
            cursor = self._conn.execute(
                """
                INSERT INTO invite_codes(code, created_by, max_uses, used_count, expires_at, enabled, created_at, updated_at)
                VALUES (?, ?, ?, 0, ?, ?, ?, ?)
                """,
                (
                    code,
                    created_by,
                    max(1, int(max_uses)),
                    expires_iso,
                    1 if enabled else 0,
                    now,
                    now,
                ),
            )
            invite_id = int(cursor.lastrowid)
            self._conn.commit()
        return {
            "id": invite_id,
            "code": code,
            "created_by": created_by,
            "max_uses": max(1, int(max_uses)),
            "used_count": 0,
            "expires_at": expires_iso,
            "enabled": bool(enabled),
            "created_at": now,
            "updated_at": now,
        }

    def get_invite_code(self, code: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, code, created_by, max_uses, used_count, expires_at, enabled, created_at, updated_at
                FROM invite_codes
                WHERE code = ?
                LIMIT 1
                """,
                (code,),
            ).fetchone()
        if row is None:
            return None
        payload = dict(row)
        payload["enabled"] = bool(payload.get("enabled"))
        return payload

    def increment_invite_used_count(self, code: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE invite_codes
                SET used_count = used_count + 1,
                    updated_at = ?
                WHERE code = ?
                """,
                (self._iso(datetime.now(tz=timezone.utc)), code),
            )
            self._conn.commit()

    def upsert_register_code(
        self,
        *,
        email: str,
        invite_code: str,
        code_hash: str,
        expires_at: datetime,
        sent_at: datetime,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO register_codes(email, invite_code, code_hash, expires_at, sent_at, failures, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(email) DO UPDATE SET
                    invite_code = excluded.invite_code,
                    code_hash = excluded.code_hash,
                    expires_at = excluded.expires_at,
                    sent_at = excluded.sent_at,
                    failures = 0,
                    updated_at = excluded.updated_at
                """,
                (
                    email.strip().lower(),
                    invite_code,
                    code_hash,
                    self._iso(expires_at),
                    self._iso(sent_at),
                    self._iso(datetime.now(tz=timezone.utc)),
                ),
            )
            self._conn.commit()

    def get_register_code(self, email: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT email, invite_code, code_hash, expires_at, sent_at, failures, updated_at
                FROM register_codes
                WHERE lower(email) = lower(?)
                LIMIT 1
                """,
                (email,),
            ).fetchone()
        return dict(row) if row is not None else None

    def increment_register_code_failures(self, email: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE register_codes
                SET failures = failures + 1,
                    updated_at = ?
                WHERE lower(email) = lower(?)
                """,
                (self._iso(datetime.now(tz=timezone.utc)), email),
            )
            self._conn.commit()

    def delete_register_code(self, email: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                DELETE FROM register_codes
                WHERE lower(email) = lower(?)
                """,
                (email,),
            )
            self._conn.commit()

    def upsert_password_reset_code(
        self,
        *,
        email: str,
        code_hash: str,
        expires_at: datetime,
        sent_at: datetime,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO password_reset_codes(email, code_hash, expires_at, sent_at, failures, updated_at)
                VALUES (?, ?, ?, ?, 0, ?)
                ON CONFLICT(email) DO UPDATE SET
                    code_hash = excluded.code_hash,
                    expires_at = excluded.expires_at,
                    sent_at = excluded.sent_at,
                    failures = 0,
                    updated_at = excluded.updated_at
                """,
                (
                    email.strip().lower(),
                    code_hash,
                    self._iso(expires_at),
                    self._iso(sent_at),
                    self._iso(datetime.now(tz=timezone.utc)),
                ),
            )
            self._conn.commit()

    def get_password_reset_code(self, email: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT email, code_hash, expires_at, sent_at, failures, updated_at
                FROM password_reset_codes
                WHERE lower(email) = lower(?)
                LIMIT 1
                """,
                (email,),
            ).fetchone()
        return dict(row) if row is not None else None

    def increment_password_reset_code_failures(self, email: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE password_reset_codes
                SET failures = failures + 1,
                    updated_at = ?
                WHERE lower(email) = lower(?)
                """,
                (self._iso(datetime.now(tz=timezone.utc)), email),
            )
            self._conn.commit()

    def delete_password_reset_code(self, email: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                DELETE FROM password_reset_codes
                WHERE lower(email) = lower(?)
                """,
                (email,),
            )
            self._conn.commit()

    def get_setting(self, key: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT value FROM app_settings
                WHERE key = ?
                """,
                (key,),
            ).fetchone()
        return None if row is None else str(row["value"])

    def create_insight_event(
        self,
        *,
        symbol: str,
        direction: str,
        change_pct: float,
        window_minutes: int,
        triggered_at: datetime,
        status: str = "queued",
    ) -> int:
        now_iso = self._iso(datetime.now(tz=timezone.utc))
        with self._lock:
            cursor = self._conn.execute(
                """
                INSERT INTO insight_events(
                    symbol, direction, change_pct, window_minutes, triggered_at, status,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    symbol,
                    direction,
                    float(change_pct),
                    int(window_minutes),
                    self._iso(triggered_at),
                    status,
                    now_iso,
                    now_iso,
                ),
            )
            self._conn.commit()
            return int(cursor.lastrowid)

    def update_insight_event(
        self,
        event_id: int,
        *,
        status: str,
        authoritative_count: int | None = None,
        supplemental_count: int | None = None,
        confidence: float | None = None,
        confidence_reason: str | None = None,
        summary: str | None = None,
        result_json: str | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            current = self._conn.execute(
                """
                SELECT authoritative_count, supplemental_count, confidence, confidence_reason, summary, result_json, error
                FROM insight_events
                WHERE id = ?
                """,
                (event_id,),
            ).fetchone()
            if current is None:
                return

            next_authoritative = int(authoritative_count) if authoritative_count is not None else int(current["authoritative_count"])
            next_supplemental = int(supplemental_count) if supplemental_count is not None else int(current["supplemental_count"])
            next_confidence = float(confidence) if confidence is not None else current["confidence"]
            next_confidence_reason = confidence_reason if confidence_reason is not None else current["confidence_reason"]
            next_summary = summary if summary is not None else current["summary"]
            next_result_json = result_json if result_json is not None else current["result_json"]
            next_error = error if error is not None else current["error"]

            self._conn.execute(
                """
                UPDATE insight_events
                SET status = ?, authoritative_count = ?, supplemental_count = ?, confidence = ?,
                    confidence_reason = ?, summary = ?, result_json = ?, error = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    next_authoritative,
                    next_supplemental,
                    next_confidence,
                    next_confidence_reason,
                    next_summary,
                    next_result_json,
                    next_error,
                    self._iso(datetime.now(tz=timezone.utc)),
                    event_id,
                ),
            )
            self._conn.commit()

    def get_latest_insight_event(self, symbol: str, direction: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, symbol, direction, change_pct, window_minutes, triggered_at, status, authoritative_count, supplemental_count,
                       confidence, confidence_reason, summary, result_json, error, created_at, updated_at
                FROM insight_events
                WHERE symbol = ? AND direction = ?
                ORDER BY triggered_at DESC, id DESC
                LIMIT 1
                """,
                (symbol, direction),
            ).fetchone()
        return self._insight_row_to_dict(row)

    def list_insight_events(
        self,
        *,
        limit: int = 50,
        symbol: str | None = None,
        direction: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[dict]:
        safe_limit = max(1, min(200, int(limit)))
        clauses: list[str] = []
        params: list[object] = []
        if symbol:
            clauses.append("symbol = ?")
            params.append(symbol)
        if direction:
            clauses.append("direction = ?")
            params.append(direction)
        if start_at is not None:
            clauses.append("triggered_at >= ?")
            params.append(self._iso(start_at))
        if end_at is not None:
            clauses.append("triggered_at <= ?")
            params.append(self._iso(end_at))
        where_sql = ""
        if clauses:
            where_sql = f"WHERE {' AND '.join(clauses)}"

        with self._lock:
            rows = self._conn.execute(
                f"""
                SELECT id, symbol, direction, change_pct, window_minutes, triggered_at, status, authoritative_count, supplemental_count,
                       confidence, confidence_reason, summary, result_json, error, created_at, updated_at
                FROM insight_events
                {where_sql}
                ORDER BY triggered_at DESC, id DESC
                LIMIT ?
                """,
                (*params, safe_limit),
            ).fetchall()
        return [item for item in (self._insight_row_to_dict(row) for row in rows) if item is not None]

    def get_insight_event(self, event_id: int) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT id, symbol, direction, change_pct, window_minutes, triggered_at, status, authoritative_count, supplemental_count,
                       confidence, confidence_reason, summary, result_json, error, created_at, updated_at
                FROM insight_events
                WHERE id = ?
                """,
                (event_id,),
            ).fetchone()
        return self._insight_row_to_dict(row)

    @staticmethod
    def _insight_row_to_dict(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        payload = dict(row)
        raw_result = payload.get("result_json")
        if isinstance(raw_result, str) and raw_result.strip():
            try:
                payload["result"] = json.loads(raw_result)
            except json.JSONDecodeError:
                payload["result"] = None
        else:
            payload["result"] = None
        return payload

    def set_setting(self, key: str, value: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO app_settings(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value=excluded.value,
                    updated_at=excluded.updated_at
                """,
                (key, value, self._iso(datetime.now(tz=timezone.utc))),
            )
            self._conn.commit()

    def list_settings(self) -> dict[str, str]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT key, value FROM app_settings
                ORDER BY key ASC
                """
            ).fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def close(self) -> None:
        with self._lock:
            self._conn.close()
