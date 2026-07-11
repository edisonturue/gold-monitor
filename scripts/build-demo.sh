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

# Clean & copy
if OUT.exists(): shutil.rmtree(OUT)
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

# Write 404.html fallback that redirects to index
_404 = """<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/gold-monitor/">
<title>金价监控台</title>
<style>
body{margin:0;padding:0;background:#070910;color:#E8ECF4;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center}
h1{font-size:72px;font-weight:700;margin:0;color:rgba(212,168,67,0.3);line-height:1}
p{font-size:14px;color:#8896B0;margin:12px 0 24px}
a{color:#D4A843;text-decoration:none;font-weight:500;font-size:13px}
a:hover{text-decoration:underline}
</style>
</head>
<body><div class="card"><h1>404</h1><p>正在跳转至首页...</p><a href="./">返回首页</a></div></body>
</html>"""
(OUT / "404.html").write_text(_404)

# Bump cache-busting
for html in OUT.rglob("*.html"):
    content = html.read_text()
    content = re.sub(r'\?v=[0-9]+"', '?v=' + CACHE_BUST + '"', content)
    html.write_text(content)

# SPA fallback via 404 already done above
# Remove auth pages
for f in ["login.html", "register.html", "setup.html", "forgot_password.html"]:
    p = OUT / f
    if p.exists(): p.unlink()

# Verify patches
print(f"[verify] 404.html: {(OUT / '404.html').exists()}")
sb_ok = 'demo-noredirect' in (OUT / "js/sidebar.js").read_text() if (OUT / "js/sidebar.js").exists() else False
co_ok = 'demo-noredirect' in (OUT / "js/core.js").read_text() if (OUT / "js/core.js").exists() else False
print(f"[verify] sidebar.js patched: {sb_ok}")
print(f"[verify] core.js patched: {co_ok}")
print(f"[verify] cache_bust={CACHE_BUST}")
print(f"[build-demo] Done. {len(list(OUT.rglob('*')))} files ready.")
if len(sys.argv) <= 1:
    print(str(OUT))
