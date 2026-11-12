/**
 * Home page motion ("Enfoque": from a vague need to a specific person).
 *
 * One idea runs through the page: things come into focus. Each section uses
 * that idea in its own way, and only where it explains something:
 *
 *   Hero          headline lines come into focus; the network recedes as you leave   (high)
 *   Talent        the grid draws itself; each photo comes into focus                   (calm)
 *   Map story     each reason's headline is set word by word                           (high)
 *   Two ways      a specialist joins your team / a team with its own lead joins        (medium)
 *   How we work   step 1: your sentence becomes a spec (scroll-scrubbed sequence)      (high)
 *   Team photo    the top candidate lands on the photo as a named person              (medium)
 *   Commitments   one line runs through the three promises, start to finish            (calm)
 *   Closing       the prompt invites you in: headline focuses, ring sweeps, chips rise (medium)
 *
 * All values live in tokens.ts. With reduced motion every section shows its
 * finished state (CSS keys off <html data-motion="reduced">).
 */

import {
  applyMotionTokens,
  canFly,
  inView,
  onFrame,
  prefersReducedMotion,
  sectionProgress,
  splitWords,
} from "./core";
import { tokens } from "./tokens";
import { setUpHandoff } from "./sections/handoff";

applyMotionTokens();
const full = !prefersReducedMotion();

/* Hero ------------------------------------------------------------------ */
{
  const headline = document.querySelector<HTMLElement>('.www-net-hero [data-motion="focus-lines"]');
  if (headline) requestAnimationFrame(() => requestAnimationFrame(() => (headline.dataset.focus = "in")));

  const hero = document.querySelector<HTMLElement>(".www-net-hero");
  const stage = hero?.querySelector<HTMLElement>(".www-net-stage");
  const words = hero?.querySelector<HTMLElement>(".www-net-words");
  if (hero && stage && words && full) {
    onFrame(() => {
      const rect = hero.getBoundingClientRect();
      if (rect.bottom < 0) return;
      // 0 at rest, 1 once most of the hero has scrolled away.
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.85)));
      stage.style.scale = String(1 - p * tokens.scroll.heroExitScale);
      stage.style.opacity = String(1 - p * tokens.scroll.heroExitFade);
      stage.style.translate = `0 ${(p * tokens.distance.heroExitLift).toFixed(1)}px`;
      words.style.translate = `0 ${(-p * tokens.distance.heroExitLift * 0.5).toFixed(1)}px`;
    });
  }
}

/* Talent ---------------------------------------------------------------- */
{
  const grid = document.querySelector<HTMLElement>('[data-motion="talent-grid"]');
  if (grid) inView(grid, () => (grid.dataset.state = "in"), { ratio: 0.22 });
}

/* Map story ------------------------------------------------------------- */
{
  const tour = document.querySelector<HTMLElement>("#map-story.www-tour");
  if (tour && full) {
    tour.querySelectorAll<HTMLElement>(".frame h2").forEach(splitWords);
    tour.dataset.kinetic = "";
  }
}

/* Two ways -------------------------------------------------------------- */
document.querySelectorAll<HTMLElement>(".hd-join").forEach((join) => {
  const card = join.closest("article") ?? join;
  inView(card, () => (join.dataset.state = "in"), { ratio: 0.45 });
});

/* Team photo hand-off --------------------------------------------------- */
setUpHandoff();

/* Commitments ----------------------------------------------------------- */
{
  const block = document.querySelector<HTMLElement>(".hd-commit");
  const nodes = [...(block?.querySelectorAll<HTMLElement>(".hd-commit-line i") ?? [])];
  const cards = [...(block?.querySelectorAll<HTMLElement>(".hd-commit-card") ?? [])];
  if (block) {
    const light = (i: number, on: boolean) => {
      nodes[i]?.toggleAttribute("data-lit", on);
      cards[i]?.toggleAttribute("data-lit", on);
    };
    if (!full) cards.forEach((_, i) => light(i, true));
    else {
      // Wide: the line follows the scroll and lights each promise as it passes.
      onFrame(() => {
        if (innerWidth < 768) return;
        const p = sectionProgress(block, tokens.scroll.commitmentsFrom, tokens.scroll.commitmentsTo);
        block.style.setProperty("--p-live", p.toFixed(4));
        cards.forEach((_, i) => light(i, p >= i * 0.5 - 0.001 && p > 0));
      });
      // Narrow: cards are stacked, each lights when it is read.
      cards.forEach((card, i) =>
        inView(card, () => window.innerWidth < 768 && light(i, true), { ratio: 0.6 }),
      );
    }
  }
}

/* Closing --------------------------------------------------------------- */
{
  const closing = document.querySelector<HTMLElement>('[data-motion="invite"]');
  if (closing) inView(closing, () => (closing.dataset.state = "in"), { ratio: 0.3 });
}

// Exposed for quick tuning from the console: window.__motion.tokens
(window as unknown as { __motion: object }).__motion = { tokens, canFly };
