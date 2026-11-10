// "You bring the role…" pinned map story.
//
// The section (.www-tour) is several screens tall and its inner .stick stays
// pinned while the visitor scrolls. Scroll progress (0..1) drives everything:
//   - a dotted world map on <canvas data-why-canvas> that pans and zooms from
//     the whole world, to the US, to Latin America, to São Paulo and back;
//   - floating cards and tips (.ov) that are positioned over the map;
//   - the five text frames (.frame), the "NN / 05" counter, the SCROLL hint
//     and the progress bar.
// Each of the five beats owns a window of the scroll progress (see BEATS).

type Point = [number, number];
type Rgba = [number, number, number, number];
type OverlayName =
  "team" | "hours" | "latam" | "senior" | "prof" | "checks" | "stay" | "edson";

const DOTS_URL = "/brand/home/world-dots.json";
const DEG = Math.PI / 180;

// The map is designed on a 1440 x 885 artboard; dots and places use its units.
const ART_WIDTH = 1440;
const ART_HEIGHT = 885;
const ART_CENTER: Point = [720, 442.5];
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
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 0..1 while `progress` crosses a window. */
const within = (progress: number, [start, end]: readonly [number, number]) =>
  clamp((progress - start) / (end - start));
/** Opacity of a beat: fades in at the start of its window, out at the end. */
const fadeInOut = (
  progress: number,
  [start, end]: readonly [number, number],
  fade = 0.035,
) =>
  Math.min(
    smoothstep(start, start + fade, progress),
    1 - smoothstep(end - fade, end, progress),
  );

// Mercator projection used by the artboard, and its inverse.
const toMap = (lon: number, lat: number): Point => [
  724.2 + 3.837 * lon,
  491 - 222 * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)),
];
const toLonLat = (x: number, y: number): Point => [
  (x - 724.2) / 3.837,
  (2 * Math.atan(Math.exp((491 - y) / 222)) - Math.PI / 2) / DEG,
];

// Places on the map.
const US_CENTER = toMap(-95, 39);
const SAO_PAULO = toMap(-46.6, -23.5);
const LATAM_CENTER = toMap(-55, -12);
const MEXICO_CITY = toMap(-99.1, 19.4);
const EUROPE_MARKER: Point = [942, 77];
const TEAM_CARD_ANCHOR: Point = [446, 254];
const SENIOR_TIP_ANCHOR = toMap(-110, -6);
const TALENT_HUBS = [
  toMap(-99.1, 19.4),
  toMap(-74.1, 4.7),
  toMap(-77, -12),
  toMap(-34.9, -8.05),
  toMap(-46.6, -23.5),
  toMap(-57.6, -25.3),
  toMap(-70.6, -33.4),
  toMap(-58.4, -34.6),
];

// Camera keyframes along the scroll: zoom and the map point shown at the centre.
const CAMERA_KEYS: { at: number; zoom: number; focus: Point }[] = [
  { at: 0, zoom: 1, focus: [720, 442] },
  { at: 0.14, zoom: 1, focus: [326, 442] },
  { at: 0.32, zoom: 1.1, focus: [338, 425] },
  { at: 0.5, zoom: 1.95, focus: [350, 551] },
  { at: 0.68, zoom: 1.95, focus: [214, 552] },
  { at: 0.86, zoom: 1.55, focus: [284, 432] },
  { at: 1, zoom: 1.62, focus: [292, 428] },
];
// Dot colours at each camera keyframe: [rest of the world, United States,
// Latin America].
const WHITE_DIM: Rgba = [255, 255, 255, 0.5];
const WHITE: Rgba = [255, 255, 255, 0.88];
const GREY: Rgba = [60, 68, 84, 0.85];
const GREY_FAINT: Rgba = [60, 68, 84, 0.35];
const US_BLUE: Rgba = [86, 124, 214, 1];
const LATAM_VIOLET: Rgba = [152, 121, 213, 1];
const DOT_COLOR_KEYS: Rgba[][] = [
  [WHITE_DIM, WHITE_DIM, WHITE_DIM],
  [WHITE, WHITE, WHITE],
  [
    [120, 126, 150, 0.3],
    [124, 134, 255, 1],
    [120, 126, 150, 0.3],
  ],
  [GREY, GREY, LATAM_VIOLET],
  [GREY_FAINT, GREY_FAINT, [152, 121, 213, 0.55]],
  [GREY, US_BLUE, LATAM_VIOLET],
  [GREY, US_BLUE, LATAM_VIOLET],
];

