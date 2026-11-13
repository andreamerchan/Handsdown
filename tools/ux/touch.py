"""Phone (390x844, touch): CDP touch flicks through 'How we work' (stacked layout). After each
flick comes to rest, counts step-text lines that are on screen but still faded (<.95 opacity)."""
import http.server, socketserver, threading, functools, time, sys
from playwright.sync_api import sync_playwright
root, label = sys.argv[1], sys.argv[2]
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); H.log_message=lambda *a:None
srv=socketserver.TCPServer(("127.0.0.1",0),H); port=srv.server_address[1]; threading.Thread(target=srv.serve_forever,daemon=True).start()
CHECK="""() => {const sec=document.querySelector('.www-hwws'); const r=sec.getBoundingClientRect();
 const lines=[...document.querySelectorAll('.www-hww-text')].flatMap(col=>[...col.children].flatMap(c=>c.tagName==='H3'?[...c.children]:[c]));
 const vis=lines.filter(l=>{const b=l.getBoundingClientRect();return b.bottom>60&&b.top<innerHeight-1});
 const faded=vis.filter(l=>parseFloat(getComputedStyle(l).opacity)<.95);
 return {inSection:r.top<innerHeight&&r.bottom>0, visible:vis.length, faded:faded.length, layout:sec.dataset.layout}}"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True,device_scale_factor=2)
    pg=ctx.new_page(); pg.goto(f"http://127.0.0.1:{port}/index.html",wait_until="networkidle"); time.sleep(1)
    pg.mouse.move(195,500)
    top=pg.evaluate("document.querySelector('.www-hwws').getBoundingClientRect().top+scrollY")
    for dist,speed in [(600,1200),(1400,3000)]:
        pg.evaluate(f"scrollTo(0,{top}-900)"); time.sleep(0.5)
        stops=0; faded_stops=0; faded_lines=0
        for _ in range(40):
            d=dist*0.07
            while d>1: pg.mouse.wheel(0,d); time.sleep(0.016); d*=0.93
            time.sleep(0.5)
            st=pg.evaluate(CHECK)
            if not st['inSection']:
                if stops: break
                continue
            stops+=1
            if st['faded']: faded_stops+=1; faded_lines+=st['faded']
        print(f"{label} [{st['layout']}] momentum scroll ~{dist}px (wheel-emulated; touch not available headless): {faded_stops}/{stops} stops showed faded step text on screen ({faded_lines} lines)")
    b.close()
srv.shutdown()
