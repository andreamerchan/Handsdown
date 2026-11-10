/**
 * Home page "Less hiring. More building." section (`.www-hwws`).
 *
 * The section has three layouts, chosen from the viewport and motion settings
 * and written to `data-layout` (the CSS does the rest):
 *
 * - "pinned": tall, wide screens. The stage sticks under the header while the
 *   visitor scrolls through a tall track; scroll progress picks which of the
 *   four steps is shown, and a step bar at the bottom lets them jump.
 * - "flow":   small screens. Steps are stacked; each illustration plays its
 *   animation when it scrolls into view and resets when it leaves.
 * - "still":  reduced motion. Steps are stacked and shown in their end state.
 *
 * An illustration "plays" when it carries the `data-played` attribute.
 */

type Layout = "pinned" | "flow" | "still";

const PINNED_QUERY =
  "(min-width: 900px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Height of the fixed site header: the stage sticks this far from the top. */
const HEADER_HEIGHT = 74;
/** Each step owns this share of the pinned scroll range (the rest is a tail). */
const STEP_SPAN = 0.225;
/** An illustration starts playing once this much of it is visible ("flow"). */
const PLAY_VISIBLE_RATIO = 0.35;

/** Typing effect of the request bubble in step 1. */
const TYPING_START_MS = 200;
const TYPING_MS_PER_CHARACTER = 20;

/** Coordinate system of the dotted map in step 2 (pins are placed in it). */
const MAP_BOX = { width: 540, height: 498 };
const MAP_DOTS_URL = "/brand/how-we-work/americas-dots.json";

/** Labels of the step bar, in step order. */
const STEP_BAR_LABELS = ["Describe", "Align", "Match", "Hire"];
const STEP_BAR_ARIA_LABEL = "Steps";

/** One animated illustration and how to start / rewind it. */
interface Scene {
  picture: HTMLElement;
  playing: boolean;
  /** Pending double-frame wait before the animation starts. */
  frame: number;
  /** Extra work when the scene starts; returns how to undo it. */
  onPlay?: (picture: HTMLElement) => () => void;
  undoPlay?: () => void;
}

const section = document.querySelector<HTMLElement>(".www-hwws");
const track = section?.querySelector<HTMLElement>("[data-hwws-track]");
const stage = section?.querySelector<HTMLElement>("[data-hwws-stage]");

if (section && track && stage) {
  setUp(section, track, stage);
}

function setUp(section: HTMLElement, track: HTMLElement, stage: HTMLElement) {
  const steps = [...section.querySelectorAll<HTMLElement>(".www-hwws-step")];
  // The illustration is the last child of each step's row.
  const scenes: Scene[] = steps.flatMap((step) => {
    const picture = step.querySelector<HTMLElement>(".www-hwws-row > :last-child");
    return picture ? [{ picture, playing: false, frame: 0 }] : [];
  });
  if (scenes.length !== steps.length) return;

  const bubble = section.querySelector<HTMLElement>(".www-hww-bubble");
  if (bubble) scenes[0].onPlay = createRequestTyper(bubble);

  const mapCanvas = section.querySelector<HTMLCanvasElement>(".www-hwws-dots");
  if (mapCanvas) drawMapDots(mapCanvas);

  const pinnedMedia = window.matchMedia(PINNED_QUERY);
  const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
  let leaveLayout = () => {};

  const applyLayout = () => {
    const layout: Layout = reducedMotionMedia.matches
      ? "still"
      : pinnedMedia.matches
        ? "pinned"
        : "flow";
    leaveLayout();
    section.dataset.layout = layout;
    if (layout === "pinned") leaveLayout = enterPinned(track, stage, steps, scenes);
    else if (layout === "flow") leaveLayout = enterFlow(scenes);
    else leaveLayout = enterStill(scenes);
  };

  applyLayout();
  pinnedMedia.addEventListener("change", applyLayout);
  reducedMotionMedia.addEventListener("change", applyLayout);
}

/* ------------------------------------------------------------------------ */
/* Scenes                                                                    */
/* ------------------------------------------------------------------------ */

