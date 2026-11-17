/**
 * "What every specialist comes with" on /how-it-works (`.www-strips`):
 * three photo strips (Senior / US hours / 5 checks). The open strip is wide and
 * in colour with a bright caption; the others are narrow and grey.
 *
 * Layouts, written to `data-layout`:
 * - "pinned":  768px and wider. The row sticks under the header while the visitor
 *   scrolls a tall track. The scroll drives the strips continuously: the open
 *   strip hands its width, colour and caption to the next one as you scroll, and
 *   rests on each strip for a moment (HOLD) so it can be read. A three-part bar at
 *   the top shows where you are; each part jumps to its strip.
 * - "stacked": phones. The strips are stacked; the one nearest the middle of
 *   the screen is open.
 * - "still":   wide screens with reduced motion. The first strip stays open.
 */

type Layout = "pinned" | "stacked" | "still";

const PINNED_QUERY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
const STACKED_QUERY = "(max-width: 767px)";

/** Height of the fixed site header: the stage sticks this far from the top. */
const HEADER_HEIGHT = 74;
/** Share of the row width the open strip takes; the others split the rest. */
const OPEN_SHARE = 0.54375;
/** Scroll kept still at the start and end of the track (share of the track). */
const EDGE = 0.08;
/** Share of each hand-over spent resting on a strip before it moves on (0..1). */
const HOLD = 0.4;

const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const smooth = (t: number) => t * t * (3 - 2 * t);

const section = document.querySelector<HTMLElement>(".www-strips");
const track = section?.querySelector<HTMLElement>(".www-strips-track");
const stage = section?.querySelector<HTMLElement>(".www-strips-stage");
const row = section?.querySelector<HTMLElement>(".www-strips-row");

if (section && track && stage && row) setUp(section, track, stage, row);

function setUp(section: HTMLElement, track: HTMLElement, stage: HTMLElement, row: HTMLElement): void {
  const strips = [...row.querySelectorAll<HTMLElement>(".www-strip")];
  const parts = [...section.querySelectorAll<HTMLElement>(".www-strips-progress li")];
  const last = strips.length - 1;
  const closedShare = (1 - OPEN_SHARE) / last;
  const pinnedQuery = matchMedia(PINNED_QUERY);
  const stackedQuery = matchMedia(STACKED_QUERY);
  let layout: Layout = "still";
  let frame = 0;

  /** Opens strips by amount (0..1 each, summing to 1): widths, colour, caption. */
  function render(amounts: number[]): void {
    row.style.setProperty(
      "--strips-cols",
      amounts.map((a) => `${(closedShare + (OPEN_SHARE - closedShare) * a).toFixed(4)}fr`).join(" "),
    );
    strips.forEach((strip, i) => strip.style.setProperty("--open", amounts[i].toFixed(3)));
    const index = amounts.indexOf(Math.max(...amounts));
    section.dataset.open = String(index);
    strips.forEach((strip, i) => strip.toggleAttribute("data-open", i === index));
    parts.forEach((part, i) => part.toggleAttribute("data-current", i === index));
  }

  const openOnly = (index: number) => render(strips.map((_, i) => (i === index ? 1 : 0)));

  /** 0..1 through the pinned track. */
  function trackProgress(): number {
    const range = track.offsetHeight - stage.offsetHeight;
    if (range <= 0) return 0;
    return clamp((HEADER_HEIGHT - track.getBoundingClientRect().top) / range);
  }

  /** Track progress → position along the strips (0..last), resting on each strip. */
  function position(progress: number): number {
    const t = clamp((progress - EDGE) / (1 - 2 * EDGE)) * last;
    const i = Math.min(last - 1, Math.floor(t));
    const frac = t - i;
    const half = HOLD / 2;
    return i + smooth(clamp((frac - half) / (1 - HOLD)));
  }

  function renderPinned(): void {
    const progress = trackProgress();
    const x = position(progress);
    render(strips.map((_, i) => clamp(1 - Math.abs(x - i))));
    // Progress bar: one part per strip, filled in order with the scroll.
    const t = clamp((progress - EDGE) / (1 - 2 * EDGE)) * strips.length;
    parts.forEach((part, i) => part.style.setProperty("--fill", clamp(t - i).toFixed(3)));
  }

  function stripNearestMiddle(): number {
    const middle = innerHeight / 2;
    const distances = strips.map((strip) => {
      const rect = strip.getBoundingClientRect();
      return Math.abs(rect.top + rect.height / 2 - middle);
    });
    return distances.indexOf(Math.min(...distances));
  }

  function update(): void {
    frame = 0;
    if (layout === "pinned") renderPinned();
    else if (layout === "stacked") {
      const index = stripNearestMiddle();
      if (String(index) !== section.dataset.open) openOnly(index);
    }
  }
  const schedule = () => (frame ||= requestAnimationFrame(update));

  /** Progress bar: scroll to the point where strip `index` is fully open. */
  section.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-strip-go]");
    if (!button || layout !== "pinned") return;
    const index = Number(button.dataset.stripGo);
    const range = track.offsetHeight - stage.offsetHeight;
    const progress = EDGE + (1 - 2 * EDGE) * (index / last);
    const trackTop = track.getBoundingClientRect().top + scrollY;
    scrollTo({ top: trackTop - HEADER_HEIGHT + progress * range + 1, behavior: "smooth" });
  });

  function chooseLayout(): void {
    layout = pinnedQuery.matches ? "pinned" : stackedQuery.matches ? "stacked" : "still";
    section.dataset.layout = layout;
    if (layout !== "pinned") parts.forEach((part) => part.style.removeProperty("--fill"));
    openOnly(0);
    update();
  }

  chooseLayout();
  pinnedQuery.addEventListener("change", chooseLayout);
  stackedQuery.addEventListener("change", chooseLayout);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
}
