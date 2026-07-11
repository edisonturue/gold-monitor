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

# 3. CRITICAL: Inject mock.js BEFORE sidebar.js.
#    loadSidebarUser() calls fetch("/api/settings") on page load.
#    If mock.js hasn't patched window.fetch yet → real HTTP 404 → redirect loop.
for f in "${OUT}"/index.html "${OUT}"/market.html "${OUT}"/ai.html "${OUT}"/system.html; do
  test -f "$f" || continue
  sed -i '' 's|<script src="./js/sidebar\.js|<script src="./mock/mock.js"></script>\n    <script src="./js/sidebar.js|' "$f"
done

# 4. Patch sidebar.js
SIDEBAR="${OUT}/js/sidebar.js"
if [ -f "$SIDEBAR" ]; then
  # Navigation: relative URLs (no leading /)
  sed -i '' 's|"/market"|"market.html"|g' "$SIDEBAR"
  sed -i '' 's|"/ai"|"ai.html"|g' "$SIDEBAR"
  sed -i '' 's|"/system"|"system.html"|g' "$SIDEBAR"
  # Login redirect → go to index instead
  sed -i '' 's|location\.replace("/login")|location.replace("index.html")|g' "$SIDEBAR"
  # Logout link
  sed -i '' 's|href="/logout"|href="#" onclick="return false"|g' "$SIDEBAR"
  # SAFETY: suppress redirect in catch handler when mock fetch fails
  sed -i '' 's|if (avatarEl.textContent === "?") {|if (window.__DEMO_MODE__) return;\n          if (avatarEl.textContent === "?") {|' "$SIDEBAR"
fi

# 5. Patch core.js
CORE="${OUT}/js/core.js"
if [ -f "$CORE" ]; then
  sed -i '' 's|location.replace("/login?reason=expired")|console.warn("[Demo] No redirect")|g' "$CORE"
  sed -i '' 's|function scheduleAutoRefresh(sec) {|function scheduleAutoRefresh(sec) {\n  if (window.__DEMO_MODE__) { return; }|' "$CORE"
fi

# 6. SPA fallback + remove auth pages
cp "${OUT}/index.html" "${OUT}/404.html"
rm -f "${OUT}/login.html" "${OUT}/register.html" "${OUT}/setup.html" "${OUT}/forgot_password.html"

echo "[build-demo] Done. ${OUT} ready."
