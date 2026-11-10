// Contour lines behind the pricing hero.
//
// On load the four rings draw themselves with CSS animations (see .www-contour-*).
// This script adds the two interactive parts:
//  1. a spotlight that follows the mouse and reveals brighter lines under it;
//  2. on scroll, the rings are "lifted" (undrawn) one after another, the ambient
//     glow fades out and the whole backdrop lags slightly behind the page.

const backdrop = document.querySelector<HTMLElement>(
  '[data-testid="contour-backdrop"]',
);

if (backdrop) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

  // ---- 1. Mouse spotlight -------------------------------------------------

  // The spotlight stays off until the intro drawing has finished
  // (the last ring starts after 1750ms and takes 550ms to draw).
  const INTRO_DRAW_MS = 1750 + 550;
  const introEndsAt = performance.now() + INTRO_DRAW_MS;

  let lastPointer: PointerEvent | null = null;
  let spotlightFrame = 0;

  const moveSpotlight = () => {
    spotlightFrame = 0;
    if (!lastPointer) return;
    const box = backdrop.getBoundingClientRect();
    const y = lastPointer.clientY - box.top;
    backdrop.style.setProperty(
      "--www-mx",
      `${lastPointer.clientX - box.left}px`,
    );
    backdrop.style.setProperty("--www-my", `${y}px`);
    const overBackdrop = y >= 0 && y <= box.height;
    const visible = overBackdrop && performance.now() >= introEndsAt;
    backdrop.style.setProperty("--www-spot", visible ? "1" : "0");
  };

  const hideSpotlight = () => {
    lastPointer = null;
    backdrop.style.setProperty("--www-spot", "0");
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      if (reducedMotion.matches || event.pointerType !== "mouse") return;
      lastPointer = event;
      if (!spotlightFrame)
        spotlightFrame = requestAnimationFrame(moveSpotlight);
    },
    { passive: true },
  );
  window.addEventListener("blur", hideSpotlight);
  document.documentElement.addEventListener("pointerleave", hideSpotlight);

  // ---- 2. Scroll exit -----------------------------------------------------

  // The exit plays over the first 70% of a viewport height of scrolling.
  const SCROLL_RANGE_VH = 70;
  const DONE_AT = 0.98;

  // Portion of the scroll progress over which each ring is lifted (outer ring first).
  const RING_LIFT_WINDOWS = [
    { start: 0.04, end: 0.4 },
    { start: 0.12, end: 0.48 },
    { start: 0.2, end: 0.56 },
    { start: 0.3, end: 0.78 },
  ];
  // Rings rest at 3% opacity and brighten to 8% during the first 12% of their lift.
  const RING_INK_REST = 0.03;
  const RING_INK_BOOST = 0.05;
  const RING_INK_RAMP = 0.12;
  // The ambient glow is gone after 14% of the scroll range.
  const AMBIENT_EXIT_END = 0.14;
  // How far the backdrop trails (and foreground content leads) the scroll, as a share of it.
  const LAG_FACTOR = 0.15;
  const LEAD_FACTOR = -0.08;
  // Scroll progress beyond which the scroll takes over from the intro animation.
  const TAKE_OVER_AT = 0.001;

  let rangeStart = 0;
  let rangeLength = 1;
  let scrollFrame = 0;

  const measure = () => {
    rangeStart = backdrop.getBoundingClientRect().top + window.scrollY;
    rangeLength = (window.innerHeight * SCROLL_RANGE_VH) / 100;
  };

  const applyExit = (progress: number) => {
    if (reducedMotion.matches) return;
    // Once the visitor scrolls, the CSS intro animation is switched off for good
    // and the rings are driven by the variables below.
    if (progress > TAKE_OVER_AT) backdrop.dataset.pen = "scroll";
    if (backdrop.dataset.pen !== "scroll") return;

    RING_LIFT_WINDOWS.forEach(({ start, end }, ring) => {
      const lift = clamp01((progress - start) / (end - start));
      const ink =
        lift <= 0
          ? RING_INK_REST
          : RING_INK_REST + RING_INK_BOOST * clamp01(lift / RING_INK_RAMP);
      backdrop.style.setProperty(`--ring-lift-${ring}`, lift.toFixed(4));
      backdrop.style.setProperty(`--ring-ink-${ring}`, ink.toFixed(3));
    });
    backdrop.style.setProperty(
      "--ambient-exit",
      clamp01(progress / AMBIENT_EXIT_END).toFixed(3),
    );

    const scrolledPx = progress * rangeLength;
    const root = document.documentElement;
    root.style.setProperty(
      "--www-exit-lag-y",
      `${(LAG_FACTOR * scrolledPx).toFixed(1)}px`,
    );
    root.style.setProperty(
      "--www-exit-lead-y",
      `${(LEAD_FACTOR * scrolledPx).toFixed(1)}px`,
    );
  };

  const update = () => {
    scrollFrame = 0;
    const progress =
      rangeLength <= 0
        ? Number(window.scrollY > rangeStart)
        : clamp01((window.scrollY - rangeStart) / rangeLength);
    backdrop.style.setProperty(
      "--scroll-p",
      (reducedMotion.matches ? 0 : progress).toFixed(4),
    );
    backdrop.dataset.scrollDone = progress >= DONE_AT ? "true" : "false";
    applyExit(progress);
  };

  const requestUpdate = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  };
  const remeasure = () => {
    measure();
    requestUpdate();
  };

  measure();
  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", remeasure, { passive: true });
  // The backdrop's position can shift when the page layout changes (fonts, images).
  if (typeof ResizeObserver !== "undefined") {
    const layoutObserver = new ResizeObserver(remeasure);
    layoutObserver.observe(document.body);
    layoutObserver.observe(backdrop);
  }
}
