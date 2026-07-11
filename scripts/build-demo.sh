#!/usr/bin/env python3
"""Build static demo for GitHub Pages. Uses Python for precise text manipulation."""
import shutil, tempfile, os, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(tempfile.mkdtemp())
CACHE_BUST = str(int(__import__('time').time()))
print(f"[build-demo] Output: {OUT}")

# Clean _demo/ contents (keep .git) if building directly there
_DEMO = ROOT / "_demo"
if OUT.resolve() == _DEMO.resolve() and _DEMO.exists():
    print("[build-demo] Cleaning _demo/ (keeping .git)...")
    for item in list(_DEMO.iterdir()):
        if item.name != ".git":
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

# Copy static files into cleaned output (preserving .git)
shutil.copytree(str(ROOT / "static"), str(OUT), dirs_exist_ok=True)
(OUT / "mock").mkdir(exist_ok=True)
shutil.copy(str(ROOT / "static/mock/mock.js"), str(OUT / "mock/mock.js"))

# Rewrite /static/ → ./
for html in sorted(OUT.rglob("*.html")):
    content = html.read_text()
    content = content.replace('href="/static/', 'href="./').replace('src="/static/', 'src="./')
    html.write_text(content)

# Inject mock.js before sidebar.js
for fname in ["index.html", "market.html", "ai.html", "system.html"]:
    fp = OUT / fname
    if not fp.exists(): continue
    content = fp.read_text()
    content = content.replace('<script src="./js/sidebar.js', '<script src="./mock/mock.js"></script>\n    <script src="./js/sidebar.js')
    fp.write_text(content)

# Patch sidebar.js: kill ALL redirects + fix nav URLs
sidebar = OUT / "js/sidebar.js"
if sidebar.exists():
    content = sidebar.read_text()
    content = content.replace('"/market"', '"market.html"')
    content = content.replace('"/ai"', '"ai.html"')
    content = content.replace('"/system"', '"system.html"')
    # Kill ALL location.replace
    content = content.replace('window.location.replace("/login")', 'console.warn("demo-noredirect")')
    content = re.sub(r'window\.location\.replace\([^)]+\)', 'console.warn("demo-noredirect")', content)
    sidebar.write_text(content)

# Patch core.js: kill redirect + auto-refresh
core = OUT / "js/core.js"
if core.exists():
    content = core.read_text()
    # Nuke ALL location.replace
    content = content.replace('window.location.replace("/login?reason=expired")', 'console.warn("demo-noredirect")')
    content = re.sub(r'window\.location\.replace\([^)]+\)', 'console.warn("demo-noredirect")', content)
    # Kill auth redirect guard flag so fetchJson never redirects
    content = content.replace('if (!authRedirecting) {', 'if (false) {')
    # Kill scheduleAutoRefresh
    content = content.replace('function scheduleAutoRefresh(sec) {', 'function scheduleAutoRefresh(sec) { return;')
    core.write_text(content)


# Bump cache-busting
for html in OUT.rglob("*.html"):
    content = html.read_text()
    content = re.sub(r'\?v=[0-9]+"', '?v=' + CACHE_BUST + '"', content)
    html.write_text(content)

# Remove auth pages
for f in ["login.html", "register.html", "setup.html", "forgot_password.html"]:
    p = OUT / f
    if p.exists(): p.unlink()

# Verify patches
sb_ok = 'demo-noredirect' in (OUT / "js/sidebar.js").read_text() if (OUT / "js/sidebar.js").exists() else False
co_ok = 'demo-noredirect' in (OUT / "js/core.js").read_text() if (OUT / "js/core.js").exists() else False
print(f"[verify] sidebar.js patched: {sb_ok}")
print(f"[verify] core.js patched: {co_ok}")
print(f"[verify] cache_bust={CACHE_BUST}")
print(f"[build-demo] Done. {len(list(OUT.rglob('*')))} files ready.")
if len(sys.argv) <= 1:
    print(str(OUT))
