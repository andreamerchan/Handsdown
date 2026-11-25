"""Builds dist-preview/jess-chat.html: the Jess panel on its own, in one file (videos inlined).
Usage: python3 tools/preview/jess_standalone.py"""
import base64, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
js = (root / "public/jess/jess-panel.js").read_text()
assets = root / "public/jess/widget/assets"
for name, mime in [("avatar-greeting-CKvUuCn3.mp4", "video/mp4"), ("avatar-idle-a-DxCPPLKK.mp4", "video/mp4"),
                   ("avatar-speaking-loop-BvjhnHFE.mp4", "video/mp4"), ("poster-ZcDQn2JZ.jpg", "image/jpeg")]:
    uri = f"data:{mime};base64," + base64.b64encode((assets / name).read_bytes()).decode()
    needle = f"A + '{name}'"
    assert needle in js, needle
    js = js.replace(needle, f"'{uri}'")
js = js.replace("</script", "<\\/script")

page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jess · hiring assistant chat (standalone)</title>
<style>
  :root { --ink: #0f172a; --soft: #475569; --quiet: #94a3b8; --line: rgb(15 23 42 / .1); --brand: #5e6ad2; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif; color: var(--ink); background: #fbfbfd; }
  header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 24px; padding: 16px 32px; background: rgb(251 251 253 / .9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
  header .logo { font-weight: 700; font-size: 20px; letter-spacing: -.02em; }
  header .logo span { color: var(--brand); }
  header nav { flex: 1; display: flex; gap: 20px; color: var(--soft); font-size: 14px; }
  .cta { height: 44px; padding: 0 22px; border-radius: 999px; border: 0; background: var(--ink); color: #fff; font: inherit; font-weight: 500; cursor: pointer; }
  main { max-width: 980px; margin: 0 auto; padding: 56px 32px 96px; }
  .eyebrow { color: var(--brand); font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; }
  h1 { margin: 10px 0 12px; font-size: clamp(36px, 5vw, 56px); line-height: 1.05; letter-spacing: -.03em; }
  h2 { margin: 0 0 6px; font-size: 24px; letter-spacing: -.02em; }
  .lead { max-width: 560px; color: var(--soft); font-size: 17px; }
  .search { display: flex; gap: 6px; max-width: 620px; margin-top: 28px; padding: 6px 6px 6px 22px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px var(--line), 0 12px 30px -18px rgb(20 16 60 / .3); }
  .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 16px; }
  .search button { width: 46px; height: 46px; border-radius: 50%; border: 0; background: var(--ink); color: #fff; cursor: pointer; font-size: 18px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
  .chips button { height: 34px; padding: 0 14px; border-radius: 999px; border: 0; background: #fff; box-shadow: inset 0 0 0 1px var(--line); font: inherit; font-size: 13.5px; cursor: pointer; }
  section { margin-top: 64px; padding-top: 40px; border-top: 1px solid var(--line); }
  .try { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 18px; }
  .try div { padding: 16px 18px; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 1px var(--line); font-size: 14px; color: var(--soft); }
  .try b { display: block; margin-bottom: 4px; color: var(--ink); font-size: 14.5px; }
  .reset { margin-top: 18px; padding: 0; border: 0; background: none; color: var(--brand); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  /* stand-in for the full-screen chat (the real one lives in jess/widget/) */
  .full { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 24px; background: rgb(15 23 42 / .55); }
  .full[hidden] { display: none; }
  .full > div { width: min(560px, 100%); padding: 28px; border-radius: 20px; background: #fff; }
  .full p { color: var(--soft); }
  .full blockquote { margin: 14px 0 20px; padding: 12px 16px; border-radius: 12px; background: #f4f3f8; color: var(--ink); }
</style>
</head>
<body>
<header>
  <div class="logo">hands<span>down</span></div>
  <nav><span>Hire Talent</span><span>How it Works</span><span>Pricing</span></nav>
  <button type="button" class="cta" data-jess aria-haspopup="dialog" aria-expanded="false">Describe your role</button>
</header>
<main>
  <span class="eyebrow">Jess · standalone prototype</span>
  <h1>Describe the role.<br>Jess shapes the request.</h1>
  <p class="lead">This page holds only what the chat needs: the "Describe your role" button, a search box and its suggestion chips. Everything the panel does here is what it does on the site.</p>
  <form class="search"><input type="text" placeholder="e.g. Senior frontend developer" aria-label="Describe the role you're hiring for"><button type="submit" aria-label="Send">&rarr;</button></form>
  <ul class="chips">
    <li><button type="button">Senior backend engineer</button></li>
    <li><button type="button">DevOps &amp; cloud</button></li>
    <li><button type="button">Product designer</button></li>
    <li><button type="button">Data engineer</button></li>
    <li><button type="button">Full-stack squad</button></li>
  </ul>

  <section>
    <h2>Escenarios para probar</h2>
    <p class="lead">Cada caso est&aacute; descrito en el documento de comportamiento. Las conversaciones se guardan en este navegador.</p>
    <div class="try">
      <div><b>1. Primer rol</b>Abre &ldquo;Describe your role&rdquo;, escribe &ldquo;Frontend developer&rdquo; y responde seniority y horas.</div>
      <div><b>2. Otra especialidad</b>Con el request listo, busca &ldquo;Backend developer&rdquo; arriba: Jess pregunta agregar, nueva b&uacute;squeda o cancelar.</div>
      <div><b>3. Misma especialidad</b>Busca &ldquo;Senior frontend engineer&rdquo;: ofrece &ldquo;Add another (2 total)&rdquo;.</div>
      <div><b>4. Editar y quitar</b>En la caja Hiring request usa Edit y Remove. Remove tiene Undo.</div>
      <div><b>5. Nueva b&uacute;squeda</b>Busca &ldquo;Product designer&rdquo; y elige &ldquo;Start a new search&rdquo;. Luego &#8943; &rarr; Saved conversations.</div>
      <div><b>6. Agendar</b>Toca Book a call con un rol incompleto: Jess pide lo que falta, el email y la hora.</div>
      <div><b>7. Clear y Delete</b>Desde &#8943;: ambos confirman y se pueden deshacer. Clear conserva el request.</div>
      <div><b>8. Cerrar y volver</b>Cierra el panel o recarga la p&aacute;gina: retoma donde quedaste.</div>
      <div><b>9. Expand y chat completo</b>Expand agranda el panel. &ldquo;Open full conversation&rdquo; abre el chat completo (aqu&iacute; simulado) y al volver reabre el panel.</div>
    </div>
    <button type="button" class="reset" id="reset">Borrar todas las conversaciones de esta demo</button>
  </section>
</main>

<div class="full" hidden role="dialog" aria-modal="true" aria-labelledby="full-t"><div>
  <h2 id="full-t">Full conversation</h2>
  <p>On the site, the full-screen chat opens here and starts from this message:</p>
  <blockquote id="full-msg"></blockquote>
  <button type="button" class="cta" id="full-back">Go back to the site</button>
</div></div>

<script>
// The site's search boxes (site/prompts.ts): submitting hands the text to Jess; chips fill the field.
document.querySelectorAll('form.search').forEach((form) => {
  const input = form.querySelector('input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    window.dispatchEvent(new CustomEvent('blureffect:open-agent-journey', { detail: { initialMessage: text, requestId: 'hd_' + Date.now().toString(36), presentation: 'immersive' } }));
  });
});
document.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', () => {
  const input = document.querySelector('form.search input'); input.value = b.textContent; input.focus();
}));
// Stand-in for the full-screen chat: shows what it would receive, and reports its views like the real loader.
const full = document.querySelector('.full');
window.addEventListener('blureffect:open-agent-journey', (e) => {
  if (!e.detail || !e.detail.viaJess) return;
  document.getElementById('full-msg').textContent = e.detail.initialMessage || '(no message: an empty conversation)';
  full.hidden = false;
  window.dispatchEvent(new CustomEvent('blureffect:agent-view', { detail: { view: 'immersive' } }));
  document.getElementById('full-back').focus();
});
document.getElementById('full-back').addEventListener('click', () => {
  full.hidden = true;
  window.dispatchEvent(new CustomEvent('blureffect:agent-view', { detail: { view: 'closed' } }));
});
document.getElementById('reset').addEventListener('click', () => {
  if (!window.confirm('Delete every conversation saved by this demo in this browser?')) return;
  try { localStorage.removeItem('hd_jess_conversations_v1'); } catch (err) {}
  location.reload();
});
</script>
<script>
__JESS__
</script>
</body>
</html>
"""
out = root / "dist-preview/jess-chat.html"
out.write_text(page.replace("__JESS__", js))
print(out, round(out.stat().st_size / 1024), "KB")
