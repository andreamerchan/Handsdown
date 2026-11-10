/**
 * "What every specialist comes with" on /how-it-works (`.www-strips`):
 * three photo strips (Senior / US hours / 5 checks). One strip is open at a
 * time: it is wide and in colour with a bright caption, the others are narrow
 * and grey. Which one is open follows the scroll position.
 *
 * Layouts, written to `data-layout`:
 * - "pinned":  768px and wider. The row sticks under the header while the
 *   visitor scrolls a tall track; the track is split into three equal parts,
 *   one per strip.
 * - "stacked": phones. The strips are stacked; the one nearest the middle of
 *   the screen is open.
 * - "still":   wide screens with reduced motion. The first strip stays open.
 */

type Layout = "pinned" | "stacked" | "still";

const PINNED_QUERY =
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
const STACKED_QUERY = "(max-width: 767px)";

/** Height of the fixed site header: the stage sticks this far from the top. */
const HEADER_HEIGHT = 74;
/** Share of the row width the open strip takes; the others split the rest. */
const OPEN_SHARE = 0.54375;

const section = document.querySelector<HTMLElement>(".www-strips");
const track = section?.querySelector<HTMLElement>(".www-strips-track");
const stage = section?.querySelector<HTMLElement>(".www-strips-stage");
const row = section?.querySelector<HTMLElement>(".www-strips-row");

if (section && track && stage && row) {
  setUp(section, track, stage, row);
}

function setUp(
  section: HTMLElement,
  track: HTMLElement,
  stage: HTMLElement,
  row: HTMLElement,
): void {
  const strips = [...row.querySelectorAll<HTMLElement>(".www-strip")];
  const pinnedQuery = window.matchMedia(PINNED_QUERY);
  const stackedQuery = window.matchMedia(STACKED_QUERY);
  let layout: Layout = "still";
  let frame = 0;

  /** Opens one strip: widens its column and switches the `data-open` marks. */
  function open(index: number): void {
    const closedShare = (1 - OPEN_SHARE) / (strips.length - 1);
    const columns = strips.map(
      (_, i) => `${(i === index ? OPEN_SHARE : closedShare).toFixed(4)}fr`,
    );
    row.style.setProperty("--strips-cols", columns.join(" "));
    section.dataset.open = String(index);
    strips.forEach((strip, i) => {
      if (i === index) strip.dataset.open = "true";
      else delete strip.dataset.open;
    });
  }

  /** Pinned: which third of the scroll track the visitor is in. */
  function stripForScroll(): number | undefined {
    const scrollRange = track.offsetHeight - stage.offsetHeight;
    if (scrollRange <= 0) return undefined;
    const top = track.getBoundingClientRect().top;
    const progress = Math.min(
      1,
      Math.max(0, (HEADER_HEIGHT - top) / scrollRange),
    );
    return Math.min(strips.length - 1, Math.floor(progress * strips.length));
  }

  /** Stacked: the strip whose middle is nearest the middle of the screen. */
  function stripNearestMiddle(): number {
    const middle = window.innerHeight / 2;
    const distances = strips.map((strip) => {
      const rect = strip.getBoundingClientRect();
      return Math.abs(rect.top + rect.height / 2 - middle);
    });
    return distances.indexOf(Math.min(...distances));
  }

  function update(): void {
    frame = 0;
    if (layout === "still") return;
    const index = layout === "pinned" ? stripForScroll() : stripNearestMiddle();
    if (index !== undefined && String(index) !== section.dataset.open)
      open(index);
  }

  function schedule(): void {
    frame ||= requestAnimationFrame(update);
  }

  function chooseLayout(): void {
    layout = pinnedQuery.matches
      ? "pinned"
      : stackedQuery.matches
        ? "stacked"
        : "still";
    section.dataset.layout = layout;
    open(0);
    update();
  }

  chooseLayout();
  pinnedQuery.addEventListener("change", chooseLayout);
  stackedQuery.addEventListener("change", chooseLayout);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}
