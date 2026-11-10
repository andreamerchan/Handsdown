// Site header behaviour:
//  - hides when scrolling down, returns when scrolling up;
//  - switches between light and dark text depending on the section underneath;
//  - "Hire Talent" dropdown (desktop) and the slide-down menu (mobile).

const HEADER_HEIGHT = 74;
/** Below this scroll position the header never hides. */
const ALWAYS_VISIBLE_UNTIL = 120;
/** Pixels of continuous scrolling down before hiding / up before showing. */
const HIDE_AFTER = 28;
const SHOW_AFTER = 12;
/** The header is fully transparent while the page is scrolled less than this. */
const CLEAR_UNTIL = 8;
/** Page background, used when no section sits under the header. */
const PAGE_COLOR: Rgb = { r: 252, g: 251, b: 252 };
/** Delay before the dropdown closes after the mouse leaves it. */
const MENU_CLOSE_DELAY = 150;

type Rgb = { r: number; g: number; b: number };

const header = document.querySelector<HTMLElement>("[data-site-header]");
if (header) {
  initScrollState(header);
  initHireMenu(header);
  initMobileMenu(header);
}

// ---------------------------------------------------------------- scroll

function parseCssColor(value: string): (Rgb & { a: number }) | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const [r, g, b, a = 1] = match[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return [r, g, b, a].some((n) => n === undefined || Number.isNaN(n))
    ? null
    : { r, g, b, a };
}

/** Solid background of an element, or the first colour of its gradient. */
function backgroundOf(style: CSSStyleDeclaration): Rgb | null {
  const solid = parseCssColor(style.backgroundColor);
  if (solid && solid.a >= 0.9) return solid;
  if (style.backgroundImage.includes("gradient")) {
    const first = parseCssColor(style.backgroundImage);
    if (first && first.a >= 0.5) return first;
  }
  return null;
}

/** A section can declare the colour under the header: data-header-surface="15 23 42". */
function declaredSurface(value: string | undefined): Rgb | null {
  if (!value) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    parts.length !== 3 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function isDark({ r, g, b }: Rgb): boolean {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.36;
}

function initScrollState(header: HTMLElement) {
  let surfaces: HTMLElement[] = [];
  let frame = 0;
  let lastY = window.scrollY;
  let travel = 0;
  let hidden = false;
  let pointerAtTop = false;

  // Wide elements with their own background: candidates for "what is under the header".
  const collectSurfaces = () => {
    surfaces = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
      (el) => {
        if (header.contains(el) || el.offsetWidth < 0.6 * window.innerWidth)
          return false;
        if (declaredSurface(el.dataset.headerSurface)) return true;
        const style = getComputedStyle(el);
        return style.position !== "fixed" && backgroundOf(style) !== null;
      },
    );
  };

  const update = () => {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    const wasHidden = hidden;

    // Keep the header in place while it is being used.
    const held =
      pointerAtTop ||
      header.querySelector(':focus-visible, [aria-expanded="true"]') !== null;
    if (held || y < ALWAYS_VISIBLE_UNTIL) {
      hidden = false;
      travel = 0;
    } else {
      const delta = y - Math.max(lastY, ALWAYS_VISIBLE_UNTIL);
      travel = delta > 0 === travel > 0 ? travel + delta : delta;
      if (travel > HIDE_AFTER) hidden = true;
      else if (travel < -SHOW_AFTER) hidden = false;
    }
    lastY = y;

    // Colour of the section at the header's vertical centre.
    const probeY = HEADER_HEIGHT / 2;
    let under: HTMLElement = document.body;
    for (let i = surfaces.length - 1; i >= 0; i--) {
      const rect = surfaces[i].getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        under = surfaces[i];
        break;
      }
    }
    const declared = declaredSurface(under.dataset.headerSurface);
    const color =
      declared ?? backgroundOf(getComputedStyle(under)) ?? PAGE_COLOR;
    const channels = `${color.r} ${color.g} ${color.b}`;
    const clear = y < CLEAR_UNTIL;

    header.dataset.hidden = String(hidden);
    header.dataset.tone = isDark(color) ? "dark" : "light";
    header.style.backgroundColor = clear
      ? ""
      : declared
        ? `rgb(${channels})`
        : `rgb(${channels} / 0.86)`;
    header.classList.toggle("translate-y-0", !hidden);
    header.classList.toggle("pointer-events-none", hidden);
    header.classList.toggle("-translate-y-full", hidden);
    header.classList.toggle("bg-transparent", clear);
    header.classList.toggle("backdrop-blur-[14px]", !clear);
    header.classList.toggle("backdrop-saturate-[1.4]", !clear);
    // Sticky elements further down the page use this to sit right under the header.
    if (hidden !== wasHidden) {
      document.documentElement.style.setProperty(
        "--site-header-offset",
        `${hidden ? 0 : HEADER_HEIGHT}px`,
      );
    }
  };

  const requestUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  // Layout changes: re-scan the page, at most once a second.
  let rescanTimer = 0;
  let lastScan = 0;
  const requestRescan = () => {
    clearTimeout(rescanTimer);
    rescanTimer = window.setTimeout(
      () => {
        lastScan = performance.now();
        collectSurfaces();
        requestUpdate();
      },
      Math.max(150, 1000 - (performance.now() - lastScan)),
    );
  };

  collectSurfaces();
  update();
  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", requestRescan);
  header.addEventListener("focusin", requestUpdate);
  new MutationObserver(requestUpdate).observe(header, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded"],
  });
  new MutationObserver(requestRescan).observe(document.body, {
    childList: true,
    subtree: true,
  });
  addEventListener(
    "mousemove",
    (event) => {
      const atTop = event.clientY < 24;
      if (atTop !== pointerAtTop) {
        pointerAtTop = atTop;
        requestUpdate();
      }
    },
    { passive: true },
  );
}