/** Starts a scene's animation (two frames later, so its CSS transitions run). */
function playScene(scene: Scene) {
  if (scene.playing) return;
  scene.playing = true;
  scene.frame = requestAnimationFrame(() => {
    scene.frame = requestAnimationFrame(() => {
      scene.picture.dataset.played = "";
      scene.undoPlay = scene.onPlay?.(scene.picture);
    });
  });
}

/** Rewinds a scene so it can play again next time. */
function resetScene(scene: Scene) {
  scene.playing = false;
  cancelAnimationFrame(scene.frame);
  scene.undoPlay?.();
  scene.undoPlay = undefined;
  delete scene.picture.dataset.played;
}

/**
 * Step 1: the request in the speech bubble is typed out letter by letter.
 * The rest of the illustration waits for it through the `--hww-typed` delay.
 */
function createRequestTyper(bubble: HTMLElement) {
  const request = (bubble.textContent ?? "").replace(/\s+/g, " ").trim();

  return (picture: HTMLElement) => {
    const timers: number[] = [];
    bubble.textContent = "";
    for (let length = 0; length <= request.length; length++) {
      timers.push(
        window.setTimeout(
          () => (bubble.textContent = request.slice(0, length)),
          TYPING_START_MS + TYPING_MS_PER_CHARACTER * length,
        ),
      );
    }
    picture.style.setProperty(
      "--hww-typed",
      `${TYPING_START_MS + TYPING_MS_PER_CHARACTER * request.length}ms`,
    );

    return () => {
      timers.forEach(window.clearTimeout);
      bubble.textContent = request;
    };
  };
}

/* ------------------------------------------------------------------------ */
/* Layout: still (reduced motion)                                            */
/* ------------------------------------------------------------------------ */

function enterStill(scenes: Scene[]) {
  // Show every illustration in its finished state, without typing.
  scenes.forEach((scene) => (scene.picture.dataset.played = ""));
  return () => scenes.forEach(resetScene);
}

/* ------------------------------------------------------------------------ */
/* Layout: flow (stacked steps, play on scroll into view)                    */
/* ------------------------------------------------------------------------ */

function enterFlow(scenes: Scene[]) {
  scenes.forEach(resetScene);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const scene = scenes.find((s) => s.picture === entry.target);
        if (!scene) continue;
        if (entry.intersectionRatio >= PLAY_VISIBLE_RATIO) playScene(scene);
        else if (!entry.isIntersecting && scene.playing) resetScene(scene);
      }
    },
    { threshold: [0, PLAY_VISIBLE_RATIO] },
  );
  scenes.forEach((scene) => observer.observe(scene.picture));

  return () => {
    observer.disconnect();
    scenes.forEach(resetScene);
  };
}

/* ------------------------------------------------------------------------ */
/* Layout: pinned (scroll-driven steps + step bar)                           */
/* ------------------------------------------------------------------------ */

function enterPinned(
  track: HTMLElement,
  stage: HTMLElement,
  steps: HTMLElement[],
  scenes: Scene[],
) {
  const lastStep = steps.length - 1;
  /** How far the page scrolls while the stage stays pinned. */
  const scrollRange = () => Math.max(1, track.offsetHeight - stage.offsetHeight);

  const bar = buildStepBar((step) => {
    // Jump to the middle of the chosen step's part of the scroll range.
    const trackTop = track.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
    const stepMiddle = STEP_SPAN * step + STEP_SPAN / 2;
    window.scrollTo({ top: trackTop + stepMiddle * scrollRange(), behavior: "smooth" });
  });
  stage.append(bar.element);

  let activeStep = -1;
  let stageReached: boolean | null = null;

  const showStep = (step: number) => {
    steps.forEach((el, index) => el.toggleAttribute("data-shown", index === step));
    bar.setActive(step, lastStep);
  };

  /** Plays the active step's illustration and rewinds the others. */
  const syncScenes = () => {
    scenes.forEach((scene, index) => {
      // Step 1 waits until the stage is actually pinned, so the visitor sees
      // it play; later steps can only be active once it is.
      const shouldPlay = index === activeStep && (index > 0 || stageReached === true);
      if (shouldPlay) playScene(scene);
      else if (scene.playing || scene.picture.hasAttribute("data-played")) resetScene(scene);
    });
  };

  let frame = 0;
  const measure = () => {
    frame = 0;
    const trackTop = track.getBoundingClientRect().top;
    const progress = clamp01((HEADER_HEIGHT - trackTop) / scrollRange());
    const step = Math.min(lastStep, Math.floor(progress / STEP_SPAN));
    const reached = trackTop <= HEADER_HEIGHT + 1;

    if (step === activeStep && reached === stageReached) return;
    if (step !== activeStep) showStep(step);
    activeStep = step;
    stageReached = reached;
    syncScenes();
  };
  const scheduleMeasure = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  measure();
  window.addEventListener("scroll", scheduleMeasure, { passive: true });
  window.addEventListener("resize", scheduleMeasure);

  return () => {
    window.removeEventListener("scroll", scheduleMeasure);
    window.removeEventListener("resize", scheduleMeasure);
    cancelAnimationFrame(frame);
    bar.element.remove();
    steps.forEach((el) => el.removeAttribute("data-shown"));
    scenes.forEach(resetScene);
  };
}

