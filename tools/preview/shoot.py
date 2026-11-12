"""Screenshot the preview at several scroll positions.

Usage: python3 tools/preview/shoot.py <out_dir> [--mobile] [--reduced] [--stops=0,0.1,...] [--full]
Serves dist-preview/ on a local port and captures the viewport at each scroll stop
(fraction of total scroll height). Also prints console errors.
"""
import http.server, socketserver, threading, sys, os, functools, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "dist-preview")
out = sys.argv[1]
mobile = "--mobile" in sys.argv
reduced = "--reduced" in sys.argv
stops_arg = next((a for a in sys.argv if a.startswith("--stops=")), None)
px_arg = next((a for a in sys.argv if a.startswith("--px=")), None)
os.makedirs(out, exist_ok=True)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
Handler.log_message = lambda *a: None
httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    vp = {"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900}
    ctx = browser.new_context(viewport=vp, device_scale_factor=1, reduced_motion="reduce" if reduced else "no-preference")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
    time.sleep(1.5)
    total = page.evaluate("document.documentElement.scrollHeight - innerHeight")
    if px_arg:
        positions = [int(x) for x in px_arg[5:].split(",")]
    else:
        stops = [float(x) for x in stops_arg[8:].split(",")] if stops_arg else [i / 20 for i in range(21)]
        positions = [int(total * s) for s in stops]
    for i, y in enumerate(positions):
        # Scroll in steps so scroll-linked code sees intermediate positions.
        cur = page.evaluate("scrollY")
        steps = 8
        for k in range(1, steps + 1):
            page.evaluate(f"window.scrollTo(0, {cur + (y - cur) * k / steps})")
            time.sleep(0.05)
        time.sleep(1.4)
        page.screenshot(path=os.path.join(out, f"{i:02d}_{y}.png"))
    print("total scroll", total)
    print("errors:", errors[:10])
    browser.close()
httpd.shutdown()
