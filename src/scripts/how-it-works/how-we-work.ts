/**
 * "How we work" on /how-it-works (`.www-hww`): four steps with a numbered
 * rail (01 Describe – 04 Hire) and an animated illustration per step.
 *
 * The section has three layouts, chosen from the viewport and the motion
 * setting and written to `data-layout` (the CSS does the rest):
 *
 * - "pinned": wide, tall screens. The stage sticks under the header while the
 *   visitor scrolls through a tall track. Scroll progress picks the step that
 *   is shown (`data-shown`), fills the rail and drives the map of step 2.
 * - "flow":   small screens. The steps are stacked under a sticky rail; each
 *   illustration plays when it scrolls into view and rewinds when it leaves.
 * - "still":  reduced motion. Stacked, every illustration in its end state.
 *
 * An illustration "plays" while it carries the `data-played` attribute.
 */

import { startSearchMap, type SearchMode } from "./search-map";

type Layout = "pinned" | "flow" | "still";

const PINNED_QUERY =
  "(min-width: 900px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Height of the fixed site header: the stage sticks this far from the top. */
const HEADER_HEIGHT = 74;

/** Pinned: each step owns this share of the scroll track (the rest is a tail). */
const STEP_SPAN = 0.225;
/** Pinned: the rail line is full once this much of the track is scrolled. */
const RAIL_FULL_AT = 0.9;
/** Pinned: where inside a step a click on the rail lands (0 start, 1 end). */
const RAIL_STOP = 0.5;
/** ...except step 2, where it lands late enough to show the finished search. */
const RAIL_STOP_SEARCH = 0.85;

/** Stacked: a step is current once its anchor is above this line (viewport heights). */
const ACTIVE_LINE = 0.55;
const ACTIVE_MARGIN = 0.1;
/** Stacked: a step's anchor is its middle, but at most this far below its top. */
const ANCHOR_MAX_DEPTH = 0.45;
/** Stacked: an illustration starts once this much of it is visible. */
const PLAY_VISIBLE_RATIO = 0.35;
/** Stacked: a rail click on step 2 scrolls to this share of the tall step. */
const SEARCH_JUMP_DEPTH = 0.72;

/** Typing effect of the request bubble in step 1. */
const TYPING_START_MS = 200;
const TYPING_MS_PER_CHARACTER = 20;

/** "Describe your role" buttons start a request without any text. */
const BOOKING_URL = "/book";

const SEARCH_STEP = 1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** One animated illustration and how to start / rewind it. */
interface Scene {
  picture: HTMLElement;
  /** The step this illustration belongs to. */
  step: number;
  /** Pending wait (two frames) before the animation starts. */
  frame: number;
  /** Extra work when the scene starts; returns how to undo it. */
  onPlay?: (picture: HTMLElement) => () => void;
  undoPlay?: () => void;
}

function play(scene: Scene): void {
  // Two frames, so the browser has painted the start state and the CSS
  // transitions run.
  scene.frame = requestAnimationFrame(() => {
    scene.frame = requestAnimationFrame(() => {
      scene.picture.dataset.played = "";
      scene.undoPlay = scene.onPlay?.(scene.picture);
    });
  });
}

function rewind(scene: Scene): void {
  cancelAnimationFrame(scene.frame);
  scene.undoPlay?.();
  scene.undoPlay = undefined;
  delete scene.picture.dataset.played;
}

const section = document.querySelector<HTMLElement>(".www-hww");
const track = section?.querySelector<HTMLElement>("[data-hww-track]");
const stage = section?.querySelector<HTMLElement>("[data-hww-stage]");
const rail = section?.querySelector<HTMLElement>(".www-hww-rail");

if (section && track && stage && rail) {
  setUp(section, track, stage, rail);
}

