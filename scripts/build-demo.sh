#!/usr/bin/env bash
# build-demo.sh — Build static demo for GitHub Pages
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$(mktemp -d)}"
echo "[build-demo] Output: ${OUT}"

rm -rf "${OUT}"
mkdir -p "${OUT}"

# 1. Copy all static files
cp -R "${ROOT}/static/"* "${OUT}/"
mkdir -p "${OUT}/mock"
cp "${ROOT}/static/mock/mock.js" "${OUT}/mock/mock.js"

# 2. Rewrite /static/ → ./ for HTML (GitHub Pages sub-path)
find "${OUT}" -name "*.html" -exec sed -i '' 's|href="/static/|href="./|g; s|src="/static/|src="./|g' {} +

# 3. Inject mock.js BEFORE sidebar.js
for f in "${OUT}"/index.html "${OUT}"/market.html "${OUT}"/ai.html "${OUT}"/system.html; do
  test -f "$f" || continue
  sed -i '' 's|<script src="./js/sidebar\.js|<script src="./mock/mock.js"></script>\n    <script src="./js/sidebar.js|' "$f"
done

# 4. NUKED: sidebar.js — every possible redirect turned into harmless warn()
SIDEBAR="${OUT}/js/sidebar.js"
if [ -f "$SIDEBAR" ]; then
  # Navigation URLs: relative (no leading /)
  sed -i '' 's|"/market"|"market.html"|g' "$SIDEBAR"
  sed -i '' 's|"/ai"|"ai.html"|g' "$SIDEBAR"
  sed -i '' 's|"/system"|"system.html"|g' "$SIDEBAR"
  # location.replace("/login") → console.warn("/login")  (safe)
  sed -i '' 's|window.location.replace(|window.console.warn(|g' "$SIDEBAR"
  # Cross-page navigation → just hash (all tabs exist in index.html)
  sed -i '' 's|window.location.href = targetPage + "#" + tabLink|window.location.hash = "#" + tabLink|' "$SIDEBAR"
  # Logout → NOP
  sed -i '' 's|href="/logout"|href="#" onclick="return false"|g' "$SIDEBAR"
fi

# 5. NUKED: core.js
CORE="${OUT}/js/core.js"
if [ -f "$CORE" ]; then
  # location.replace → console.warn (safe)
  sed -i '' 's|window.location.replace(|window.console.warn(|g' "$CORE"
  # Auto-refresh timer → return immediately
  sed -i '' 's|function scheduleAutoRefresh(sec) {|function scheduleAutoRefresh(sec) { return; |' "$CORE"
fi

# 6. SPA fallback + remove auth pages
cp "${OUT}/index.html" "${OUT}/404.html"
rm -f "${OUT}/login.html" "${OUT}/register.html" "${OUT}/setup.html" "${OUT}/forgot_password.html"

echo "[build-demo] Done. ${OUT} ready."
