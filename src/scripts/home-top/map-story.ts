// "You bring the role…" pinned map story.
//
// The section (.www-tour) is several screens tall and its inner .stick stays
// pinned while the visitor scrolls. Scroll progress (0..1) drives everything:
//   - a lit 3D globe (map-globe.ts) whose camera rises over the horizon,
//     turns to the US, dives into Latin America, closes in on São Paulo and
//     pulls back to show the finished connection;
//   - routes that arc from companies around the world to Latin America;
//   - floating cards and tips (.ov) anchored to places on the globe;
//   - the five text frames (.frame), the "NN / 05" counter, the SCROLL hint
//     and the progress bar.
// Each of the five beats owns a window of the scroll progress (see BEATS).
//
// Fallbacks: reduced motion follows the scroll exactly with no idle motion;
// low-power devices (or frames that run slow) switch to a lighter render
// (half the dots, 1x pixels, no dust or mesh). Without canvas the section
// shows its first text frame (CSS).

import {
  COLORS,
  createGlobeScene,
  loadLandDots,
  type Camera,
  type LatLon,
  type Projected,
  type Quality,
} from "./map-globe";

type Rgba = [number, number, number, number];
type OverlayName = "team" | "hours" | "latam" | "senior" | "prof" | "checks" | "stay" | "edson";
type Point = [number, number];

// Below this stick width the phone layout is used.
const PHONE_MAX_WIDTH = 760;
const PHONE_OVERLAY_SCALE = 0.62;

// How quickly the displayed progress catches up with the real scroll position
// (fraction of the remaining distance per frame).
const SCROLL_EASING = 0.085;

// Scroll-progress windows of the five beats: [start, end].
const BEATS = {
  role: [0.05, 0.25],
  hours: [0.23, 0.43],
  senior: [0.41, 0.61],
  vetted: [0.59, 0.79],
  stay: [0.77, 1.05],
} as const;
// Progress at which each text frame takes over from the previous one.
const FRAME_STARTS = [0.05, 0.23, 0.41, 0.59, 0.77];