function setUp(
  section: HTMLElement,
  track: HTMLElement,
  stage: HTMLElement,
  rail: HTMLElement,
): void {
  const nodes = [...section.querySelectorAll<HTMLElement>(".www-hww-node")];
  const steps = [
    ...section.querySelectorAll<HTMLElement>(".www-hww-steps > article"),
  ];
  const searchStep = steps[SEARCH_STEP];

  const scenes: Scene[] = [];
  const addScene = (selector: string, onPlay?: Scene["onPlay"]) => {
    const picture = section.querySelector<HTMLElement>(selector);
    const step = steps.findIndex(
      (article) => picture && article.contains(picture),
    );
    if (picture && step >= 0) scenes.push({ picture, step, frame: 0, onPlay });
  };
  addScene(
    ".www-hww-spec",
    typeRequest(section.querySelector(".www-hww-bubble")),
  );
  addScene(".www-hww-checks");
  addScene(".www-hww-shortlist");

  let layout: Layout | undefined;
  let active = 0;
  /** Stops everything the current layout started. */
  let stopLayout = () => {};

  /** Marks the current step on the rail and, when pinned, shows its panel. */
  function showActive(): void {
    nodes.forEach((node, i) => {
      node.toggleAttribute("data-on", i <= active);
      node.toggleAttribute("data-current", i === active);
      const button = node.querySelector("button");
      if (i === active) button?.setAttribute("aria-current", "step");
      else button?.removeAttribute("aria-current");
    });
    steps.forEach((step, i) => {
      step.toggleAttribute("data-shown", layout === "pinned" && i === active);
    });
  }

  /**
   * Pinned layout: the scroll position inside the tall track decides the
   * step, the rail fill and the progress of the map in step 2.
   */
  function startPinned(): () => void {
    let searchProgress = 0;
    let frame = 0;
    const playing = new Set<Scene>();

    const update = () => {
      frame = 0;
      const scrollRange = Math.max(1, track.offsetHeight - stage.offsetHeight);
      const top = track.getBoundingClientRect().top;
      const progress = clamp01((HEADER_HEIGHT - top) / scrollRange);
      /** The stage has reached its sticky position under the header. */
      const reached = top <= HEADER_HEIGHT + 1;

      rail.style.setProperty(
        "--hww-fill",
        clamp01(progress / RAIL_FULL_AT).toFixed(4),
      );
      searchProgress = clamp01(
        (progress - STEP_SPAN * SEARCH_STEP) / STEP_SPAN,
      );
      const step = Math.min(steps.length - 1, Math.floor(progress / STEP_SPAN));
      if (step !== active) {
        active = step;
        showActive();
      }

      // An illustration plays while its step is shown. The first one waits
      // until the stage is pinned, so it is not missed while scrolling in.
      for (const scene of scenes) {
        const on = scene.step === active && (scene.step > 0 || reached);
        if (on === playing.has(scene)) continue;
        if (on) {
          playing.add(scene);
          play(scene);
        } else {
          playing.delete(scene);
          rewind(scene);
        }
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    scenes.forEach(rewind);
    update();
    showActive();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const stopMap = startSearchMap(
      searchStep,
      rail,
      "driven",
      () => searchProgress,
    );

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      stopMap();
      scenes.forEach(rewind);
    };
  }

  /**
   * Stacked layouts ("flow" and "still"): the step nearest the reading line
   * is current, and the rail fills from the first step's anchor to the last.
   */
  function startStacked(animated: boolean): () => void {
    let frame = 0;
    const watchers = new Map<Scene, IntersectionObserver>();

    /** Plays a scene when it is well in view, rewinds it once it has left. */
    const watch = (scene: Scene) => {
      watchers.get(scene)?.disconnect();
      rewind(scene);
      let playing = false;
      const watcher = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (entry.intersectionRatio >= PLAY_VISIBLE_RATIO && !playing) {
            playing = true;
            play(scene);
          } else if (!entry.isIntersecting && playing) {
            playing = false;
            rewind(scene);
          }
        },
        { threshold: [0, PLAY_VISIBLE_RATIO] },
      );
      watcher.observe(scene.picture);
      watchers.set(scene, watcher);
    };

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const anchors = steps.map((step) => {
        const rect = step.getBoundingClientRect();
        return (
          rect.top + Math.min(rect.height / 2, ANCHOR_MAX_DEPTH * viewport)
        );
      });
      const first = anchors[0];
      const last = anchors[anchors.length - 1];
      const fill =
        last === first
          ? 1
          : clamp01((ACTIVE_LINE * viewport - first) / (last - first));
      rail.style.setProperty("--hww-fill", fill.toFixed(4));

      let current = 0;
      anchors.forEach((anchor, i) => {
        if (anchor - ACTIVE_MARGIN * viewport < ACTIVE_LINE * viewport)
          current = i;
      });
      if (current !== active) {
        const previous = active;
        active = current;
        showActive();
        // The illustrations of the step that was left and of the new one
        // start over (they replay if they are still in view).
        if (animated) {
          scenes
            .filter(
              (scene) => scene.step === previous || scene.step === current,
            )
            .forEach(watch);
        }
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    if (animated) scenes.forEach(watch);
    else scenes.forEach((scene) => (scene.picture.dataset.played = ""));
    update();
    showActive();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const stopMap = startSearchMap(
      searchStep,
      rail,
      animated ? "scroll" : "still",
      () => 0,
    );

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      stopMap();
      watchers.forEach((watcher) => watcher.disconnect());
      if (animated) scenes.forEach(rewind);
    };
  }

  /** A click on the rail scrolls to that step. */
  function jumpTo(index: number): void {
    if (layout === "pinned") {
      const scrollRange = track.offsetHeight - stage.offsetHeight;
      const trackTop =
        track.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      const stop = index === SEARCH_STEP ? RAIL_STOP_SEARCH : RAIL_STOP;
      window.scrollTo({
        top: trackTop + (index + stop) * STEP_SPAN * scrollRange,
        behavior: "smooth",
      });
      return;
    }
    const step = steps[index];
    if (index === SEARCH_STEP) {
      // The search step is several screens tall: go to where the match shows.
      const top = step.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: top + SEARCH_JUMP_DEPTH * step.offsetHeight - window.innerHeight,
        behavior: "smooth",
      });
      return;
    }
    step.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const pinnedQuery = window.matchMedia(PINNED_QUERY);
  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  function chooseLayout(): void {
    const next: Layout = reducedMotionQuery.matches
      ? "still"
      : pinnedQuery.matches
        ? "pinned"
        : "flow";
    if (next === layout) return;
    stopLayout();
    layout = next;
    section.dataset.layout = layout;
    const searchMode: SearchMode =
      layout === "pinned" ? "driven" : layout === "flow" ? "scroll" : "still";
    searchStep.dataset.mode = searchMode;
    stopLayout =
      layout === "pinned" ? startPinned() : startStacked(layout === "flow");
  }

  nodes.forEach((node, i) => {
    node.querySelector("button")?.addEventListener("click", () => jumpTo(i));
  });
  section.querySelectorAll(".www-hww-text button").forEach((button) => {
    button.addEventListener("click", () => window.location.assign(BOOKING_URL));
  });

  chooseLayout();
  pinnedQuery.addEventListener("change", chooseLayout);
  reducedMotionQuery.addEventListener("change", chooseLayout);
}

/**
 * Step 1: the request in the dark bubble is typed out letter by letter.
 * `--hww-typed` tells the CSS how long that takes, so the role spec below
 * only starts to fill in once the sentence is complete.
 */
function typeRequest(bubble: HTMLElement | null): Scene["onPlay"] {
  if (!bubble) return undefined;
  const request = (bubble.textContent ?? "").replace(/\s+/g, " ").trim();
  bubble.textContent = request;

  return (picture) => {
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
      timers.forEach((timer) => window.clearTimeout(timer));
      bubble.textContent = request;
    };
  };
}
