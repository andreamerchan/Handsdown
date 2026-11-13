"""Samples the pinned 'How we work' section every 8px and records, per position:
which step's text is fully readable (all lines opacity >= .95, no blur), which
illustration is shown, and whether they match. Writes JSON for comparison."""
import http.server, socketserver, threading, functools, time, sys, json
from playwright.sync_api import sync_playwright
root, out, vw, vh = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); H.log_message=lambda *a:None
srv=socketserver.TCPServer(("127.0.0.1",0),H); port=srv.server_address[1]; threading.Thread(target=srv.serve_forever,daemon=True).start()
JS = """async (y) => {
  scrollTo(0, y);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const steps = [...document.querySelectorAll('.www-hwws-step')];
  const readable = steps.map(s => {
    const col = s.querySelector('.www-hww-text');
    const lines = [...col.children].flatMap(c => c.tagName === 'H3' ? [...c.children] : [c]);
    const ok = lines.every(l => { const cs = getComputedStyle(l); return parseFloat(cs.opacity) >= 0.95 && (cs.filter === 'none' || cs.filter === '') ; });
    const stepVisible = getComputedStyle(s).visibility !== 'hidden' && parseFloat(getComputedStyle(s).opacity) > 0.95;
    return ok && stepVisible;
  });
  const shown = steps.findIndex(s => s.hasAttribute('data-shown'));
  return { readable, shown };
}"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":vw,"height":vh})
    pg.goto(f"http://127.0.0.1:{port}/index.html",wait_until="networkidle"); time.sleep(1)
    info = pg.evaluate("(()=>{const t=document.querySelector('[data-hwws-track]');const st=document.querySelector('[data-hwws-stage]');return {top:t.getBoundingClientRect().top+scrollY, h:t.offsetHeight, sh:st.offsetHeight, layout:document.querySelector('.www-hwws').dataset.layout}})()")
    start = int(info['top'] - 74 - vh)   # stage still entering
    end = int(info['top'] - 74 + info['h'] - info['sh'] + 200)
    samples=[]
    for y in range(start, end, 8):
        r = pg.evaluate(JS, y); r['y']=y - (info['top']-74); samples.append(r)
    json.dump({'info':info,'vh':vh,'samples':samples}, open(out,'w'))
    print(info)
    b.close()
srv.shutdown()
