// /how-it-works: the four steps in detail (components/how-it-works/Stages.astro).
//
// Rail      marks the step you're reading (aria-current) and fills the line with how far
//           through the four steps you are. Clicking a step jumps to it.
// Sequence  every list on the page ([data-seq]: steps, checks) and every deliverable
//           ([data-get]: cards, the after-start path) is drawn once, in order, when it comes into view (data-state="in"). The CSS does the drawing.
// With reduced motion the CSS shows everything finished and jumps are instant.

import { applyMotionTokens, clamp, inView, onFrame, prefersReducedMotion } from "../../motion/core";

/** A step counts as "current" once its top passes this line (fraction of the viewport). */
const READING_LINE = 0.4;
/** Share of a list that must be visible before it is drawn. */
const DRAW_RATIO = 0.25;

applyMotionTokens();

const root = document.querySelector<HTMLElement>(".hiw-stages");
if (root) setUp(root);

function setUp(root: HTMLElement) {
  const stages = [...root.querySelectorAll<HTMLElement>(".hiw-stage")];
  const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-rail]")];
  const fill = root.querySelector<HTMLElement>(".hiw-rail-line");

  for (const el of document.querySelectorAll<HTMLElement>("[data-seq], [data-get]")) {
    inView(el, () => (el.dataset.state = "in"), { ratio: DRAW_RATIO });
  }

  let current = -1;
  onFrame(() => {
    const line = innerHeight * READING_LINE;
    let index = 0;
    stages.forEach((stage, i) => {
      if (stage.getBoundingClientRect().top <= line) index = i;
    });
    if (index !== current) {
      current = index;
      links.forEach((link, i) => {
        if (i === index) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
        link.toggleAttribute("data-passed", i < index);
      });
    }
    // Fill: 0 at the top of step 1, 1 when the last step reaches the reading line.
    const first = stages[0].getBoundingClientRect().top;
    const last = stages[stages.length - 1].getBoundingClientRect().top;
    const at = clamp((line - first) / Math.max(1, last - first));
    fill?.style.setProperty("--hiw-at", at.toFixed(4));
  });

  // Same-page jumps (rail and overview): smooth unless reduced motion; keep the URL hash.
  document.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const target = link && document.getElementById(link.hash.slice(1));
    if (!link || !target || !target.classList.contains("hiw-stage")) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", link.hash);
    target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  });
  stages.forEach((stage) => stage.querySelector("h2")?.setAttribute("tabindex", "-1"));
}