/** Builds the "Describe / Align / Match / Hire" bar shown under the pinned stage. */
function buildStepBar(onSelect: (step: number) => void) {
  const element = document.createElement("div");
  element.className = "www-hwws-bar";

  const list = document.createElement("ol");
  list.className = "www-hwws-nodes";
  list.setAttribute("aria-label", STEP_BAR_ARIA_LABEL);

  const line = document.createElement("li");
  line.className = "www-hwws-bar-line";
  line.setAttribute("aria-hidden", "true");
  list.append(line);

  const nodes = STEP_BAR_LABELS.map((label, step) => {
    const node = document.createElement("li");
    node.className = "www-hwws-node";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => onSelect(step));

    const dot = document.createElement("span");
    dot.className = "www-hwws-dot";
    dot.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "www-hwws-name";
    name.textContent = label;

    button.append(dot, name);
    node.append(button);
    list.append(node);
    return { node, button };
  });
  element.append(list);

  return {
    element,
    /** Marks earlier steps as done, and everything as done on the last step. */
    setActive(active: number, lastStep: number) {
      element.style.setProperty("--hwws-at", String(active / lastStep));
      nodes.forEach(({ node, button }, step) => {
        const done = step < active || active === lastStep;
        node.dataset.state = done ? "done" : step === active ? "current" : "next";
        if (step === active) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Step 2: dotted map of the Americas                                        */
/* ------------------------------------------------------------------------ */

interface MapDots {
  /** Dot radius, in MAP_BOX units. */
  radius: number;
  /** Flat list of dot centres: x0, y0, x1, y1, ... in MAP_BOX units. */
  points: number[];
}

/** Sizes the canvas to the dots' bounding box inside the map and paints them. */
async function drawMapDots(canvas: HTMLCanvasElement) {
  let dots: MapDots;
  try {
    dots = await (await fetch(MAP_DOTS_URL)).json();
  } catch {
    return; // The map simply stays empty if the dots cannot be loaded.
  }
  const { radius, points } = dots;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  const box = {
    left: minX - radius,
    top: minY - radius,
    width: maxX - minX + 2 * radius,
    height: maxY - minY + 2 * radius,
  };

  Object.assign(canvas.style, {
    left: `${(box.left / MAP_BOX.width) * 100}%`,
    top: `${(box.top / MAP_BOX.height) * 100}%`,
    width: `${(box.width / MAP_BOX.width) * 100}%`,
    height: `${(box.height / MAP_BOX.height) * 100}%`,
  });

  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.ceil(box.width * pixelRatio);
  canvas.height = Math.ceil(box.height * pixelRatio);

  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(pixelRatio, pixelRatio);
  context.translate(-box.left, -box.top);
  // The dot colour comes from the stylesheet (`color` of the canvas).
  context.fillStyle = getComputedStyle(canvas).color;

  const path = new Path2D();
  for (let i = 0; i < points.length; i += 2) {
    path.moveTo(points[i] + radius, points[i + 1]);
    path.arc(points[i], points[i + 1], radius, 0, 2 * Math.PI);
  }
  context.fill(path);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
