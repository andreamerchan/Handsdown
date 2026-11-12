/**
 * "How we work", step 1: a sentence becomes a spec.
 *
 * Purpose: show cause and effect. The visitor's own words ("senior data
 * scientist", "machine learning", "US hours") are lifted out of the request
 * and land in the fields of the spec, which then gets the part only we add:
 * how each requirement will be tested.
 *
 * The sequence is a pure function of progress (0..1), so it can be driven by
 * scroll (pinned layout), by a timer (small screens) or jumped to the end
 * (reduced motion).
 *
 *   0.00-0.30  the request is typed
 *   0.30-0.40  key phrases light up, the link to the card draws
 *   0.38-0.83  each phrase flies into its field; the field comes into focus and is checked
 *   0.71-0.89  "Tested by" (our part) comes in and is checked
 *   0.80-0.98  a scan passes over the finished spec
 */

import { easeInOut, lerp, range, smoothstep } from "../core";
import { tokens } from "../tokens";

const TYPE_END = 0.3;
const FLIGHT_START = 0.38;
const FLIGHT_GAP = 0.11;
const FLIGHT_LENGTH = 0.12;
/** Pixels the flying phrase swings to the right at mid-flight (so it never covers the request). */
const FLIGHT_ARC = 28;

export interface SpecSequence {
  render(progress: number): void;
  /** Plays the whole sequence on a timer; returns a function that rewinds it. */
  autoplay(): () => void;
}

export function createSpecSequence(picture: HTMLElement): SpecSequence | null {
  const bubble = picture.querySelector<HTMLElement>("[data-spec-bubble]");
  const rows = [...picture.querySelectorAll<HTMLElement>(".www-hww-row")];
  const card = picture.querySelector<HTMLElement>(".www-hww-card");
  const scan = picture.querySelector<HTMLElement>(".www-hww-scan");
  if (!bubble || !rows.length || !card) return null;

  // The request is typed segment by segment so the <mark>s survive.
  const segments: { set: (n: number) => void; length: number }[] = [];
  for (const node of [...bubble.childNodes]) {
    const full = node.textContent ?? "";
    if (node.nodeType === Node.TEXT_NODE) {
      segments.push({ length: full.length, set: (n) => (node.textContent = full.slice(0, n)) });
    } else if (node instanceof HTMLElement) {
      segments.push({ length: full.length, set: (n) => (node.textContent = full.slice(0, n)) });
    }
  }
  const totalChars = segments.reduce((sum, s) => sum + s.length, 0);
  const caret = document.createElement("span");
  caret.className = "hd-caret";
  caret.setAttribute("aria-hidden", "true");
  bubble.append(caret);

  const marks = [...bubble.querySelectorAll<HTMLElement>("mark")];
  const fullMarkText = marks.map((m) => m.textContent ?? "");
  const ghosts = fullMarkText.map((text) => {
    const ghost = document.createElement("span");
    ghost.className = "hd-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = text;
    picture.append(ghost);
    return ghost;
  });

  picture.dataset.scrub = "";
  let last = -1;
  let typed = -1;

  const render = (p: number) => {
    if (Math.abs(p - last) < 0.0004) return;
    last = p;

    // Typing.
    const chars = Math.round(totalChars * range(0, TYPE_END, p));
    if (chars !== typed) {
      typed = chars;
      let left = chars;
      for (const segment of segments) {
        const n = Math.min(left, segment.length);
        segment.set(n);
        left -= n;
      }
      bubble.append(caret);
    }
    caret.style.opacity = p < TYPE_END + 0.04 ? "1" : "0";

    // Phrases light up, link draws.
    marks.forEach((mark, i) =>
      mark.style.setProperty("--hl", String(smoothstep(0.3 + i * 0.025, 0.36 + i * 0.025, p))),
    );
    picture.style.setProperty("--link", String(range(0.3, 0.38, p)));
    picture.style.setProperty("--arrow", String(smoothstep(0.36, 0.4, p)));

    // Rows: appear, receive their value, get checked.
    rows.forEach((row, i) => {
      const start = FLIGHT_START + i * FLIGHT_GAP;
      const land = start + FLIGHT_LENGTH;
      row.style.setProperty("--in", String(smoothstep(start - 0.05, start + 0.02, p)));
      row.style.setProperty("--val", String(smoothstep(land - 0.03, land + 0.015, p)));
      row.style.setProperty("--done", String(smoothstep(land + 0.015, land + 0.05, p)));
    });

    // Flights: phrase -> field.
    const box = picture.getBoundingClientRect();
    ghosts.forEach((ghost, i) => {
      const start = FLIGHT_START + i * FLIGHT_GAP;
      const t = range(start, start + FLIGHT_LENGTH, p);
      if (t <= 0 || t >= 1 || !rows[i]) {
        ghost.style.opacity = "0";
        return;
      }
      const from = marks[i].getBoundingClientRect();
      const to = rows[i].querySelector("dd")?.getBoundingClientRect() ?? from;
      const e = easeInOut(t);
      const x = lerp(from.left, to.left, e) - box.left + Math.sin(Math.PI * t) * FLIGHT_ARC;
      const y = lerp(from.top, to.top, e) - box.top;
      ghost.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      ghost.style.opacity = String(Math.min(1, t * 8, (1 - t) * 6));
    });

    // Scan over the finished card.
    if (scan) {
      const s = range(0.8, 0.98, p);
      scan.style.setProperty("--scan-y", `${(s * (card.offsetHeight - 60)).toFixed(1)}px`);
      scan.style.setProperty("--scan-o", String(Math.sin(Math.PI * s)));
    }
  };

  const autoplay = () => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startedAt) / tokens.scroll.specSequenceAutoplay);
      render(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      render(0);
    };
  };

  render(0);
  return { render, autoplay };
}
