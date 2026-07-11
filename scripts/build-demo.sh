#!/usr/bin/env bash
# build-demo.sh — Build static demo for GitHub Pages
# Transforms static/ files: rewrites paths, injects mock layer, creates 404 fallback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-${ROOT}/_demo}"
echo "[build-demo] Output: ${OUT}"

rm -rf "${OUT}"
mkdir -p "${OUT}"

# 1. Copy all static files
cp -R "${ROOT}/static/"* "${OUT}/"
# Also copy mock.js (already in static/mock/ from creation above)
if [ -f "${ROOT}/static/mock/mock.js" ]; then
  mkdir -p "${OUT}/mock"
  cp "${ROOT}/static/mock/mock.js" "${OUT}/mock/mock.js"
fi

# 2. Rewrite /static/ → ./ in all HTML files (for sub-path hosting)
find "${OUT}" -name "*.html" -exec sed -i '' 's|href="/static/|href="./|g; s|src="/static/|src="./|g' {} +

# 3. Inject mock.js script tag into each HTML page (before core.js)
for f in "${OUT}"/index.html "${OUT}"/market.html "${OUT}"/ai.html "${OUT}"/system.html; do
  if [ -f "$f" ]; then
    # Insert <script src="./mock/mock.js"></script> right before the core.js script tag
    sed -i '' 's|<script src="./js/core\.js|<script src="./mock/mock.js"></script>\n    <script src="./js/core.js|' "$f"
    echo "[build-demo] Mock injected: ${f}"
  fi
done

# 4. Create 404.html (clone index.html for SPA fallback)
if [ -f "${OUT}/index.html" ]; then
  cp "${OUT}/index.html" "${OUT}/404.html"
  echo "[build-demo] 404.html created from index.html"
fi

# 5. Remove version cache busters (GitHub Pages handles caching differently)
# But keep them — they're harmless

echo "[build-demo] Done. Files in ${OUT}:"
find "${OUT}" -maxdepth 2 -type f | sort
