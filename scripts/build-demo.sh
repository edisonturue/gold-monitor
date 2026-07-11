#!/usr/bin/env bash
# build-demo.sh — Build static demo for GitHub Pages
# Default: use temp dir (no leftover in workspace). Pass a path to override.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$(mktemp -d)}"
echo "[build-demo] Output: ${OUT}"

# Always start clean
rm -rf "${OUT}"
mkdir -p "${OUT}"

# 1. Copy all static files
cp -R "${ROOT}/static/"* "${OUT}/"
mkdir -p "${OUT}/mock"
cp "${ROOT}/static/mock/mock.js" "${OUT}/mock/mock.js"

# 2. Rewrite /static/ → ./ for HTML (GitHub Pages sub-path)
find "${OUT}" -name "*.html" -exec sed -i '' 's|href="/static/|href="./|g; s|src="/static/|src="./|g' {} +

# 3. Inject mock.js before core.js
for f in "${OUT}"/index.html "${OUT}"/market.html "${OUT}"/ai.html "${OUT}"/system.html; do
  test -f "$f" || continue
  sed -i '' 's|<script src="./js/core\.js|<script src="./mock/mock.js"></script>\n    <script src="./js/core.js|' "$f"
done

# 4. Patch sidebar.js: navigation URLs must be relative (no leading /)
SIDEBAR="${OUT}/js/sidebar.js"
if [ -f "$SIDEBAR" ]; then
  sed -i '' 's|"/market"|"market.html"|g' "$SIDEBAR"
  sed -i '' 's|"/ai"|"ai.html"|g' "$SIDEBAR"
  sed -i '' 's|"/system"|"system.html"|g' "$SIDEBAR"
  sed -i '' 's|location\.replace("/login")|location.replace("index.html")|g' "$SIDEBAR"
  sed -i '' 's|href="/logout"|href="#" onclick="return false"|g' "$SIDEBAR"
fi

# 5. Patch core.js: suppress auth-expired redirect
CORE="${OUT}/js/core.js"
if [ -f "$CORE" ]; then
  sed -i '' 's|location.replace("/login?reason=expired")|console.warn("[Demo] No redirect")|g' "$CORE"
fi

# 6. SPA fallback + remove auth pages
cp "${OUT}/index.html" "${OUT}/404.html"
rm -f "${OUT}/login.html" "${OUT}/register.html" "${OUT}/setup.html" "${OUT}/forgot_password.html"

echo "[build-demo] Done. ${OUT} ready."
