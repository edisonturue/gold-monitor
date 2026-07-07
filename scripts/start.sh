#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[错误] 未找到可用的 Python 解释器: $PYTHON_BIN"
  echo "请先安装 Python 3，或通过 PYTHON_BIN 指定解释器，例如:"
  echo "  PYTHON_BIN=/usr/bin/python3 ./start"
  exit 1
fi

if [[ ! -f ".env" && -f ".env.example" ]]; then
  cp ".env.example" ".env"
  echo "[提示] 已自动创建 .env（来自 .env.example）。"
fi

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [[ -n "${DB_PATH:-}" ]]; then
  DB_PARENT="$(dirname "$DB_PATH")"
  DB_PATH_WRITABLE=1
  if [[ -d "$DB_PARENT" ]]; then
    if [[ ! -w "$DB_PARENT" ]]; then
      DB_PATH_WRITABLE=0
    fi
  else
    if ! mkdir -p "$DB_PARENT" >/dev/null 2>&1; then
      DB_PATH_WRITABLE=0
    fi
  fi
  if [[ "$DB_PATH_WRITABLE" -eq 0 ]]; then
    FALLBACK_DB_PATH="$ROOT_DIR/data/$(basename "$DB_PATH")"
    echo "[提示] DB_PATH=$DB_PATH 不可写，已自动回退到 $FALLBACK_DB_PATH"
    export DB_PATH="$FALLBACK_DB_PATH"
    mkdir -p "$(dirname "$DB_PATH")"
  fi
fi

echo "[启动] Gold Monitor ..."
exec "$PYTHON_BIN" main.py
