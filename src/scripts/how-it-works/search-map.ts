/**
 * Step 2 of "How we work" on /how-it-works: the Latin America search map
 * (`.www-hww-search`).
 *
 * A dotted map of Latin America sits in a rounded window next to the text.
 * As the visitor scrolls, one progress value (0 → 1) drives everything:
 *
 *   0.02 – 0.20  the window opens up to fill the stage and the map grows
 *   0.24 – 0.60  a search pulse spreads from the origin and reveals candidates
 *   0.63         the matching candidate gets a "locked" ring
 *   0.70         the "Matched" card appears
 *
 * The dots and the pulse are drawn on a canvas; candidates and the card are
 * regular elements switched with `data-found`, `data-locked`, `data-matched`.
 */

/** How the progress value is produced. */
export type SearchMode =
  /** Pinned section: the parent hands us the progress of step 2. */
  | "driven"
  /** Stacked section: the step is tall and pins itself; we measure its scroll. */
  | "scroll"
  /** Reduced motion: always shown in the end state, in its small window. */
  | "still";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Coordinate system of the map artwork (dots and candidates live in it). */
const MAP_BOX = { width: 540, height: 498 };
const MAP_DOTS_URL = "/brand/how-we-work/latam-dots.json";
/** Where the search pulse starts, in map coordinates. */
const PULSE_ORIGIN: [number, number] = [322, 137];
/** Radius the pulse has reached when it ends, in map coordinates. */
const PULSE_MAX_RADIUS = 1150;

/** Progress milestones (see the header comment). */
const OPEN_START = 0.02;
const OPEN_END = 0.2;
const PULSE_START = 0.24;
const PULSE_END = 0.6;
const LOCKED_AT = 0.63;
const MATCHED_AT = 0.7;

/** Height of the fixed site header: sticky elements stop this far from the top. */
const HEADER_HEIGHT = 74;
/** Side-by-side layout (text left, map right) starts at this stage width. */
const WIDE_STAGE_WIDTH = 900;
/** Corner radius of the closed map window. */
const WINDOW_RADIUS = 28;
/** Each frame the drawn progress moves this share of the way to the target. */
const SMOOTHING = 0.16;
const SMOOTHING_SNAP = 0.0005;

/** Faint background dot grid that fades in around the opened map. */
const GRID = { step: 5.2, x: 43.4 % 5.2, y: 0.2 };
const GRID_RING_OPACITY = [0.55, 0.32, 0.14];

/** 0 before `from`, 1 after `to`, linear in between. */
function ramp(value: number, from: number, to: number): number {
  if (value <= from) return 0;
  if (value >= to) return 1;
  return (value - from) / (to - from);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function mix(from: Rect, to: Rect, amount: number): Rect {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    w: from.w + (to.w - from.w) * amount,
    h: from.h + (to.h - from.h) * amount,
  };
}

