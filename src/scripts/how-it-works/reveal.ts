// /how-it-works: scroll text reveal for the Vetting statement ([data-reveal-text]).
// Every word starts faint (still readable) and turns full as its line passes the reading
// zone, in reading order. It completes by the time the statement reaches the upper middle
// of the screen, so nobody waits to read. Backwards scroll fades it back. Reduced motion
// (or no JS): shown in full.

/** The reveal starts when the statement's top reaches this share of the viewport... */
const START = 0.88;
/** ...and is complete when its bottom reaches this share. */
const END = 0.5;
/** How many words fade at once (softness of the reveal edge). */
const SOFTNESS = 4;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

for (const el of document.querySelectorAll<HTMLElement>("[data-reveal-text]")) setUp(el);

function setUp(el: HTMLElement) {
  // Wrap every word (inside <em> too) so each can fade on its own; spaces stay as text.
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? "").split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const span = document.createElement("span");
            span.className = "hiw-w";
            span.textContent = part;
            words.push(span);
            frag.append(span);
          }
        }
        child.replaceWith(frag);
      } else walk(child);
    }
  };
  walk(el);

  let frame = 0;
  function update() {
    frame = 0;
    const on = !reduced.matches;
    el.toggleAttribute("data-reveal-on", on);
    if (!on) return;
    const r = el.getBoundingClientRect();
    const from = innerHeight * START;
    const to = innerHeight * END;
    // 0 when the top reaches START, 1 when the bottom reaches END.
    const progress = clamp((from - r.top) / (from - to + r.height));
    const head = progress * (words.length + SOFTNESS);
    words.forEach((w, i) => w.style.setProperty("--w", clamp((head - i) / SOFTNESS).toFixed(3)));
  }
  const schedule = () => (frame ||= requestAnimationFrame(update));
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  reduced.addEventListener("change", schedule);
  update();
}