/** Which region a map dot belongs to: 0 = other, 1 = US, 2 = Latin America. */
function regionOf(x: number, y: number): number {
  const [lon, lat] = toLonLat(x, y);
  const isLatam =
    lon > -118 &&
    lon < -30 &&
    (lat < 25.8 ||
      (lon < -106.5 && lat < 32.7) ||
      (lon < -99 && lat < 29.8) ||
      (lon < -97.3 && lat < 27));
  if (isLatam) return 2;
  return lon > -125 && lon < -66 && lat >= 24.5 && lat < 49.4 ? 1 : 0;
}

/** Loads the dots as a flat list of x, y pairs (artboard units). */
async function fetchMapDots(): Promise<number[]> {
  try {
    const response = await fetch(DOTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dots: unknown = await response.json();
    const valid =
      Array.isArray(dots) &&
      dots.length > 0 &&
      dots.length % 2 === 0 &&
      dots.every((n) => Number.isFinite(n));
    if (!valid) throw new TypeError("The map dots are not x, y pairs");
    return dots as number[];
  } catch {
    // Without the dots the story still plays, just without the map.
    return [];
  }
}

function startMapStory(section: HTMLElement) {
  const canvas = section.querySelector<HTMLCanvasElement>("[data-why-canvas]");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  // Tells the CSS that the script is in charge of the frames.
  section.dataset.tourLive = "";

  const all = <T extends HTMLElement>(selector: string) => [
    ...section.querySelectorAll<T>(selector),
  ];
  const frames = all(".frame");
  const counter = section.querySelector<HTMLElement>("#whyCount")!;
  const progressBar = section.querySelector<HTMLElement>("#whyProg")!;
  const scrollHint = section.querySelector<HTMLElement>("#whyHint")!;
  const textBlock = section.querySelector<HTMLElement>(".why-text")!;
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

  // Map dots, filled in once the data has loaded.
  let dots: number[] = [];
  let dotCount = 0;
  let dotRegion = new Uint8Array(0);
  fetchMapDots().then((loaded) => {
    dots = loaded;
    dotCount = loaded.length / 2;
    dotRegion = new Uint8Array(dotCount);
    for (let i = 0; i < dotCount; i++) {
      dotRegion[i] = regionOf(loaded[2 * i], loaded[2 * i + 1]);
    }
  });

  // --- Layout ------------------------------------------------------------------
  let pixelRatio = 1;
  let width = 0;
  let height = 0;
  let isPhone = false;
  let artScale = 1; // artboard units -> CSS pixels
  let artLeft = 0;
  let artTop = 0;
  let overlayScale = 1; // size of the cards, tips and markers
  const overlaySize = {} as Record<OverlayName, Point>;

  function measure() {
    pixelRatio = Math.min(2, devicePixelRatio || 1);
    width = canvas!.clientWidth;
    height = canvas!.clientHeight;
    canvas!.width = width * pixelRatio;
    canvas!.height = height * pixelRatio;
    isPhone = width < PHONE_MAX_WIDTH;
    if (isPhone) {
      // Phone: the map fills the lower part, shifted to show the Americas.
      artScale = (height / ART_HEIGHT) * 0.9;
      artLeft = 0.5 * width - 1000 * artScale;
      artTop = height - ART_HEIGHT * artScale * 0.97;
      overlayScale = PHONE_OVERLAY_SCALE;
    } else {
      // Desktop: the artboard covers the stick, centred.
      artScale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);
      artLeft = (width - ART_WIDTH * artScale) / 2;
      artTop = (height - ART_HEIGHT * artScale) / 2;
      overlayScale = clamp(artScale, 0.72, 1.15);
    }
    for (const name of overlayNames) {
      overlaySize[name] = [
        overlays[name].offsetWidth,
        overlays[name].offsetHeight,
      ];
    }
  }
  measure();
  addEventListener("resize", measure);

  // --- Camera --------------------------------------------------------------------
  let camera = { zoom: 1, focus: [720, 442] as Point };
  /** Map point -> screen position, through the camera. */
  const onScreen = (p: Point): Point => [
    ((p[0] - camera.focus[0]) * camera.zoom + ART_CENTER[0]) * artScale +
      artLeft,
    ((p[1] - camera.focus[1]) * camera.zoom + ART_CENTER[1]) * artScale +
      artTop,
  ];
  /** Artboard point -> screen position, ignoring the camera. */
  const onArtboard = (x: number, y: number): Point => [
    x * artScale + artLeft,
    y * artScale + artTop,
  ];

  /** Moves the camera for this progress and returns the three dot colours. */
  function updateCamera(progress: number, now: number): Rgba[] {
    let i = 0;
    while (i < CAMERA_KEYS.length - 2 && progress > CAMERA_KEYS[i + 1].at) i++;
    const from = CAMERA_KEYS[i];
    const to = CAMERA_KEYS[i + 1];
    const linear = clamp((progress - from.at) / (to.at - from.at));
    const eased = 0.82 * easeInOutCubic(linear) + 0.18 * linear;
    camera = {
      zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom), eased)),
      // A slow sway keeps the map alive while the visitor is not scrolling.
      focus: [
        lerp(from.focus[0], to.focus[0], eased) + 2.2 * Math.sin(0.00022 * now),
        lerp(from.focus[1], to.focus[1], eased) + 1.4 * Math.cos(0.00017 * now),
      ],
    };
    const colorMix = smoothstep(0.08, 0.6, linear);
    return DOT_COLOR_KEYS[i].map(
      (color, region) =>
        color.map((channel, c) =>
          lerp(channel, DOT_COLOR_KEYS[i + 1][region][c], colorMix),
        ) as Rgba,
    );
  }

  // --- Drawing helpers -------------------------------------------------------------

  /**
   * Positions a card / tip with its top-left corner at (x, y), kept inside
   * the stick and below the text block. Returns where it ended up.
   */
  function placeOverlay(
    name: OverlayName,
    x: number,
    y: number,
    opacity: number,
    scale = overlayScale,
  ): Point {
    const el = overlays[name];
    const w = overlaySize[name][0] * scale;
    const h = overlaySize[name][1] * scale;
    const minTop = isPhone ? textBlock.offsetHeight - 24 : 84;
    x = Math.max(12, Math.min(width - w - 12, x));
    y = Math.max(minTop, Math.min(height - h - 12, y));
    el.style.opacity = opacity.toFixed(3);
    el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
    if (opacity >= 0.01) {
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${scale})`;
    }
    return [x, y];
  }

  /** Point at `t` on the curved connector from `from` to `to`. */
  function curvePoint(from: Point, to: Point, bend: number, t: number): Point {
    const control: Point = [
      (from[0] + to[0]) / 2 - (to[1] - from[1]) * bend,
      (from[1] + to[1]) / 2 + (to[0] - from[0]) * bend,
    ];
    const u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ];
  }

  /** Glowing curved line, drawn up to `drawn` (0..1) of its length. */
  function drawConnector(
    from: Point,
    to: Point,
    drawn: number,
    alpha: number,
    bend = 0.25,
  ) {
    if (drawn <= 0 || alpha <= 0) return;
    const STEPS = 40;
    ctx!.save();
    ctx!.globalAlpha = alpha;
    ctx!.strokeStyle = "rgba(235,236,255,.8)";
    ctx!.lineWidth = 1.4;
    ctx!.shadowColor = "rgba(200,200,255,.9)";
    ctx!.shadowBlur = 10;
    ctx!.beginPath();
    for (let i = 0; i <= STEPS * drawn; i++) {
      const [x, y] = curvePoint(from, to, bend, i / STEPS);
      if (i) ctx!.lineTo(x, y);
      else ctx!.moveTo(x, y);
    }
    ctx!.stroke();
    ctx!.restore();
  }

  /** White marker with a soft glow (round, or square for the "elsewhere" one). */
  function drawMarker(at: Point, alpha: number, size = 1, square = false) {
    if (alpha <= 0) return;
    const s = overlayScale;
    const glowRadius = 16 * s * size;
    ctx!.save();
    ctx!.globalAlpha = alpha;
    const glow = ctx!.createRadialGradient(
      at[0],
      at[1],
      0,
      at[0],
      at[1],
      glowRadius,
    );
    glow.addColorStop(0, "rgba(255,255,255,.55)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(at[0], at[1], glowRadius, 0, 7);
    ctx!.fill();
    ctx!.fillStyle = "#fff";
    if (square) {
      ctx!.fillRect(at[0] - 5 * s, at[1] - 5 * s, 10 * s, 10 * s);
    } else {
      ctx!.beginPath();
      ctx!.arc(at[0], at[1], 4.6 * s * size, 0, 7);
      ctx!.fill();
    }
    ctx!.restore();
  }

  /** Pulsing violet dot for a talent hub. */
  function drawHub(at: Point, alpha: number, now: number, phase: number) {
    if (alpha <= 0) return;
    const s = overlayScale;
    const pulse = (0.0012 * now + phase) % 1;
    ctx!.save();
    ctx!.globalAlpha = alpha * (1 - pulse) * 0.6;
    ctx!.fillStyle = "#8f97ff";
    ctx!.beginPath();
    ctx!.arc(at[0], at[1], (8 + 18 * pulse) * s, 0, 7);
    ctx!.fill();
    ctx!.globalAlpha = 0.45 * alpha;
    ctx!.fillStyle = "#5b6178";
    ctx!.beginPath();
    ctx!.arc(at[0], at[1], 11 * s, 0, 7);
    ctx!.fill();
    ctx!.globalAlpha = alpha;
    ctx!.fillStyle = "#7c8cff";
    ctx!.beginPath();
    ctx!.arc(at[0], at[1], 6 * s, 0, 7);
    ctx!.fill();
    ctx!.restore();
  }

  // --- One frame -------------------------------------------------------------------
  let shownFrame = -2;

  function render(progress: number, now: number) {
    const c = ctx!;
    const s = overlayScale;
    const dotColors = updateCamera(progress, now);

    c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    c.clearRect(0, 0, width, height);

    // The dotted map, one fill per region.
    const dotRadius = Math.max(0.75, 1.2 * camera.zoom * artScale);
    for (let region = 0; region < 3; region++) {
      const color = dotColors[region];
      if (color[3] < 0.01) continue;
      c.fillStyle = `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${color[3].toFixed(3)})`;
      c.beginPath();
      for (let i = 0; i < dotCount; i++) {
        if (dotRegion[i] !== region) continue;
        const [x, y] = onScreen([dots[2 * i], dots[2 * i + 1]]);
        if (x < -6 || y < -6 || x > width + 6 || y > height + 6) continue;
        c.moveTo(x + dotRadius, y);
        c.arc(x, y, dotRadius, 0, 6.2832);
      }
      c.fill();
    }

    // Beat 1, "You bring the role": the request card, fed from three places.
    const roleAlpha = fadeInOut(progress, BEATS.role);
    const roleProgress = within(progress, BEATS.role);
    const teamAnchor = onScreen(TEAM_CARD_ANCHOR);
    const teamAt = placeOverlay(
      "team",
      teamAnchor[0],
      teamAnchor[1],
      roleAlpha,
    );
    teamRows.forEach((row, i) =>
      row.classList.toggle("show", roleProgress > [0.2, 0.42, 0.8][i]),
    );
    if (roleAlpha > 0) {
      const cardWidth = overlaySize.team[0] * s;
      const cardHeight = overlaySize.team[1] * s;
      const mexico = onScreen(MEXICO_CITY);
      const saoPaulo = onScreen(SAO_PAULO);
      const europe = onScreen(EUROPE_MARKER);
      drawMarker(mexico, roleAlpha);
      drawMarker(saoPaulo, roleAlpha);
      drawMarker(europe, roleAlpha, 1, true);
      const lineAlpha = 0.9 * roleAlpha;
      drawConnector(
        mexico,
        [teamAt[0], teamAt[1] + 0.55 * cardHeight],
        roleAlpha,
        lineAlpha,
        -0.18,
      );
      drawConnector(
        saoPaulo,
        [teamAt[0] + 0.12 * cardWidth, teamAt[1] + cardHeight],
        roleAlpha,
        lineAlpha,
        0.2,
      );
      drawConnector(
        europe,
        [teamAt[0] + 0.8 * cardWidth, teamAt[1]],
        roleAlpha,
        lineAlpha,
        0.2,
      );
    }

    // Beat 2, "Working your hours": the US tip and a line down to Latin America.
    const hoursAlpha = fadeInOut(progress, BEATS.hours);
    const hoursProgress = within(progress, BEATS.hours);
    const us = onScreen(US_CENTER);
    placeOverlay(
      "hours",
      us[0] + 44 * s,
      us[1] - overlaySize.hours[1] * s - 14 * s,
      hoursAlpha,
    );
    drawMarker(us, hoursAlpha, 1.1);
    const latamCenter = onScreen(LATAM_CENTER);
    const lineDrawn = smoothstep(0.32, 0.75, hoursProgress);
    drawConnector(us, latamCenter, lineDrawn, hoursAlpha, 0.22);
    placeOverlay(
      "latam",
      latamCenter[0] - 40 * s,
      latamCenter[1] + 10 * s,
      hoursAlpha *
        smoothstep(0.85, 1, lineDrawn) *
        (1 - smoothstep(0.94, 1, hoursProgress)),
    );

    // Beat 3, "Only senior specialists": talent hubs light up one by one.
    const seniorAlpha = fadeInOut(progress, BEATS.senior);
    const seniorProgress = within(progress, BEATS.senior);
    TALENT_HUBS.forEach((hub, i) => {
      const appear = smoothstep(
        0.08 + 0.075 * i,
        0.16 + 0.075 * i,
        seniorProgress,
      );
      drawHub(onScreen(hub), seniorAlpha * appear, now, 0.17 * i);
    });
    const seniorTipAlpha = seniorAlpha * smoothstep(0.12, 0.3, seniorProgress);
    if (isPhone) {
      placeOverlay(
        "senior",
        16,
        height - overlaySize.senior[1] * s - 40,
        seniorTipAlpha,
      );
    } else {
      const anchor = onScreen(SENIOR_TIP_ANCHOR);
      placeOverlay(
        "senior",
        anchor[0],
        anchor[1] - (overlaySize.senior[1] * s) / 2,
        seniorTipAlpha,
      );
    }

    // Beat 4, "Vetted against your role": the profile card and its checks.
    const vettedAlpha = fadeInOut(progress, BEATS.vetted);
    const vettedProgress = within(progress, BEATS.vetted);
    const cardScale = isPhone ? Math.min(0.8, (width - 32) / 440) : s;
    const profileAt: Point = isPhone
      ? [16, 0.4 * height]
      : onArtboard(560 + 110 * vettedProgress, 150);
    const checksAt: Point = isPhone
      ? [16, 0.4 * height + overlaySize.prof[1] * cardScale + 10]
      : onArtboard(610 + 110 * vettedProgress, 320);
    const checksAlpha = vettedAlpha * smoothstep(0.05, 0.2, vettedProgress);
    placeOverlay("prof", profileAt[0], profileAt[1], vettedAlpha, cardScale);
    placeOverlay("checks", checksAt[0], checksAt[1], checksAlpha, cardScale);
    checkRows.forEach((row, i) =>
      row.classList.toggle("on", vettedProgress > 0.18 + 0.12 * i),
    );
    if (vettedAlpha > 0) {
      const saoPaulo = onScreen(SAO_PAULO);
      drawMarker(saoPaulo, vettedAlpha);
      drawConnector(
        [
          profileAt[0] + overlaySize.prof[0] * cardScale,
          profileAt[1] + overlaySize.prof[1] * cardScale * 0.5,
        ],
        saoPaulo,
        smoothstep(0.05, 0.4, vettedProgress),
        0.9 * vettedAlpha,
        -0.25,
      );
    }

    // Beat 5, "We stay after they start": São Paulo joined to the US team.
    const stayAlpha = fadeInOut(progress, BEATS.stay);
    const stayProgress = clamp(
      (progress - BEATS.stay[0]) / (1 - BEATS.stay[0]),
    );
    const placedAt = onScreen(SAO_PAULO);
    const teamAtUs = onScreen(US_CENTER);
    const STAY_BEND = 0.18;
    drawMarker(placedAt, stayAlpha, 0.9);
    drawMarker(teamAtUs, stayAlpha * smoothstep(0.3, 0.45, stayProgress), 0.9);
    drawConnector(
      placedAt,
      teamAtUs,
      smoothstep(0.08, 0.45, stayProgress),
      stayAlpha,
      STAY_BEND,
    );
    if (stayAlpha > 0 && stayProgress > 0.45) {
      // A light keeps travelling along the finished line.
      const [x, y] = curvePoint(
        placedAt,
        teamAtUs,
        STAY_BEND,
        (0.00035 * now) % 1,
      );
      c.save();
      c.globalAlpha = stayAlpha;
      c.fillStyle = "#fff";
      c.shadowColor = "#b9b4ff";
      c.shadowBlur = 14;
      c.beginPath();
      c.arc(x, y, 3 * s, 0, 7);
      c.fill();
      c.restore();
    }
    placeOverlay(
      "edson",
      placedAt[0] - overlaySize.edson[0] * s * 0.55,
      placedAt[1] + 22 * s,
      stayAlpha * smoothstep(0.02, 0.15, stayProgress),
    );
    placeOverlay(
      "stay",
      teamAtUs[0] + 18 * s,
      teamAtUs[1] - overlaySize.stay[1] * s - 16 * s,
      stayAlpha * smoothstep(0.42, 0.55, stayProgress),
    );

    // Text frames, counter, hint and progress bar.
    const frameIndex =
      FRAME_STARTS.filter((start) => progress >= start).length - 1;
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
  motionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
  });

  /** How far the visitor has scrolled through the pinned section, 0..1. */
  function scrollProgress() {
    const top = section.getBoundingClientRect().top;
    const scrollable = section.offsetHeight - innerHeight;
    return clamp(-top / scrollable);
  }

  let nearViewport = false;
  new IntersectionObserver(
    (entries) => {
      nearViewport = entries[0].isIntersecting;
    },
    { rootMargin: "100px" },
  ).observe(section);

  let shownProgress = scrollProgress();
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    if (!nearViewport) return;
    const target = scrollProgress();
    // The story glides towards the scroll position; with reduced motion it
    // follows it exactly and the idle animations stand still.
    shownProgress = reducedMotion
      ? target
      : shownProgress + (target - shownProgress) * SCROLL_EASING;
    if (Math.abs(target - shownProgress) < 0.0002) shownProgress = target;
    render(shownProgress, reducedMotion ? 0 : now);
  });

  // Redraw straight away when the stick changes size.
  const layout = new ResizeObserver(() => {
    if (canvas.clientWidth === width && canvas.clientHeight === height) return;
    measure();
    if (nearViewport) render(shownProgress, performance.now());
  });
  layout.observe(document.body);
  layout.observe(canvas);
}

const mapStory = document.querySelector<HTMLElement>("#map-story.www-tour");
if (mapStory) startMapStory(mapStory);
