/**
 * Home page team photo (`.www-team`): a fake cursor moves from person to
 * person; at each stop it "clicks" and a profile card appears with the score
 * counting up. The photo also zooms out slightly as the section scrolls in.
 *
 * The script only sets state; the CSS reacts to it:
 * - `data-card` / `data-pointing` / `--card-left` / `--card-top` / `--zoom-x`:
 *   which specialist is featured and where the card and cursor go;
 * - `data-cursor`: "away" (hidden) -> "arrived" (moving in) -> "idle";
 * - `data-pressed`: the cursor is mid-click;
 * - `data-swapping`: the card is fading out before the next specialist.
 */

interface Specialist {
  name: string;
  role: string;
  score: number;
  skills: string[];
  /** Card position inside the photo frame. */
  card: { left: string; top: string };
  /** Which way the cursor points at the person. */
  cursor: "left" | "right";
  /** Horizontal position of the person in the photo (0 = left, 1 = right). */
  personX: number;
}

const SPECIALISTS: Specialist[] = [
  {
    name: "Edson",
    role: "Senior Data Scientist",
    score: 98,
    skills: ["Python", "Machine Learning"],
    card: { left: "25.2%", top: "59%" },
    cursor: "left",
    personX: 0.465,
  },
  {
    name: "Jordan",
    role: "Lead Data Analyst",
    score: 98,
    skills: ["Python", "Deep Learning"],
    card: { left: "50%", top: "63.1%" },
    cursor: "left",
    personX: 0.53,
  },
  {
    name: "Lucy",
    role: "Lead Data Analyst",
    score: 98,
    skills: ["Python", "Deep Learning"],
    card: { left: "44%", top: "55%" },
    cursor: "right",
    personX: 0.69,
  },
];

/** The tour starts once this much of the section is visible. */
const START_VISIBLE_RATIO = 0.35;

/** Timeline of one stop of the cursor, in ms from its start. */
const CARD_SWAP_MS = 240; // old card fades out before the new one is set
const PRESS_AT_MS = 1200; // cursor clicks, score starts counting
const RELEASE_AT_MS = 1380;
const CURSOR_IDLE_AT_MS = 1500;
const NEXT_STOP_AT_MS = 3800;
const SCORE_COUNT_MS = 1100;

/** The photo starts 6% enlarged and settles over the first 35% of its pass. */
const PHOTO_EXTRA_ZOOM = 0.06;
const PHOTO_ZOOM_SETTLES_AT = 0.35;
/** On phones the photo is cropped and zoomed by CSS instead. */
const PHONE_QUERY = "(max-width: 639px)";
/** Zoom factor the phone layout uses (to keep the featured person in frame). */
const PHONE_ZOOM = 2.2;

const section = document.querySelector<HTMLElement>(".www-team");
const photo = section?.querySelector<HTMLElement>(".www-team-photo");
const card = section?.querySelector<HTMLElement>(".www-team-card");

if (section && photo && card) {
  setUp(section, photo, card);
}

