#!/usr/bin/env bash
# build-demo.sh — Build static demo for GitHub Pages
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$(mktemp -d)}"
echo "[build-demo] Output: ${OUT}"

rm -rf "${OUT}"
mkdir -p "${OUT}"

cp -R "${ROOT}/static/"* "${OUT}/"
mkdir -p "${OUT}/mock"
cp "${ROOT}/static/mock/mock.js" "${OUT}/mock/mock.js"

# Rewrite /static/ → ./ (GitHub Pages sub-path)
find "${OUT}" -name "*.html" -exec sed -i '' 's|href="/static/|href="./|g; s|src="/static/|src="./|g' {} +

# Inject mock.js BEFORE sidebar.js
for f in "${OUT}"/index.html "${OUT}"/market.html "${OUT}"/ai.html "${OUT}"/system.html; do
  test -f "$f" || continue
  sed -i '' 's|<script src="./js/sidebar\.js|<script src="./mock/mock.js"></script>\n    <script src="./js/sidebar.js|' "$f"
done

# Patch sidebar.js — kill login redirect + fix nav URLs
sed -i '' 's|"/market"|"market.html"|g' "${OUT}/js/sidebar.js"
sed -i '' 's|"/ai"|"ai.html"|g' "${OUT}/js/sidebar.js"
sed -i '' 's|"/system"|"system.html"|g' "${OUT}/js/sidebar.js"
sed -i '' 's|window.location.replace("/login")|console.warn("demo-noredirect")|g' "${OUT}/js/sidebar.js"

# Patch core.js — kill auth-expired redirect + disable auto-refresh
sed -i '' 's|window.location.replace("/login?reason=expired")|console.warn("demo-noredirect")|g' "${OUT}/js/core.js"
sed -i '' 's|function scheduleAutoRefresh(sec) {|function scheduleAutoRefresh(sec) { return; |' "${OUT}/js/core.js"

cp "${OUT}/index.html" "${OUT}/404.html"
rm -f "${OUT}/login.html" "${OUT}/register.html" "${OUT}/setup.html" "${OUT}/forgot_password.html"

echo "[build-demo] Done. ${OUT} ready."
