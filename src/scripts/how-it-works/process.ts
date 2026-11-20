// /how-it-works, "The process": scroll-driven timeline + morphing illustration.
//
// Pinned when the screen is tall enough and motion is allowed (data-mode="pinned").
// The scroll position t runs 0..4 (one unit per step) and drives everything:
//   timeline   the rail fills from step to step; each numbered node lights up as it's reached
//              (this is the progress bar; nodes jump to their step)
//   text       the current step's text slides along the timeline: out to the left, in from the right
//   graphics   one illustration morphs between steps (Smart-Animate style): the request becomes
//              the spec, the spec docks once approved, the map finds the candidate, the
//              candidate's card carries through the five checks and tops the shortlist
// It all follows the scroll position, so it plays backwards too. Otherwise the steps are a
// plain row (data-mode="list").
/* eslint-disable @typescript-eslint/no-explicit-any */

const track = document.querySelector<HTMLElement>("[data-process-track]");
const stage = track?.querySelector<HTMLElement>(".hiw-p-stage");
const viz = track?.querySelector<HTMLElement>(".hx-viz");
if (track && stage && viz) setUp(track, stage, viz);

function setUp(track: HTMLElement, stage: HTMLElement, viz: HTMLElement) {
  /** Scroll kept still at the start and end of the track (share of the track). */
  const EDGE = 0.04;
  const STEPS = 4;
  /** Length of a text hand-over, in steps: the old text leaves, then the new one arrives. */
  const FADE = 0.16;
  /** Map dots: same data as the website's map. */
  const DOTS_URL = "/brand/how-we-work/americas-dots.json";
  /** Pinning needs at least this much viewport height. */
  const MIN_PIN_HEIGHT = 620;
  /** Where in a step a timeline jump lands: its graphic is complete by then. */
  const LAND_AT = 0.72;
  /* The board the graphics are drawn on (scaled to fit), and the map dots' box. */
  const BOARD = { w: 440, h: 500 };
  const MAP_BOX = { width: 540, height: 498 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  const $ = (name: string) => viz.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const all = (sel: string) => [...viz.querySelectorAll<HTMLElement>(sel)];
  const texts = [...track.querySelectorAll<HTMLElement>("[data-text]")];
  const nodes = [...track.querySelectorAll<HTMLElement>("[data-node]")];
  const rail = track.querySelector<HTMLElement>(".hiw-p-rail i");

  const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  /** Interpolates keyframes [[t, {x, y, s, sy, o, w}], ...] at t, eased between frames. */
  function at(frames: any[], t: number): any {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      const [t1, b] = frames[i];
      if (t <= t1) {
        const [t0, a] = frames[i - 1];
        const k = ease(ramp(t, t0, t1));
        const out: any = {};
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const va = key in a ? a[key] : b[key];
          const vb = key in b ? b[key] : a[key];
          out[key] = lerp(va, vb, k);
        }
        return out;
      }
    }
    return frames[frames.length - 1][1];
  }

  function place(el: HTMLElement, p: any) {
    if (!el) return;
    const s = p.s ?? 1;
    const sy = p.sy ?? s;
    el.style.transform = `translate(${p.x ?? 0}px, ${p.y ?? 0}px) scale(${s}, ${sy})`;
    el.style.opacity = (p.o ?? 1).toFixed(3);
    el.style.visibility = (p.o ?? 1) < 0.005 ? "hidden" : "visible";
    if (p.w != null) el.style.width = `${p.w}px`;
  }

  /* ------------------------------------------------------------ the sequence (t in steps) */
  // Hand-overs between steps happen while the text swaps (step boundary ± 0.16).
  const el: Record<string, HTMLElement> = {
    bubble: $("bubble"), link: $("link"), spec: $("spec"), free: $("free"), approved: $("approved"),
    map: $("map"), marker: $("marker"), cand: $("cand"), score: $("score"),
    subMatched: $("subMatched"), subScored: $("subScored"),
    matched: $("matched"), checking: $("checking"), passed: $("passed"), bars: $("bars"),
    cvB: $("cvB"), cvC: $("cvC"), link2: $("link2"), decide: $("decide"), days: $("days"),
  };
  const marks = all("[data-hl]");
  const rows = all("[data-row]");
  const pins = all("[data-pin]");
  const checks = all("[data-check]");
  const dayChips = all("[data-day]");

  const SPEC_DOCKED = { x: BOARD.w - 400 * 0.46, y: 0, s: 0.46 };
  const frames: Record<string, any[]> = {
    bubble: [[0, { x: 10, y: 80, o: 1 }], [0.84, { x: 10, y: 80, o: 1 }], [1.1, { x: 10, y: 30, o: 0 }]],
    spec: [
      [0, { x: 20, y: 200, s: 1, o: 1 }],
      [0.84, { x: 20, y: 200, s: 1, o: 1 }],
      [1.16, { ...SPEC_DOCKED, o: 1 }],
      [1.84, { ...SPEC_DOCKED, o: 1 }],
      [2.12, { ...SPEC_DOCKED, y: -40, o: 0 }],
    ],
    map: [
      [0.84, { x: 0, y: 60, s: 1.08, o: 0 }],
      [1.16, { x: 0, y: 60, s: 1, o: 1 }],
      [1.84, { x: 0, y: 60, s: 1, o: 1 }],
      [2.06, { x: 0, y: 60, s: 1.35, o: 0 }],
    ],
    cand: [
      [1.5, { x: 0, y: 412, w: 360, o: 0 }],
      [1.64, { x: 0, y: 396, w: 360, o: 1 }],
      [1.84, { x: 0, y: 396, w: 360, o: 1 }],
      [2.16, { x: 30, y: 30, w: 380, o: 1 }],
      [2.84, { x: 30, y: 30, w: 380, o: 1 }],
      [3.16, { x: 30, y: 100, w: 380, o: 1 }],
    ],
    score: [
      [2.02, { x: 30, y: 130, sy: 1, s: 1, o: 0 }],
      [2.18, { x: 30, y: 114, sy: 1, s: 1, o: 1 }],
      [2.84, { x: 30, y: 114, sy: 1, s: 1, o: 1 }],
      [3.0, { x: 30, y: 104, sy: 0.55, s: 1, o: 0 }],
    ],
    cvB: [[3.0, { x: 50, y: 176, w: 380, o: 0 }], [3.2, { x: 30, y: 176, w: 380, o: 0.72 }]],
    cvC: [[3.06, { x: 50, y: 252, w: 380, o: 0 }], [3.26, { x: 30, y: 252, w: 380, o: 0.72 }]],
  };

  function renderViz(t: number) {
    // 1 · Describe: the request highlights, the spec fills in row by row.
    place(el.bubble, at(frames.bubble, t));
    marks.forEach((m, k) => m.style.setProperty("--hl", ease(ramp(t, 0.08 + 0.06 * k, 0.16 + 0.06 * k)).toFixed(3)));
    const linkDraw = easeOut(ramp(t, 0.26, 0.36));
    place(el.link, { x: 220, y: 160, s: 1, sy: linkDraw, o: 1 - ramp(t, 0.84, 1.0) });
    place(el.spec, at(frames.spec, t));
    rows.forEach((row, k) => {
      const a = easeOut(ramp(t, 0.34 + 0.07 * k, 0.42 + 0.07 * k));
      row.style.opacity = a.toFixed(3);
      row.style.transform = `translateY(${(1 - a) * 8}px)`;
      const done = ease(ramp(t, 0.44 + 0.08 * k, 0.5 + 0.08 * k));
      row.querySelector(".hx-wait").style.opacity = (1 - done).toFixed(3);
      const d = row.querySelector(".hx-done");
      d.style.opacity = done.toFixed(3);
      d.style.scale = (0.92 + 0.08 * done).toFixed(3);
    });
    // 2 · Align: approved, then the search across the map finds the candidate.
    const ok = ease(ramp(t, 1.24, 1.3));
    el.free.style.opacity = (1 - ease(ramp(t, 1.18, 1.23))).toFixed(3);
    el.approved.style.opacity = ok.toFixed(3);
    el.approved.style.scale = (0.9 + 0.1 * ok).toFixed(3);
    place(el.map, at(frames.map, t));
    pins.forEach((pin, k) => {
      const a = easeOut(ramp(t, 1.2 + 0.06 * k, 1.3 + 0.06 * k));
      pin.style.opacity = a.toFixed(3);
      pin.style.scale = (0.5 + 0.5 * a).toFixed(3);
    });
    const m = easeOut(ramp(t, 1.42, 1.52));
    el.marker.style.opacity = m.toFixed(3);
    el.marker.style.scale = (0.5 + 0.5 * m).toFixed(3);

    // 2 → 3 → 4 · the candidate's card carries through.
    place(el.cand, at(frames.cand, t));
    // One text leaves before the next arrives (no overlapping words).
    el.subMatched.style.opacity = (1 - ease(ramp(t, 2.88, 2.97))).toFixed(3);
    el.subScored.style.opacity = ease(ramp(t, 2.99, 3.08)).toFixed(3);
    const checking = ease(ramp(t, 2.14, 2.2)) * (1 - ease(ramp(t, 2.68, 2.72)));
    const passed = ease(ramp(t, 2.73, 2.78)) * (1 - ease(ramp(t, 2.9, 2.96)));
    const bars = ease(ramp(t, 2.98, 3.04));
    el.matched.style.opacity = (1 - ease(ramp(t, 2.06, 2.12))).toFixed(3);
    el.checking.style.opacity = checking.toFixed(3);
    el.passed.style.opacity = passed.toFixed(3);
    el.bars.style.opacity = bars.toFixed(3);
    el.bars.querySelectorAll("i").forEach((bar, k) => {
      bar.style.transform = `scaleY(${(0.1 + 0.9 * easeOut(ramp(t, 3.0 + 0.03 * k, 3.14 + 0.03 * k))).toFixed(3)})`;
    });

    // 3 · Match: the five checks tick in order, then fold into the card.
    place(el.score, at(frames.score, t));
    checks.forEach((check, k) => {
      const doneAt = 2.22 + 0.12 * k;
      const state = t >= doneAt ? "done" : t >= doneAt - 0.12 && t >= 2.1 ? "current" : "next";
      if (check.dataset.state !== state) check.dataset.state = state;
    });

    // 4 · Hire: the rest of the shortlist, then you decide, then the check-ins.
    place(el.cvB, at(frames.cvB, t));
    place(el.cvC, at(frames.cvC, t));
    [el.cvB, el.cvC].forEach((cv, j) =>
      cv.querySelectorAll("i").forEach((bar, k) => {
        bar.style.transform = `scaleY(${(0.1 + 0.9 * easeOut(ramp(t, 3.16 + 0.06 * j + 0.03 * k, 3.3 + 0.06 * j + 0.03 * k))).toFixed(3)})`;
      }),
    );
    place(el.link2, { x: 220, y: 326, s: 1, sy: easeOut(ramp(t, 3.28, 3.36)), o: t > 3 ? 1 : 0 });
    const d = easeOut(ramp(t, 3.34, 3.44));
    place(el.decide, { x: 220 - el.decide.offsetWidth / 2, y: 364 + (1 - d) * 8, s: 0.96 + 0.04 * d, o: d });
    place(el.days, { x: 220 - el.days.offsetWidth / 2, y: 416, o: t > 3.3 ? 1 : 0 });
    dayChips.forEach((chip, k) => {
      const a = easeOut(ramp(t, 3.48 + 0.06 * k, 3.56 + 0.06 * k));
      chip.style.opacity = a.toFixed(3);
      chip.style.transform = `translateY(${(1 - a) * 6}px)`;
    });
  }


  /* ------------------------------------------------------------ timeline and text */
  function renderSteps(t: number) {
    // Rail: from node 1 (middle of step 1) to node 4 (middle of step 4).
    const fill = clamp((t - 0.5) / (STEPS - 1));
    rail?.style.setProperty("--fill", fill.toFixed(4));
    const current = Math.min(STEPS - 1, Math.floor(t));
    nodes.forEach((node, i) => {
      const reached = fill >= i / (STEPS - 1) - 0.001;
      node.toggleAttribute("data-reached", reached);
      node.toggleAttribute("data-current", i === current);
    });
    texts.forEach((text, i) => {
      const center = i + 0.5;
      let vis = clamp((0.5 - Math.abs(t - center)) / FADE);
      if ((i === 0 && t < center) || (i === STEPS - 1 && t > center)) vis = 1;
      const dir = t < center ? 1 : -1; // arriving from the right, leaving to the left
      text.style.opacity = vis.toFixed(3);
      text.style.transform = `translateX(${((1 - ease(vis)) * 56 * dir).toFixed(1)}px)`;
      text.style.visibility = vis < 0.005 ? "hidden" : "visible";
      text.toggleAttribute("data-current", i === current);
    });
  }

  /* ------------------------------------------------------------ scroll position */
  function position() {
    const range = track.offsetHeight - stage.offsetHeight;
    if (range <= 0) return 0;
    const header = parseFloat(getComputedStyle(stage).top) || 0;
    const progress = clamp((header - track.getBoundingClientRect().top) / range);
    return clamp((progress - EDGE) / (1 - 2 * EDGE)) * STEPS;
  }

  /* ------------------------------------------------------------ fit the board to its box */
  function layout() {
    const box = viz.getBoundingClientRect();
    if (!box.width || !box.height) return;
    viz.style.setProperty("--hx-scale", Math.min(box.width / BOARD.w, box.height / BOARD.h, 1.1).toFixed(4));
  }

  /* ------------------------------------------------------------ map dots (as on the website) */
  function drawDots(data: { radius: number; points: number[] }) {
    const canvas = viz.querySelector<HTMLCanvasElement>(".hx-dots")!;
    const { radius, points } = data;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
    }
    const box = { left: minX - radius, top: minY - radius, width: maxX - minX + 2 * radius, height: maxY - minY + 2 * radius };
    Object.assign(canvas.style, {
      left: `${(box.left / MAP_BOX.width) * 100}%`,
      top: `${(box.top / MAP_BOX.height) * 100}%`,
      width: `${(box.width / MAP_BOX.width) * 100}%`,
      height: `${(box.height / MAP_BOX.height) * 100}%`,
    });
    const ratio = Math.min(2, devicePixelRatio || 1) * 1.15;
    canvas.width = Math.ceil(box.width * ratio);
    canvas.height = Math.ceil(box.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.translate(-box.left, -box.top);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const path = new Path2D();
    for (let i = 0; i < points.length; i += 2) {
      path.moveTo(points[i] + radius, points[i + 1]);
      path.arc(points[i], points[i + 1], radius, 0, 2 * Math.PI);
    }
    ctx.fill(path);
  }
  fetch(DOTS_URL)
    .then((r) => r.json())
    .then(drawDots)
    .catch(() => {});

  /* ------------------------------------------------------------ mode, frame loop, jumps */
  function chooseMode() {
    track.dataset.mode = !reduced.matches && innerHeight >= MIN_PIN_HEIGHT ? "pinned" : "list";
    requestAnimationFrame(() => {
      layout();
      update();
    });
  }
  let frame = 0;
  function update() {
    frame = 0;
    if (track.dataset.mode !== "pinned") return;
    const t = position();
    renderSteps(t);
    renderViz(t);
  }
  const schedule = () => (frame ||= requestAnimationFrame(update));

  track.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-step-go]");
    if (!button || track.dataset.mode !== "pinned") return;
    const index = Number(button.dataset.stepGo);
    const range = track.offsetHeight - stage.offsetHeight;
    const progress = EDGE + (1 - 2 * EDGE) * ((index + LAND_AT) / STEPS);
    const header = parseFloat(getComputedStyle(stage).top) || 0;
    scrollTo({ top: track.getBoundingClientRect().top + scrollY - header + progress * range, behavior: "smooth" });
  });

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", chooseMode);
  reduced.addEventListener("change", chooseMode);
  document.fonts?.ready.then(() => requestAnimationFrame(layout));
  chooseMode();
}
