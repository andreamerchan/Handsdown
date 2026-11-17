// /how-it-works motion.
//
// The four steps (#steps): on screens tall enough and without reduced motion
// (data-mode="pinned"), the steps are pinned under the header and the scroll plays
// them one at a time. Each step fades and rises in, its three points tick in one by
// one as you keep scrolling, then it hands over to the next step. A four-part bar
// (Describe / Align / Match / Hire, as on Home) fills with the scroll and jumps to a
// step. Everything follows the scroll position, so it plays backwards too.
// Otherwise (data-mode="list") the steps are a plain list.
//
// Everything else ([data-seq], [data-get]: checks, deliverables, timeline) is drawn
// once, in order, when it comes into view (data-state="in"); the CSS does the drawing.

import { applyMotionTokens, clamp, inView, onFrame, prefersReducedMotion, reducedMotionQuery } from "../../motion/core";

/** Share of an element that must be visible before it is drawn. */
const DRAW_RATIO = 0.3;
/** Height of the fixed site header: the stage sticks this far from the top. */
const HEADER_HEIGHT = 74;
/** Pinning needs at least this much viewport height. */
const MIN_PIN_HEIGHT = 560;
/** Scroll kept still at the start and end of the track (share of the track). */
const EDGE = 0.04;
/** Length of the hand-over (in steps): the outgoing step leaves, then the next one arrives. */
const FADE = 0.16;
/** Where in a step (0..1) each point ticks in. */
const POINT_AT = [0.18, 0.32, 0.46];
/** Where in a step a jump from the bar lands: all points already in. */
const LAND_AT = 0.6;

applyMotionTokens();

for (const el of document.querySelectorAll<HTMLElement>("[data-seq], [data-get]")) {
  inView(el, () => (el.dataset.state = "in"), { ratio: DRAW_RATIO });
}

const track = document.querySelector<HTMLElement>("[data-steps-track]");
const stage = track?.querySelector<HTMLElement>(".hiw-steps-stage");
if (track && stage) setUpSteps(track, stage);

function setUpSteps(track: HTMLElement, stage: HTMLElement) {
  const steps = [...track.querySelectorAll<HTMLElement>(".hiw-step")];
  const parts = [...track.querySelectorAll<HTMLElement>(".hiw-bar li")];
  const n = steps.length;

  const pinned = () => track.dataset.mode === "pinned";

  function chooseMode() {
    track.dataset.mode = !prefersReducedMotion() && innerHeight >= MIN_PIN_HEIGHT ? "pinned" : "list";
    if (!pinned()) {
      steps.forEach((step) => step.style.removeProperty("--vis"));
      parts.forEach((part) => part.style.removeProperty("--fill"));
    }
  }

  /** 0..n: how far through the four steps the scroll is. */
  function position() {
    const range = track.offsetHeight - stage.offsetHeight;
    if (range <= 0) return 0;
    const progress = clamp((HEADER_HEIGHT - track.getBoundingClientRect().top) / range);
    return clamp((progress - EDGE) / (1 - 2 * EDGE)) * n;
  }

  onFrame(() => {
    if (!pinned()) return;
    const t = position();
    const current = Math.min(n - 1, Math.floor(t));
    steps.forEach((step, i) => {
      const center = i + 0.5;
      // Fully shown inside its own stretch; the first and last never fade at the ends.
      let vis = clamp((0.5 - Math.abs(t - center)) / FADE);
      if ((i === 0 && t < center) || (i === n - 1 && t > center)) vis = 1;
      step.style.setProperty("--vis", vis.toFixed(3));
      step.style.setProperty("--dir", t < center ? "1" : "-1");
      step.toggleAttribute("data-current", i === current);
      const local = t - i;
      step.querySelectorAll<HTMLElement>("[data-point]").forEach((point, k) => {
        point.toggleAttribute("data-on", local >= POINT_AT[k]);
      });
    });
    parts.forEach((part, i) => {
      part.style.setProperty("--fill", clamp(t - i).toFixed(3));
      part.toggleAttribute("data-current", i === current);
      part.toggleAttribute("data-done", i < current);
    });
  });

  // Bar: jump to a step (all its points in), smooth unless reduced motion.
  track.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-step-go]");
    if (!button) return;
    const index = Number(button.dataset.stepGo);
    if (!pinned()) {
      steps[index].scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      return;
    }
    const range = track.offsetHeight - stage.offsetHeight;
    const progress = EDGE + (1 - 2 * EDGE) * ((index + LAND_AT) / n);
    const trackTop = track.getBoundingClientRect().top + scrollY;
    scrollTo({ top: trackTop - HEADER_HEIGHT + progress * range, behavior: "smooth" });
  });

  chooseMode();
  addEventListener("resize", chooseMode);
  reducedMotionQuery.addEventListener("change", chooseMode);
}