/** Reads a colour token such as `--color-indigo-500` (a hex value). */
function themeColor(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    token,
  );
  return value.trim() || fallback;
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255},${alpha})`;
}

/** The map dots are the same for every visit to the page: load them once. */
let mapDots: Promise<Float32Array | null> | undefined;
function loadMapDots(): Promise<Float32Array | null> {
  mapDots ??= fetch(MAP_DOTS_URL)
    .then((response) => response.json())
    .then(({ points }: { points: number[] }) => new Float32Array(points))
    .catch(() => null);
  return mapDots;
}

/**
 * Starts the map for the given mode. Returns a function that stops it
 * (used when the section switches layout after a resize).
 */
export function startSearchMap(
  step: HTMLElement,
  rail: HTMLElement,
  mode: SearchMode,
  /** Progress of step 2 when the mode is "driven". */
  drivenProgress: () => number,
): () => void {
  const pin = step.querySelector<HTMLElement>(".www-hww-search-pin");
  const stage = step.querySelector<HTMLElement>(".www-hww-search-stage");
  const canvas = step.querySelector<HTMLCanvasElement>("canvas");
  const map = step.querySelector<HTMLElement>(".www-hww-map");
  const ghost = step.querySelector<HTMLElement>(".www-hww-search-ghost");
  const text = step.querySelector<HTMLElement>(".www-hww-text");
  const progressBar = step.querySelector<HTMLElement>(
    ".www-hww-search-progress i",
  );
  const context = canvas?.getContext("2d");
  if (!pin || !stage || !canvas || !map || !ghost || !text || !context) {
    return () => {};
  }

  const candidates = [...map.querySelectorAll<HTMLElement>("[data-candidate]")];
  const candidateSpots = candidates.map((candidate) => [
    Number(candidate.dataset.x) * MAP_BOX.width,
    Number(candidate.dataset.y) * MAP_BOX.height,
  ]);
  const dotColor = themeColor("--color-indigo-300", "#a8b0ff");
  const accentColor = themeColor("--color-indigo-500", "#6e7bff");

  let dots: Float32Array | null = null;
  let stageWidth = 0;
  let stageHeight = 0;
  let pixelRatio = 1;
  /** Where the map sits while the window is closed / fully open. */
  let closedBox: Rect = { x: 0, y: 0, w: MAP_BOX.width, h: MAP_BOX.height };
  let openBox: Rect = closedBox;

  /** Sizes the canvas and works out the closed and open map positions. */
  function measure(): void {
    stageWidth = pin!.clientWidth;
    stageHeight = pin!.clientHeight;
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvas!.width = Math.round(stageWidth * pixelRatio);
    canvas!.height = Math.round(stageHeight * pixelRatio);

    const pinRect = pin!.getBoundingClientRect();
    const relativeTo = (rect: DOMRect): Rect => ({
      x: rect.left - pinRect.left,
      y: rect.top - pinRect.top,
      w: rect.width,
      h: rect.height,
    });
    const mapRatio = MAP_BOX.height / MAP_BOX.width;
    // In "scroll" mode the sticky step rail covers the top of the stage.
    const railHeight = mode === "scroll" ? rail.offsetHeight : 0;

    if (mode === "still") {
      // No opening: the map stays in the placeholder next to the text.
      closedBox = openBox = relativeTo(ghost!.getBoundingClientRect());
    } else if (stageWidth >= WIDE_STAGE_WIDTH) {
      // Wide: starts in the placeholder on the right, opens to a large map
      // that is centred a little right of it.
      closedBox = relativeTo(ghost!.getBoundingClientRect());
      const height = Math.max(
        0,
        Math.min(stageHeight - railHeight - 56, 0.54 * stageWidth * mapRatio),
      );
      const width = height / mapRatio;
      const centreX = Math.min(
        stageWidth - width / 2 - 28,
        closedBox.x + closedBox.w / 2 + (width - closedBox.w) * 0.18,
      );
      openBox = {
        x: centreX - width / 2,
        y: railHeight + (stageHeight - railHeight) / 2 + 10 - height / 2,
        w: width,
        h: height,
      };
    } else {
      // Narrow: the map fills the room under the text; the closed window is
      // the same box, inset a little.
      const top = text!.getBoundingClientRect().bottom - pinRect.top + 34;
      const width = Math.max(
        0,
        Math.min(stageWidth - 12, (stageHeight - top - 10) / mapRatio),
      );
      const height = width * mapRatio;
      openBox = {
        x: (stageWidth - width) / 2,
        y: top + Math.max(0, (stageHeight - top - height) / 2),
        w: width,
        h: height,
      };
      closedBox = {
        x: openBox.x + 14,
        y: openBox.y + 14,
        w: Math.max(0, openBox.w - 28),
        h: Math.max(0, openBox.h - 28),
      };
    }
  }

  /** The progress the visitor's scroll position asks for right now. */
  function targetProgress(): number {
    if (mode === "still") return 1;
    if (mode === "driven") return drivenProgress();
    const scrollRange = Math.max(1, step.offsetHeight - pin!.offsetHeight);
    return clamp01(
      (HEADER_HEIGHT - step.getBoundingClientRect().top) / scrollRange,
    );
  }

  /** Draws the whole scene for one progress value. */
  function draw(progress: number): void {
    const opened =
      mode === "still"
        ? 0
        : easeInOutCubic(ramp(progress, OPEN_START, OPEN_END));
    const box = mix(closedBox, openBox, opened);
    const mapHeight = (box.w * MAP_BOX.height) / MAP_BOX.width;
    const scale = box.w / MAP_BOX.width;

    // The window: a rounded clip that widens until it covers the stage.
    const closed = 1 - opened;
    const insetTop = closedBox.y * closed;
    const insetLeft = closedBox.x * closed;
    const insetRight =
      Math.max(0, stageWidth - closedBox.x - closedBox.w) * closed;
    const insetBottom =
      Math.max(0, stageHeight - closedBox.y - closedBox.h) * closed;
    stage!.style.clipPath =
      `inset(${insetTop.toFixed(1)}px ${insetRight.toFixed(1)}px ` +
      `${insetBottom.toFixed(1)}px ${insetLeft.toFixed(1)}px ` +
      `round ${(WINDOW_RADIUS * closed).toFixed(1)}px)`;
    // Fades in the wash behind the text and the progress line (see the CSS).
    stage!.style.setProperty("--hww-wash", opened.toFixed(3));

    map!.style.width = `${box.w}px`;
    map!.style.height = `${mapHeight}px`;
    map!.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;

    context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context!.clearRect(0, 0, stageWidth, stageHeight);

    const pulseSpread = ramp(progress, PULSE_START, PULSE_END);
    const pulseRadius = PULSE_MAX_RADIUS * pulseSpread;
    const pulseActive = pulseSpread > 0 && pulseSpread < 1;
    const originX = box.x + PULSE_ORIGIN[0] * scale;
    const originY = box.y + PULSE_ORIGIN[1] * scale;

    if (opened > 0.01) {
      drawBackdrop(box, mapHeight, scale, opened, {
        active: pulseActive,
        spread: pulseSpread,
        radius: pulseRadius,
        x: originX,
        y: originY,
      });
    }

    if (dots) {
      // Land dots; the ones the pulse is passing over light up and grow.
      const dotRadius = Math.min(2.2, 1.38 * scale);
      const plain = new Path2D();
      const lit = new Path2D();
      for (let i = 0; i < dots.length; i += 2) {
        const x = box.x + dots[i] * scale;
        const y = box.y + dots[i + 1] * scale;
        const fromOrigin = Math.hypot(
          dots[i] - PULSE_ORIGIN[0],
          dots[i + 1] - PULSE_ORIGIN[1],
        );
        const onPulse = pulseActive && Math.abs(fromOrigin - pulseRadius) < 9;
        const path = onPulse ? lit : plain;
        path.moveTo(x + dotRadius, y);
        path.arc(x, y, onPulse ? dotRadius * 1.25 : dotRadius, 0, 2 * Math.PI);
      }
      context!.fillStyle = dotColor;
      context!.fill(plain);
      context!.fillStyle = accentColor;
      context!.fill(lit);
    }

    // A candidate appears once the pulse has passed it.
    candidates.forEach((candidate, i) => {
      const [x, y] = candidateSpots[i];
      const reached =
        progress >= PULSE_END ||
        (pulseSpread > 0 &&
          Math.hypot(x - PULSE_ORIGIN[0], y - PULSE_ORIGIN[1]) < pulseRadius);
      candidate.toggleAttribute("data-found", reached);
    });
    map!.toggleAttribute("data-locked", progress >= LOCKED_AT);
    map!.toggleAttribute("data-matched", progress >= MATCHED_AT);
    if (progressBar)
      progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
  }

  /** Soft glow, faint dot grid and the pulse ring behind the opened map. */
  function drawBackdrop(
    box: Rect,
    mapHeight: number,
    scale: number,
    opened: number,
    pulse: {
      active: boolean;
      spread: number;
      radius: number;
      x: number;
      y: number;
    },
  ): void {
    const glowX = box.x + box.w * 0.58;
    const glowY = box.y + mapHeight * 0.5;
    const glow = context!.createRadialGradient(
      glowX,
      glowY,
      0,
      glowX,
      glowY,
      Math.max(stageWidth, stageHeight) * 0.75,
    );
    glow.addColorStop(0, withAlpha(accentColor, 0.09 * opened));
    glow.addColorStop(1, withAlpha(accentColor, 0));
    context!.fillStyle = glow;
    context!.fillRect(0, 0, stageWidth, stageHeight);

    // Grid dots, aligned with the map dots, in three rings that get fainter
    // away from the glow. Grid dots under the pulse ring light up instead.
    const gap = GRID.step * 2 * scale;
    const anchorX = box.x + GRID.x * scale;
    const anchorY = box.y + GRID.y * scale;
    const firstX = anchorX - Math.ceil(anchorX / gap) * gap;
    const firstY = anchorY - Math.ceil(anchorY / gap) * gap;
    const reach = Math.hypot(stageWidth, stageHeight) * 0.62;
    const rings = [new Path2D(), new Path2D(), new Path2D()];
    const lit = new Path2D();
    for (let y = firstY; y < stageHeight + gap; y += gap) {
      for (let x = firstX; x < stageWidth + gap; x += gap) {
        const fromGlow = Math.hypot(x - glowX, y - glowY);
        if (fromGlow > reach) continue;
        const fromOrigin = Math.hypot(x - pulse.x, y - pulse.y) / scale;
        if (pulse.active && Math.abs(fromOrigin - pulse.radius) < 12) {
          lit.rect(x - 1.1, y - 1.1, 2.2, 2.2);
          continue;
        }
        const ring =
          fromGlow < reach * 0.38 ? 0 : fromGlow < reach * 0.7 ? 1 : 2;
        rings[ring].rect(x - 0.6, y - 0.6, 1.2, 1.2);
      }
    }
    context!.fillStyle = dotColor;
    GRID_RING_OPACITY.forEach((opacity, ring) => {
      context!.globalAlpha = opacity * opened;
      context!.fill(rings[ring]);
    });
    context!.fillStyle = accentColor;
    context!.globalAlpha = 0.75;
    context!.fill(lit);
    context!.globalAlpha = 1;

    if (pulse.active) {
      context!.strokeStyle = withAlpha(accentColor, 0.16 * (1 - pulse.spread));
      context!.lineWidth = 1;
      context!.beginPath();
      context!.arc(pulse.x, pulse.y, pulse.radius * scale, 0, 2 * Math.PI);
      context!.stroke();
    }
  }

  // Follow the scroll with a little easing, but only while the step is near
  // the viewport.
  let shown = targetProgress();
  let drawn = NaN;
  let frame = 0;
  let nearViewport = false;
  let stopped = false;

  function tick(): void {
    const target = targetProgress();
    shown += (target - shown) * SMOOTHING;
    if (Math.abs(target - shown) < SMOOTHING_SNAP) shown = target;
    if (shown !== drawn) {
      draw(shown);
      drawn = shown;
    }
    frame = nearViewport ? requestAnimationFrame(tick) : 0;
  }

  const viewportWatcher = new IntersectionObserver(
    (entries) => {
      nearViewport = entries[entries.length - 1].isIntersecting;
      if (nearViewport && !frame && mode !== "still") {
        frame = requestAnimationFrame(tick);
      }
    },
    { rootMargin: "200px 0px" },
  );
  viewportWatcher.observe(step);

  const sizeWatcher = new ResizeObserver(() => {
    measure();
    draw(shown);
    drawn = shown;
  });
  sizeWatcher.observe(pin);

  void loadMapDots().then((points) => {
    if (stopped || !points) return;
    dots = points;
    draw(shown);
  });

  measure();
  draw(shown);

  return () => {
    stopped = true;
    viewportWatcher.disconnect();
    sizeWatcher.disconnect();
    cancelAnimationFrame(frame);
  };
}