// ------------------------------------------------------- Hire Talent menu

/** Text-colour classes of the trigger while the menu is open. */
const OPEN_COLOR = [
  "text-text-brand",
  "group-data-[tone=dark]/header:text-text-inverse-accent",
];
const isColorClass = (name: string) =>
  /^(hover:)?text-text-|^group-data-\[tone=dark\]\/header:(hover:)?text-text-/.test(
    name,
  );

function initHireMenu(header: HTMLElement) {
  const root = header.querySelector<HTMLElement>("[data-hire-menu]");
  const trigger = header.querySelector<HTMLButtonElement>("#hire-menu-trigger");
  const panel = header.querySelector<HTMLElement>("#hire-menu-panel");
  const link = root?.querySelector<HTMLAnchorElement>('a[href="/hire"]');
  if (!root || !trigger || !panel || !link) return;

  const chevron = trigger.querySelector("svg");
  const closedClasses = new Map(
    [link, trigger].map((el) => [el, el.className]),
  );
  let open = false;
  let pinned = false; // opened by click: stays open when the mouse leaves
  let closeTimer = 0;

  const setOpen = (next: boolean) => {
    clearTimeout(closeTimer);
    if (next === open) return;
    open = next;
    if (!open) pinned = false;
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    chevron?.classList.toggle("rotate-180", open);
    for (const [el, closed] of closedClasses) {
      el.className = open
        ? [
            ...closed.split(/\s+/).filter((name) => !isColorClass(name)),
            ...OPEN_COLOR,
          ].join(" ")
        : closed;
    }
  };

  root.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") setOpen(true);
  });
  root.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse" || pinned) return;
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => setOpen(false), MENU_CLOSE_DELAY);
  });
  trigger.addEventListener("click", (event) => {
    const fromKeyboard = event.detail === 0;
    if (fromKeyboard) return setOpen(!open);
    if (open && pinned) return setOpen(false);
    setOpen(true);
    pinned = true;
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      trigger.focus();
    }
  });
  root.addEventListener("focusout", (event) => {
    const next = event.relatedTarget as Node | null;
    if (next !== null && !root.contains(next)) setOpen(false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (open && !root.contains(event.target as Node)) setOpen(false);
  });
  panel.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  });
}

// ------------------------------------------------------------ mobile menu

const ICON_MENU = "M4 7h16M4 12h16M4 17h16";
const ICON_CLOSE = "M6 6l12 12M18 6L6 18";

function initMobileMenu(header: HTMLElement) {
  const toggle = header.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const backdrop = header.querySelector<HTMLElement>("[data-menu-backdrop]");
  const drawer = header.querySelector<HTMLElement>("#site-mobile-menu");
  const hireToggle =
    header.querySelector<HTMLButtonElement>("[data-hire-toggle]");
  const hirePanel = header.querySelector<HTMLElement>("#site-mobile-hire");
  if (!toggle || !backdrop || !drawer) return;

  const setHireOpen = (open: boolean) => {
    if (!hireToggle || !hirePanel) return;
    hirePanel.hidden = !open;
    hireToggle.setAttribute("aria-expanded", String(open));
    hireToggle.classList.toggle("text-text-brand", open);
    hireToggle.classList.toggle("text-text-primary", !open);
    hireToggle.querySelector("svg")?.classList.toggle("rotate-180", open);
  };

  const setOpen = (open: boolean) => {
    drawer.hidden = !open;
    backdrop.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    toggle
      .querySelector("path")
      ?.setAttribute("d", open ? ICON_CLOSE : ICON_MENU);
    if (open) drawer.querySelector<HTMLElement>("a")?.focus();
    else setHireOpen(false);
  };

  toggle.addEventListener("click", () => setOpen(drawer.hidden));
  backdrop.addEventListener("click", () => setOpen(false));
  hireToggle?.addEventListener("click", () =>
    setHireOpen(hirePanel?.hidden ?? false),
  );
  drawer.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
}