const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (from: number, to: number, x: number) => {
  const t = clamp((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const within = (progress: number, [start, end]: readonly [number, number]) => clamp((progress - start) / (end - start));
const fadeInOut = (progress: number, [start, end]: readonly [number, number], fade = 0.035) =>
  Math.min(smoothstep(start, start + fade, progress), 1 - smoothstep(end - fade, end, progress));

// --- Places (lat, lon) ------------------------------------------------------------
const US_CENTER: LatLon = [39, -95];
const SAO_PAULO: LatLon = [-23.5, -46.6];
const LATAM_CENTER: LatLon = [-12, -58];
const MEXICO_CITY: LatLon = [19.4, -99.1];
const COMPANY: LatLon = [40.7, -74]; // the visitor's company (square marker)
const SENIOR_TIP_ANCHOR: LatLon = [-34, -112]; // south Pacific, clear of the hubs
const TALENT_HUBS: LatLon[] = [
  [19.4, -99.1], // Mexico City
  [4.7, -74.1], // Bogotá
  [-12, -77], // Lima
  [-8.05, -34.9], // Recife
  [-23.5, -46.6], // São Paulo
  [-25.3, -57.6], // Asunción
  [-33.4, -70.6], // Santiago
  [-34.6, -58.4], // Buenos Aires
];
// Wireframe between talent hubs: the network of specialists.
const HUB_MESH: [LatLon, LatLon][] = [
  [0, 1], [1, 2], [1, 3], [2, 6], [2, 5], [3, 4], [4, 5], [5, 7], [6, 7], [4, 7], [0, 2],
].map(([a, b]) => [TALENT_HUBS[a], TALENT_HUBS[b]]);
// Companies around the world -> talent in Latin America (illustrative routes).
const GLOBAL_ROUTES: [LatLon, LatLon][] = [
  [[37.8, -122.4], [4.7, -74.1]], // San Francisco -> Bogotá
  [[40.7, -74], [-23.5, -46.6]], // New York -> São Paulo
  [[30.3, -97.7], [19.4, -99.1]], // Austin -> Mexico City
  [[43.7, -79.4], [-34.6, -58.4]], // Toronto -> Buenos Aires
  [[51.5, -0.1], [-23.5, -46.6]], // London -> São Paulo
  [[52.5, 13.4], [4.7, -74.1]], // Berlin -> Bogotá
  [[40.4, -3.7], [-33.4, -70.6]], // Madrid -> Santiago
];
const GLOBAL_MESH: [LatLon, LatLon][] = [
  [[37.8, -122.4], [30.3, -97.7]],
  [[30.3, -97.7], [40.7, -74]],
  [[40.7, -74], [43.7, -79.4]],
  [[51.5, -0.1], [52.5, 13.4]],
  [[51.5, -0.1], [40.4, -3.7]],
];
// Americas time zones, roughly UTC-8 (US West Coast) to UTC-3 (São Paulo, Buenos Aires).
const TIME_BAND = { from: -125, to: -34 };

// --- Camera ------------------------------------------------------------------------
// Keyframes along the scroll. x, y: globe centre as a fraction of the stick;
// r: radius as a fraction of the stick height (desktop) or width (phone).
type Key = { at: number; lat: number; lon: number; x: number; y: number; r: number };
const DESKTOP_KEYS: Key[] = [
  { at: 0, lat: -40, lon: -62, x: 0.66, y: 1.46, r: 1.14 }, // over the horizon
  { at: 0.14, lat: -46, lon: -70, x: 0.67, y: 1.5, r: 1.08 }, // the request goes out
  { at: 0.32, lat: 14, lon: -90, x: 0.69, y: 0.56, r: 0.47 }, // whole globe, US hours
  { at: 0.5, lat: -20, lon: -64, x: 0.68, y: 0.66, r: 0.78 }, // into Latin America
  { at: 0.68, lat: -22, lon: -48, x: 0.8, y: 0.9, r: 1.3 }, // close on São Paulo
  { at: 0.86, lat: 6, lon: -74, x: 0.69, y: 0.55, r: 0.5 }, // pull back: the connection
  { at: 1, lat: 4, lon: -76, x: 0.69, y: 0.54, r: 0.52 },
];
const PHONE_KEYS: Key[] = [
  { at: 0, lat: -40, lon: -66, x: 0.5, y: 1.28, r: 1.35 },
  { at: 0.14, lat: -44, lon: -72, x: 0.5, y: 1.3, r: 1.3 },
  { at: 0.32, lat: 14, lon: -90, x: 0.5, y: 0.76, r: 0.6 },
  { at: 0.5, lat: -20, lon: -62, x: 0.5, y: 0.86, r: 0.95 },
  { at: 0.68, lat: -22, lon: -48, x: 0.62, y: 1.02, r: 1.55 },
  { at: 0.86, lat: 8, lon: -74, x: 0.5, y: 0.76, r: 0.6 },
  { at: 1, lat: 6, lon: -76, x: 0.5, y: 0.75, r: 0.62 },
];
// Land colours at each keyframe: [rest of the world, United States, Latin America].
const DOT_COLOR_KEYS: Rgba[][] = [
  [[150, 158, 205, 0.55], [168, 176, 232, 0.7], [178, 164, 240, 0.8]],
  [[140, 148, 195, 0.5], [160, 170, 230, 0.65], [170, 150, 240, 0.9]],
  [[86, 94, 128, 0.32], [92, 134, 234, 1], [118, 124, 170, 0.5]],
  [[78, 86, 112, 0.3], [78, 86, 112, 0.34], [154, 126, 240, 1]],
  [[70, 76, 100, 0.24], [70, 76, 100, 0.24], [154, 126, 240, 0.62]],
  [[92, 100, 134, 0.36], [92, 134, 234, 1], [154, 126, 240, 1]],
  [[92, 100, 134, 0.36], [92, 134, 234, 1], [154, 126, 240, 1]],
];
// How strongly the worldwide routes show at each keyframe.
const GLOBAL_ROUTE_KEYS = [1, 0.4, 0.16, 0.14, 0.05, 0.42, 0.48];

/** Decides render quality from what the device tells us. */
function initialQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "lite";
  if ((nav.deviceMemory ?? 8) <= 4) return "lite";
  if ((nav.hardwareConcurrency ?? 8) <= 4) return "lite";
  return "high";
}

function startMapStory(section: HTMLElement) {
  const canvas = section.querySelector<HTMLCanvasElement>("[data-why-canvas]");
  if (!canvas || !canvas.getContext("2d")) return;
  const scene = createGlobeScene(canvas);
  scene.setQuality(initialQuality());
  loadLandDots().then((dots) => scene.setDots(dots));

  // Tells the CSS that the script is in charge of the frames.
  section.dataset.tourLive = "";

  const all = <T extends HTMLElement>(selector: string) => [...section.querySelectorAll<T>(selector)];
  const frames = all(".frame");
  const counter = section.querySelector<HTMLElement>("#whyCount")!;
  const progressBar = section.querySelector<HTMLElement>("#whyProg")!;
  const scrollHint = section.querySelector<HTMLElement>("#whyHint")!;
  const textBlock = section.querySelector<HTMLElement>(".why-text")!;
  const atmosphere = section.querySelector<HTMLElement>(".why-atmos");
  const overlays: Record<OverlayName, HTMLElement> = {
    team: section.querySelector<HTMLElement>("#ovTeam")!,
    hours: section.querySelector<HTMLElement>("#ovHours")!,
    latam: section.querySelector<HTMLElement>("#ovLatam")!,
    senior: section.querySelector<HTMLElement>("#ovSenior")!,
    prof: section.querySelector<HTMLElement>("#ovProf")!,
    checks: section.querySelector<HTMLElement>("#ovChecks")!,
    stay: section.querySelector<HTMLElement>("#ovStay")!,
    edson: section.querySelector<HTMLElement>("#ovEdson")!,
  };
  const overlayNames = Object.keys(overlays) as OverlayName[];
  const teamRows = all("#ovTeam .wrow");
  const checkRows = all("#ovChecks .ck2");

  // --- Layout ------------------------------------------------------------------
  let width = 0;
  let height = 0;
  let isPhone = false;
  let overlayScale = 1;
  const overlaySize = {} as Record<OverlayName, Point>;

  function measure() {
    width = canvas!.clientWidth;
    height = canvas!.clientHeight;
    scene.resize(width, height);
    isPhone = width < PHONE_MAX_WIDTH;
    overlayScale = isPhone ? PHONE_OVERLAY_SCALE : clamp(Math.min(width / 1440, height / 885) * 1.04, 0.72, 1.15);
    for (const name of overlayNames) overlaySize[name] = [overlays[name].offsetWidth, overlays[name].offsetHeight];
  }
  measure();

  // --- Camera --------------------------------------------------------------------
  /** Camera for this progress (+ the keyframe segment, for colour blending). */
  function cameraAt(progress: number, enter: number, now: number) {
    const keys = isPhone ? PHONE_KEYS : DESKTOP_KEYS;
    let i = 0;
    while (i < keys.length - 2 && progress > keys[i + 1].at) i++;
    const from = keys[i];
    const to = keys[i + 1];
    const linear = clamp((progress - from.at) / (to.at - from.at));
    const t = 0.85 * easeInOutCubic(linear) + 0.15 * linear;
    const unit = isPhone ? width : height;
    // A slow drift keeps the globe turning while the visitor reads.
    const drift = now ? 2.2 * Math.sin(now * 0.00011) : 0;
    const cam: Camera = {
      lat: lerp(from.lat, to.lat, t) + (now ? 0.8 * Math.cos(now * 0.00009) : 0),
      lon: lerp(from.lon, to.lon, t) + drift,
      x: lerp(from.x, to.x, t) * width,
      // While the section scrolls into view the globe rises from below.
      y: lerp(from.y, to.y, t) * height + (1 - enter) * 0.38 * height,
      r: Math.exp(lerp(Math.log(from.r), Math.log(to.r), t)) * unit,
    };
    return { cam, i, colorMix: smoothstep(0.05, 0.65, linear) };
  }

  // --- Overlays ------------------------------------------------------------------
  /**
   * Positions a card / tip with its top-left corner at (x, y), kept inside
   * the stick and below the text block. Returns where it ended up.
   */
  function placeOverlay(name: OverlayName, x: number, y: number, opacity: number, scale = overlayScale): Point {
    const el = overlays[name];
    const w = overlaySize[name][0] * scale;
    const h = overlaySize[name][1] * scale;
    const minTop = isPhone ? textBlock.offsetHeight - 24 : 84;
    // On wide screens nothing may cover the text column.
    const minLeft = isPhone ? 12 : textBlock.offsetLeft + textBlock.offsetWidth + 28;
    x = Math.max(minLeft, Math.min(width - w - 12, x));
    y = Math.max(minTop, Math.min(height - h - 12, y));
    el.style.opacity = opacity.toFixed(3);
    el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
    if (opacity >= 0.01) el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${scale})`;
    return [x, y];
  }
  /** Hides an overlay whose anchor turned behind the globe. */
  const anchored = (p: Projected, alpha: number) => alpha * clamp(p.facing * 1.5);

  // --- One frame -------------------------------------------------------------------
  let shownFrame = -2;

  function render(progress: number, enter: number, now: number) {
    const s = overlayScale;
    const { cam, i: key, colorMix } = cameraAt(progress, enter, now);
    scene.setCamera(cam);
    const keyColors = DOT_COLOR_KEYS[key].map((c, region) =>
      c.map((ch, k) => lerp(ch, DOT_COLOR_KEYS[key + 1][region][k], colorMix)),
    ) as Rgba[];
    const routeLevel = lerp(GLOBAL_ROUTE_KEYS[key], GLOBAL_ROUTE_KEYS[key + 1], colorMix);
    const t = now * 0.001;

    // Atmosphere layer (CSS gradients) follows the globe for parallax.
    if (atmosphere) {
      atmosphere.style.transform = `translate(${(cam.x - width * 0.66) * 0.35}px, ${(cam.y - height * 0.6) * 0.12}px)`;
      atmosphere.style.opacity = (0.35 + 0.65 * enter).toFixed(3);
    }

    const hoursAlpha = fadeInOut(progress, BEATS.hours);
    const hoursProgress = within(progress, BEATS.hours);
    const bandAlpha = hoursAlpha * smoothstep(0.1, 0.4, hoursProgress);

    scene.begin();
    scene.drawDust(now, 0.6 + 0.4 * enter);
    scene.drawBody(COLORS.indigo, 0.55 + 0.45 * enter);
    scene.drawLand(keyColors, { ...TIME_BAND, alpha: 0.75 * bandAlpha, color: COLORS.periwinkle });
    scene.drawRim(COLORS.indigo, 1);

    // Worldwide routes: drawn in as the section arrives, then they stay as a
    // quiet background network, with a light now and then.
    const reveal = smoothstep(0.15, 1, enter);
    scene.drawMesh(GLOBAL_MESH, 0.16 * routeLevel * reveal);
    GLOBAL_ROUTES.forEach(([from, to], r) => {
      const drawn = smoothstep(r * 0.08, r * 0.08 + 0.45, reveal);
      const alpha = 0.75 * routeLevel;
      scene.drawRoute(from, to, { end: drawn, alpha, head: drawn < 1 });
      if (drawn >= 1 && now) scene.routeLight(from, to, (t * 0.12 + r * 0.31) % 1, alpha);
      scene.drawNode(from, alpha * smoothstep(0, 0.15, drawn), { color: COLORS.white, size: 0.7 });
      scene.drawNode(to, alpha * smoothstep(0.85, 1, drawn), { size: 0.8 });
    });

    // Beat 1, "You bring the role": the request card, fed from your company and two talent hubs.
    const roleAlpha = fadeInOut(progress, BEATS.role);
    const roleProgress = within(progress, BEATS.role);
    const teamAt = isPhone ? placeOverlay("team", 16, 0, roleAlpha) : placeOverlay("team", width * 0.555, height * 0.18, roleAlpha);
    teamRows.forEach((row, i) => row.classList.toggle("show", roleProgress > [0.2, 0.42, 0.8][i]));
    if (roleAlpha > 0) {
      const cardW = overlaySize.team[0] * s;
      const cardH = overlaySize.team[1] * s;
      const company = scene.drawNode(COMPANY, roleAlpha, { square: true, color: COLORS.white });
      const mexico = scene.drawNode(MEXICO_CITY, roleAlpha, { pulse: (t * 0.6) % 1 });
      const saoPaulo = scene.drawNode(SAO_PAULO, roleAlpha, { pulse: (t * 0.6 + 0.5) % 1 });
      const drawn = smoothstep(0.02, 0.35, roleProgress);
      scene.drawConnector(company, { x: teamAt[0] + 0.8 * cardW, y: teamAt[1] + cardH }, drawn, roleAlpha * company.facing, -0.2);
      scene.drawConnector(mexico, { x: teamAt[0] + 0.1 * cardW, y: teamAt[1] + cardH }, drawn, roleAlpha * mexico.facing, 0.18);
      scene.drawConnector(saoPaulo, { x: teamAt[0] + 0.45 * cardW, y: teamAt[1] + cardH }, drawn, roleAlpha * saoPaulo.facing, -0.12);
    }

    // Beat 2, "Working your hours": the Americas' time zones light up as one
    // band and a route runs from the US down to Latin America.
    const us = scene.project(US_CENTER);
    placeOverlay("hours", us.x + 44 * s, us.y - overlaySize.hours[1] * s - 14 * s, anchored(us, hoursAlpha));
    scene.drawMeridian(-120, bandAlpha, "UTC−8");
    scene.drawMeridian(-46.6, bandAlpha, "UTC−3");
    scene.drawNode(us, hoursAlpha, { size: 1.15, color: COLORS.blue, pulse: (t * 0.5) % 1 });
    const lineDrawn = smoothstep(0.32, 0.75, hoursProgress);
    scene.drawRoute(US_CENTER, LATAM_CENTER, {
      end: lineDrawn,
      alpha: hoursAlpha,
      color: COLORS.blue,
      colorTo: COLORS.violet,
      width: 2,
      head: lineDrawn < 1,
    });
    const latam = scene.project(LATAM_CENTER);
    scene.drawNode(latam, hoursAlpha * smoothstep(0.85, 1, lineDrawn), { color: COLORS.violet });
    placeOverlay(
      "latam",
      latam.x - 40 * s,
      latam.y + 14 * s,
      anchored(latam, hoursAlpha * smoothstep(0.85, 1, lineDrawn) * (1 - smoothstep(0.94, 1, hoursProgress))),
    );

    // Beat 3, "Only senior specialists": talent hubs light up one by one and
    // join into one network.
    const seniorAlpha = fadeInOut(progress, BEATS.senior);
    const seniorProgress = within(progress, BEATS.senior);
    scene.drawMesh(HUB_MESH, 0.4 * seniorAlpha * smoothstep(0.45, 0.8, seniorProgress));
    TALENT_HUBS.forEach((hub, i) => {
      const appear = smoothstep(0.08 + 0.075 * i, 0.16 + 0.075 * i, seniorProgress);
      scene.drawNode(hub, seniorAlpha * appear, { color: COLORS.violet, pulse: (t * 0.8 + 0.17 * i) % 1, size: 1.05 });
    });
    const seniorTipAlpha = seniorAlpha * smoothstep(0.12, 0.3, seniorProgress);
    if (isPhone) {
      placeOverlay("senior", 16, height - overlaySize.senior[1] * s - 40, seniorTipAlpha);
    } else {
      const anchor = scene.project(SENIOR_TIP_ANCHOR);
      placeOverlay("senior", anchor.x - overlaySize.senior[0] * s * 0.5, anchor.y - (overlaySize.senior[1] * s) / 2, anchored(anchor, seniorTipAlpha));
    }

    // Beat 4, "Vetted against your role": the profile card and its checks;
    // the globe narrows down to one place.
    const vettedAlpha = fadeInOut(progress, BEATS.vetted);
    const vettedProgress = within(progress, BEATS.vetted);
    const cardScale = isPhone ? Math.min(0.8, (width - 32) / 440) : s;
    const profileAt: Point = isPhone ? [16, 0.4 * height] : [width * (0.39 + 0.076 * vettedProgress), height * 0.17];
    const checksAt: Point = isPhone
      ? [16, 0.4 * height + overlaySize.prof[1] * cardScale + 10]
      : [width * (0.424 + 0.076 * vettedProgress), height * 0.36];
    const checksAlpha = vettedAlpha * smoothstep(0.05, 0.2, vettedProgress);
    const profPlaced = placeOverlay("prof", profileAt[0], profileAt[1], vettedAlpha, cardScale);
    placeOverlay("checks", checksAt[0], checksAt[1], checksAlpha, cardScale);
    checkRows.forEach((row, i) => row.classList.toggle("on", vettedProgress > 0.18 + 0.12 * i));
    if (vettedAlpha > 0) {
      scene.drawFocusRings(SAO_PAULO, smoothstep(0.05, 0.8, vettedProgress), vettedAlpha);
      const sp = scene.drawNode(SAO_PAULO, vettedAlpha, { color: COLORS.violet, size: 1.2 });
      if (!isPhone)
        scene.drawConnector(
          { x: profPlaced[0] + overlaySize.prof[0] * cardScale, y: profPlaced[1] + overlaySize.prof[1] * cardScale * 0.5 },
          sp,
          smoothstep(0.05, 0.4, vettedProgress),
          0.9 * vettedAlpha * sp.facing,
          -0.25,
        );
    }

    // Beat 5, "We stay after they start": São Paulo joined to the US team,
    // with check-ins lighting up along the connection.
    const stayAlpha = fadeInOut(progress, BEATS.stay);
    const stayProgress = clamp((progress - BEATS.stay[0]) / (1 - BEATS.stay[0]));
    const placed = scene.drawNode(SAO_PAULO, stayAlpha, { color: COLORS.violet, size: 1.1, pulse: (t * 0.5) % 1 });
    const usTeam = scene.drawNode(US_CENTER, stayAlpha * smoothstep(0.3, 0.45, stayProgress), { color: COLORS.blue, size: 1.1 });
    const routeDrawn = smoothstep(0.08, 0.45, stayProgress);
    scene.drawRoute(SAO_PAULO, US_CENTER, { end: routeDrawn, alpha: stayAlpha, color: COLORS.violet, colorTo: COLORS.blue, width: 2.2, head: routeDrawn < 1 });
    if (stayAlpha > 0 && routeDrawn >= 1) {
      // Day 30, 60, 90: three check-ins along the line.
      [0.3, 0.6, 0.9].forEach((at, k) => {
        const lit = smoothstep(0.5 + k * 0.08, 0.56 + k * 0.08, stayProgress);
        scene.routeLight(SAO_PAULO, US_CENTER, at, stayAlpha * (0.25 + 0.75 * lit), COLORS.white);
      });
      if (now) scene.routeLight(SAO_PAULO, US_CENTER, (t * 0.35) % 1, stayAlpha, COLORS.violet);
    }
    placeOverlay("edson", placed.x - overlaySize.edson[0] * s * 0.55, placed.y + 22 * s, anchored(placed, stayAlpha * smoothstep(0.02, 0.15, stayProgress)));
    placeOverlay("stay", usTeam.x + 18 * s, usTeam.y - overlaySize.stay[1] * s - 16 * s, anchored(usTeam, stayAlpha * smoothstep(0.42, 0.55, stayProgress)));

    // Text frames, counter, hint and progress bar.
    const frameIndex = FRAME_STARTS.filter((start) => progress >= start).length - 1;
    if (frameIndex !== shownFrame) {
      frames.forEach((frame, i) => {
        frame.classList.toggle("on", i === frameIndex);
        frame.classList.toggle("out", i < frameIndex);
      });
      counter.style.opacity = frameIndex < 0 ? "0" : "1";
      if (frameIndex >= 0) counter.textContent = `0${frameIndex + 1} / 05`;
      scrollHint.style.opacity = frameIndex < 0 ? "1" : "0";
      shownFrame = frameIndex;
    }
    progressBar.style.width = `${(100 * clamp((progress - 0.03) / 0.95)).toFixed(2)}%`;
  }

  // --- Scroll loop -------------------------------------------------------------------
  const motionQuery = matchMedia("(prefers-reduced-motion:reduce)");
  let reducedMotion = motionQuery.matches;
  motionQuery.addEventListener("change", (event) => (reducedMotion = event.matches));

  /** How far the visitor has scrolled through the pinned section, 0..1. */
  function scrollProgress() {
    const top = section.getBoundingClientRect().top;
    const scrollable = section.offsetHeight - innerHeight;
    return clamp(-top / scrollable);
  }
  /** 0 while the section is below the fold, 1 once its top reaches the top of the screen. */
  function enterProgress() {
    return clamp(1 - section.getBoundingClientRect().top / innerHeight);
  }

  let nearViewport = false;
  new IntersectionObserver((entries) => (nearViewport = entries[0].isIntersecting), { rootMargin: "100px" }).observe(section);

  // Frame-time watchdog: if the device can't keep up, drop to the lite render.
  let slowFrames = 0;
  let lastFrame = 0;

  let shownProgress = scrollProgress();
  let shownEnter = enterProgress();
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    if (!nearViewport || document.hidden) {
      lastFrame = 0;
      return;
    }
    if (lastFrame && scene.quality === "high") {
      const dt = now - lastFrame;
      slowFrames = dt > 34 && dt < 250 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 40) scene.setQuality("lite");
    }
    lastFrame = now;

    const target = scrollProgress();
    const targetEnter = enterProgress();
    // The story glides towards the scroll position; with reduced motion it
    // follows it exactly and the idle animations stand still.
    if (reducedMotion) {
      shownProgress = target;
      shownEnter = targetEnter;
    } else {
      shownProgress += (target - shownProgress) * SCROLL_EASING;
      shownEnter += (targetEnter - shownEnter) * 0.12;
      if (Math.abs(target - shownProgress) < 0.0002) shownProgress = target;
    }
    render(shownProgress, shownEnter, reducedMotion ? 0 : now);
  });

  // Redraw straight away when the stick changes size.
  const layout = new ResizeObserver(() => {
    if (canvas.clientWidth === width && canvas.clientHeight === height) return;
    measure();
    if (nearViewport) render(shownProgress, shownEnter, reducedMotion ? 0 : performance.now());
  });
  layout.observe(document.body);
  layout.observe(canvas);
}

const mapStory = document.querySelector<HTMLElement>("#map-story.www-tour");
if (mapStory) startMapStory(mapStory);
