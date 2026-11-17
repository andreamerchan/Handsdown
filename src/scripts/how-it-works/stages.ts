// /how-it-works: every step, check list and deliverable is drawn once, in order, when it
// comes into view (data-state="in"); the CSS does the drawing. Order is the point of the
// page, so lists tick in one item after another. With reduced motion the CSS shows
// everything finished and nothing waits on scroll.

import { applyMotionTokens, inView } from "../../motion/core";

/** Share of an element that must be visible before it is drawn. */
const DRAW_RATIO = 0.3;

applyMotionTokens();

for (const el of document.querySelectorAll<HTMLElement>("[data-seq], [data-get]")) {
  inView(el, () => (el.dataset.state = "in"), { ratio: DRAW_RATIO });
}
