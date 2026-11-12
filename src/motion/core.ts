/**
 * Small motion runtime shared by every section (no dependencies).
 *
 * - `applyMotionTokens()` mirrors tokens.ts into CSS custom properties and
 *   marks <html data-motion="full|reduced">, which the stylesheet keys off.
 * - `onFrame()` runs callbacks on one shared requestAnimationFrame, only
 *   when the page scrolls or resizes (no idle loop).
 * - `inView()` and `sectionProgress()` are the two ways a section learns where it is.
 */

import { tokens } from "./tokens";

export const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
export const wideQuery = matchMedia(`(min-width: ${tokens.breakpoints.flight}px)`);

export const prefersReducedMotion = () => reducedMotionQuery.matches;
export const canFly = () => !prefersReducedMotion() && wideQuery.matches;

export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 as `x` moves from `from` to `to`, eased at both ends. */
export const smoothstep = (from: number, to: number, x: number) => {
  const t = clamp((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};
/** 0..1 as `x` moves from `from` to `to`, linear. */
export const range = (from: number, to: number, x: number) => clamp((x - from) / (to - from));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/* ------------------------------------------------------------------ tokens */

export function applyMotionTokens() {
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  for (const [key, ms] of Object.entries(tokens.durations)) set(`--m-dur-${key}`, `${ms}ms`);
  for (const [key, value] of Object.entries(tokens.easings)) set(`--m-ease-${key}`, value);
  for (const [key, px] of Object.entries(tokens.blur)) set(`--m-blur-${key}`, `${px}px`);
  for (const [key, ms] of Object.entries(tokens.stagger)) set(`--m-stagger-${key}`, `${ms}ms`);
  for (const [key, px] of Object.entries(tokens.distance)) set(`--m-${key}`, `${px}px`);

  const mark = () => (root.dataset.motion = prefersReducedMotion() ? "reduced" : "full");
  mark();
  reducedMotionQuery.addEventListener("change", mark);
}

/* ------------------------------------------------------------------ frame loop */

type FrameCallback = () => void;
const callbacks = new Set<FrameCallback>();
let scheduled = 0;

function flush() {
  scheduled = 0;
  callbacks.forEach((cb) => cb());
}
export function requestFrame() {
  if (!scheduled) scheduled = requestAnimationFrame(flush);
}
addEventListener("scroll", requestFrame, { passive: true });
addEventListener("resize", requestFrame);

/** Runs `cb` on the next frame after every scroll/resize. Returns an unsubscribe function. */
export function onFrame(cb: FrameCallback) {
  callbacks.add(cb);
  requestFrame();
  return () => callbacks.delete(cb);
}

/* ------------------------------------------------------------------ position */

/**
 * Calls `cb(true)` once `ratio` of the element is visible and `cb(false)` when it
 * fully leaves (unless `once`). Used for one-shot entrances.
 */
export function inView(
  el: Element,
  cb: (visible: boolean) => void,
  { ratio = 0.3, once = true }: { ratio?: number; once?: boolean } = {},
) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= ratio) {
          cb(true);
          if (once) observer.disconnect();
        } else if (!entry.isIntersecting && !once) cb(false);
      }
    },
    { threshold: [0, ratio] },
  );
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * Progress (0..1) of an element's top edge moving from `from` to `to`,
 * both given as fractions of the viewport height (1 = bottom edge, 0 = top).
 */
export function sectionProgress(el: Element, from: number, to: number) {
  const top = el.getBoundingClientRect().top / innerHeight;
  return range(from, to, top);
}

/* ------------------------------------------------------------------ text */

/**
 * Wraps each word of `el` in `<span class="hd-w"><span>word</span></span>`, keeping
 * <br> and nested elements (their words are wrapped too). The text stays real,
 * selectable text. Each inner span gets `--wi` (its word index) for staggering.
 */
export function splitWords(el: HTMLElement) {
  if (el.dataset.split) return;
  el.dataset.split = "words";
  let index = 0;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? "").split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(" ");
            continue;
          }
          const outer = document.createElement("span");
          outer.className = "hd-w";
          const inner = document.createElement("span");
          inner.textContent = part;
          inner.style.setProperty("--wi", String(index++));
          outer.append(inner);
          frag.append(outer);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== "BR") {
        walk(child);
      }
    }
  };
  walk(el);
}
