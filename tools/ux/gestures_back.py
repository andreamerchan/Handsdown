"""Drives the page with simulated input and records, after each gesture comes to rest,
whether some step's text is fully readable and which one. Mechanics only — not user data."""
import http.server, socketserver, threading, functools, time, sys, json
from playwright.sync_api import sync_playwright
root, label = sys.argv[1], sys.argv[2]
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); H.log_message=lambda *a:None
srv=socketserver.TCPServer(("127.0.0.1",0),H); port=srv.server_address[1]; threading.Thread(target=srv.serve_forever,daemon=True).start()
STATE = """() => {
  const steps=[...document.querySelectorAll('.www-hwws-step')];
  const r = steps.map(s=>{const col=s.querySelector('.www-hww-text');const lines=[...col.children].flatMap(c=>c.tagName==='H3'?[...c.children]:[c]);
    const rect=col.getBoundingClientRect(); const onScreen = rect.bottom>74 && rect.top<innerHeight;
    return onScreen && lines.every(l=>{const cs=getComputedStyle(l);return parseFloat(cs.opacity)>=.95&&(cs.filter==='none'||cs.filter==='')})&&getComputedStyle(s).visibility!=='hidden'&&parseFloat(getComputedStyle(s).opacity)>.95});
  const t=document.querySelector('[data-hwws-track]').getBoundingClientRect();
  return {readable:r, trackTop:t.top, trackBottom:t.bottom};
}"""
def run(pg, gesture, settle=0.35):
    gesture(); time.sleep(settle); return pg.evaluate(STATE)
results={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.goto(f"http://127.0.0.1:{port}/index.html",wait_until="networkidle"); time.sleep(1)
    top=pg.evaluate("document.querySelector('[data-hwws-track]').getBoundingClientRect().top+scrollY")
    def scenario(name, gesture):
        pg.evaluate(f"scrollTo(0,{top}+document.querySelector('[data-hwws-track]').offsetHeight+300)"); time.sleep(0.6)
        rests=[]
        for _ in range(80):
            st=run(pg, gesture)
            if st['trackTop']<900 and st['trackBottom']>74: rests.append(st['readable'])
            if st['trackTop']>900: break
        seen=[any(r[i] for r in rests) for i in range(4)]
        unreadable=sum(1 for r in rests if not any(r))
        results[name]={'rests':len(rests),'rests_without_readable_text':unreadable,'steps_read_at_rest':sum(seen),'seen':seen}
    mouse=lambda n, gap: (lambda: [ (pg.mouse.wheel(0,-100), time.sleep(gap)) for _ in range(n)])
    pg.mouse.move(700,450)
    scenario('wheel, 1 notch per stop', mouse(1,0.02))
    scenario('wheel, 3 notches per stop', mouse(3,0.06))
    scenario('wheel, 6 fast notches per stop', mouse(6,0.03))
    def fling(total):
        def g():
            d=total*0.07; t=0
            while d>1: pg.mouse.wheel(0,-d); time.sleep(0.016); d*=0.93
        return g
    scenario('trackpad flick ~1000px', fling(1000))
    scenario('trackpad flick ~2000px', fling(2000))
    scenario('Page Down', lambda: pg.keyboard.press('PageUp'))
    b.close()
srv.shutdown()
print(label+" (scrolling backwards)"); [print(f"  {k}: {v['steps_read_at_rest']}/4 steps readable at a stop; {v['rests_without_readable_text']}/{v['rests']} stops with no readable text") for k,v in results.items()]
json.dump(results, open(f"gestures-{label}.json","w"))