function setUp(section: HTMLElement, photo: HTMLElement, card: HTMLElement) {
  const nameEl = card.querySelector<HTMLElement>("b");
  const scoreEl = card.querySelector<HTMLElement>(".tabular-nums > span");
  const roleEl = card.querySelector<HTMLElement>(":scope > span");
  const skillsEl = card.querySelector<HTMLElement>("ul");
  if (!nameEl || !scoreEl || !roleEl || !skillsEl) return;

  /** Puts a specialist's details in the card and moves card + cursor to them. */
  const showSpecialist = (index: number) => {
    const specialist = SPECIALISTS[index];
    section.dataset.card = String(index);
    section.dataset.pointing = specialist.cursor;
    section.style.setProperty("--card-left", specialist.card.left);
    section.style.setProperty("--card-top", specialist.card.top);
    section.style.setProperty("--zoom-x", phoneZoomOrigin(specialist.personX));

    nameEl.textContent = specialist.name;
    roleEl.textContent = specialist.role;
    const skillClass = skillsEl.firstElementChild?.className ?? "";
    skillsEl.replaceChildren(
      ...specialist.skills.map((skill) => {
        const item = document.createElement("li");
        item.className = skillClass;
        item.textContent = skill;
        return item;
      }),
    );
  };

  // Reduced motion: keep the first specialist's finished card, no tour, no zoom.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showSpecialist(0);
    section.dataset.cursor = "idle";
    scoreEl.textContent = String(SPECIALISTS[0].score);
    return;
  }

  /* --- Photo zoom-out while the section scrolls into view ---------------- */

  const phoneMedia = window.matchMedia(PHONE_QUERY);
  let sectionVisible = false;
  let zoomFrame = 0;

  const updatePhotoZoom = () => {
    zoomFrame = 0;
    if (phoneMedia.matches) {
      photo.style.transform = "";
      return;
    }
    if (!sectionVisible) return;

    const rect = section.getBoundingClientRect();
    // 0 when the section's top touches the bottom of the screen, 1 when its
    // bottom leaves through the top.
    const passed = clamp01(
      (window.innerHeight - rect.top) / (window.innerHeight + rect.height),
    );
    const scale =
      1 + PHOTO_EXTRA_ZOOM * (1 - Math.min(1, passed / PHOTO_ZOOM_SETTLES_AT));
    const shiftPercent = ((scale - 1) / 2) * 80;
    photo.style.transform =
      scale === 1
        ? ""
        : `translateY(${shiftPercent.toFixed(2)}%) scale(${scale.toFixed(4)})`;
  };
  const schedulePhotoZoom = () => {
    if (!zoomFrame) zoomFrame = requestAnimationFrame(updatePhotoZoom);
  };

  /* --- Cursor tour -------------------------------------------------------- */

  let timers: number[] = [];
  let countFrame = 0;
  let touring = false;

  const after = (ms: number, action: () => void) => {
    timers.push(window.setTimeout(action, ms));
  };

  /** Back to the start: cursor hidden, first specialist, score at zero. */
  const resetTour = () => {
    timers.forEach(window.clearTimeout);
    timers = [];
    cancelAnimationFrame(countFrame);
    showSpecialist(0);
    section.dataset.cursor = "away";
    delete section.dataset.pressed;
    delete section.dataset.swapping;
    scoreEl.textContent = "0";
  };

  /** Counts the score up from 0, fast at first and slowing down at the end. */
  const countUpScore = (score: number) => {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const eased = 1 - (1 - clamp01(elapsed / SCORE_COUNT_MS)) ** 3;
      scoreEl.textContent = String(Math.round(score * eased));
      if (elapsed < SCORE_COUNT_MS) countFrame = requestAnimationFrame(tick);
    };
    countFrame = requestAnimationFrame(tick);
  };

  /** One stop: move to the specialist, click, count the score, then go on. */
  const visit = (index: number, isFirstStop: boolean) => {
    const arrive = () => {
      showSpecialist(index);
      scoreEl.textContent = "0";
      delete section.dataset.swapping;
      section.dataset.cursor = "arrived";
    };
    if (isFirstStop) {
      arrive();
    } else {
      section.dataset.swapping = "";
      after(CARD_SWAP_MS, arrive);
    }

    after(PRESS_AT_MS, () => {
      section.dataset.pressed = "";
      countUpScore(SPECIALISTS[index].score);
    });
    after(RELEASE_AT_MS, () => delete section.dataset.pressed);
    after(CURSOR_IDLE_AT_MS, () => (section.dataset.cursor = "idle"));
    after(NEXT_STOP_AT_MS, () =>
      visit((index + 1) % SPECIALISTS.length, false),
    );
  };

  // Start the tour when the section is well in view; rewind once it is gone.
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      sectionVisible = entry.isIntersecting;
      schedulePhotoZoom();

      if (entry.intersectionRatio >= START_VISIBLE_RATIO && !touring) {
        touring = true;
        resetTour();
        // Two frames, so the "away" state is painted before the cursor moves in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => visit(0, true)),
        );
      } else if (!entry.isIntersecting && touring) {
        touring = false;
        resetTour();
      }
    },
    { threshold: [0, START_VISIBLE_RATIO] },
  );

  resetTour();
  observer.observe(section);
  window.addEventListener("scroll", schedulePhotoZoom, { passive: true });
}

/**
 * Horizontal origin of the phone layout's zoom, chosen so the featured person
 * ends up in the middle of the frame (clamped at the photo's edges).
 */
function phoneZoomOrigin(personX: number) {
  const origin = clamp01((0.5 - PHONE_ZOOM * personX) / (1 - PHONE_ZOOM));
  return `${(100 * origin).toFixed(1)}%`;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
