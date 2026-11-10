// Hero "handsdown network" globe.
//
// A dotted globe is drawn on <canvas data-network-canvas> and plays a short
// story on a fixed timeline (seconds since the hero became visible):
//   0.0  the globe fades in over the United States, US cities light up
//   3.7  the camera travels south, a scan line sweeps down Latin America
//   7.0  arcs fly from Latin American cities to US cities
//   9.6  the "Latin America" pin appears; after that the globe idles, drifting
//        slowly while random arcs keep flying.
// The three caption lines (.hs-line) and the floating chips (.hs-o) follow the
// same timeline. With reduced motion a single finished frame is drawn instead.

type Vec3 = [number, number, number];
type Rgb = [number, number, number];
type City = { name: string; lat: number; v: Vec3 };

const DOTS_URL = "/brand/home/network-dots.txt";
const DEG = Math.PI / 180;
const FULL_CIRCLE = 6.283;

// The frame shown when the visitor prefers reduced motion.
const STILL_FRAME_TIME = 14.2;
// From here on the story is over and random arcs start flying.
const FIRST_RANDOM_ARC_TIME = 11.7;
// Typing in the hero prompt fires an arc at most this often (seconds).
const TYPING_ARC_INTERVAL = 0.7;

const INDIGO: Rgb = [0x6e, 0x7b, 0xff]; // rest of the world
const BLUE: Rgb = [0x4f, 0x85, 0xe8]; // United States
const VIOLET = "152,121,213";
const DEEP_VIOLET = "90,31,130";
// Latin America is tinted north to south, and arcs use the same ramp.
const LATAM_RAMP: Rgb[] = [BLUE, [0x98, 0x79, 0xd5], [0x5a, 0x1f, 0x82]];

const clamp = (x: number, min = 0, max = 1) =>
  x < min ? min : x > max ? max : x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (from: number, to: number, x: number) => {
  const t = clamp((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const mixRgb = (a: Rgb, b: Rgb, t: number) =>
  a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
const latamRamp = (t: number) =>
  t < 0.47
    ? mixRgb(LATAM_RAMP[0], LATAM_RAMP[1], t / 0.47)
    : mixRgb(LATAM_RAMP[1], LATAM_RAMP[2], (t - 0.47) / 0.53);

/** Unit vector on the globe for a latitude / longitude in degrees. */
const toVector = (lat: number, lon: number): Vec3 => [
  Math.cos(lat * DEG) * Math.sin(lon * DEG),
  Math.sin(lat * DEG),
  Math.cos(lat * DEG) * Math.cos(lon * DEG),
];
const city = (name: string, lat: number, lon: number): City => ({
  name,
  lat,
  v: toVector(lat, lon),
});

const US_CITIES = [
  city("New York", 40.71, -74),
  city("San Francisco", 37.77, -122.42),
  city("Austin", 30.27, -97.74),
  city("Chicago", 41.88, -87.63),
  city("Miami", 25.76, -80.19),
  city("Seattle", 47.6, -122.33),
  city("Boston", 42.36, -71.06),
];
const LATAM_CITIES = [
  city("Mexico City", 19.43, -99.13),
  city("Guadalajara", 20.67, -103.35),
  city("Bogotá", 4.71, -74.07),
  city("Medellín", 6.24, -75.58),
  city("Lima", -12.05, -77.04),
  city("São Paulo", -23.55, -46.63),
  city("Buenos Aires", -34.6, -58.38),
  city("Santiago", -33.45, -70.67),
];
const CITY_BY_NAME: Record<string, City> = Object.fromEntries(
  [...US_CITIES, ...LATAM_CITIES].map((c) => [c.name, c]),
);
// Cities whose names are printed next to them once the story has finished.
const LABELLED_CITIES = [
  "New York",
  "Miami",
  "Austin",
  "San Francisco",
  "Bogotá",
  "São Paulo",
  "Mexico City",
  "Buenos Aires",
];
// Number of US cities a "typing" arc may land on (the first four in the list).
const TYPING_ARC_TARGETS = 4;
// Where the "Latin America" pin sits (centre of the continent).
const LATAM_PIN = toVector(-8, -60);

// The fixed routes of the story: [from, to, start time].
const ROUTES = (
  [
    ["Bogotá", "Miami", 7],
    ["São Paulo", "New York", 7.3],
    ["Mexico City", "Austin", 7.65],
    ["Buenos Aires", "San Francisco", 8],
    ["Medellín", "Chicago", 8.35],
    ["Santiago", "Seattle", 8.7],
  ] as const
).map(([from, to, startTime], i) => ({
  from: CITY_BY_NAME[from],
  to: CITY_BY_NAME[to],
  startTime,
  phase: 0.37 * i,
  landed: false,
}));
const ROUTE_DRAW_SECONDS = 1.7;
const ROUTE_LIFT = 0.16;

// Camera keyframes: where the globe is centred and how far it is zoomed.
type CameraKey = { t: number; lon: number; lat: number; z: number };
type CameraAxis = "lon" | "lat" | "z";
const CAMERA_KEYS: CameraKey[] = [
  { t: 0, lon: -98, lat: 36, z: 0.92 },
  { t: 3.3, lon: -92, lat: 32, z: 1 },
  { t: 6.7, lon: -63, lat: -12, z: 1.12 },
  { t: 10.2, lon: -80, lat: 9, z: 1 },
];
const CAMERA_END = CAMERA_KEYS[CAMERA_KEYS.length - 1];
// Catmull-Rom tangents, flat at both ends, for a smooth camera path.
const CAMERA_TANGENTS = CAMERA_KEYS.map((key, i) => {
  if (i === 0 || i === CAMERA_KEYS.length - 1) return { lon: 0, lat: 0, z: 0 };
  const prev = CAMERA_KEYS[i - 1];
  const next = CAMERA_KEYS[i + 1];
  const span = next.t - prev.t;
  return {
    lon: (next.lon - prev.lon) / span,
    lat: (next.lat - prev.lat) / span,
    z: (next.z - prev.z) / span,
  };
});

function cameraValue(time: number, axis: CameraAxis): number {
  if (time >= CAMERA_END.t) return CAMERA_END[axis];
  let i = 0;
  while (time > CAMERA_KEYS[i + 1].t) i++;
  const a = CAMERA_KEYS[i];
  const b = CAMERA_KEYS[i + 1];
  const span = b.t - a.t;
  const u = (time - a.t) / span;
  const u2 = u * u;
  const u3 = u2 * u;
  // Cubic Hermite interpolation between the two keyframes.
  return (
    (2 * u3 - 3 * u2 + 1) * a[axis] +
    (u3 - 2 * u2 + u) * span * CAMERA_TANGENTS[i][axis] +
    (-2 * u3 + 3 * u2) * b[axis] +
    (u3 - u2) * span * CAMERA_TANGENTS[i + 1][axis]
  );
}

/** Point at fraction `t` of the great circle from `a` to `b`. */
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const angle = Math.acos(
    clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1),
  );
  const sin = Math.sin(angle) || 1e-6;
  const wa = Math.sin((1 - t) * angle) / sin;
  const wb = Math.sin(t * angle) / sin;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
}

type LandDots = {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  lat: Float32Array;
  /** 0 = rest of the world, 1 = United States, 2 = Latin America */
  region: Uint8Array;
};

/**
 * The land dots come as base64: 4 bytes per dot, two little-endian uint16.
 * First: (latitude + 90) * 100 in the low 15 bits, top bit = Latin America.
 * Second: (longitude + 180) * 100.
 */
function decodeLandDots(base64: string): LandDots {
  const bytes = atob(base64);
  const count = bytes.length / 4;
  const dots: LandDots = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    lat: new Float32Array(count),
    region: new Uint8Array(count),
  };
  for (let i = 0; i < count; i++) {
    const first = bytes.charCodeAt(4 * i) | (bytes.charCodeAt(4 * i + 1) << 8);
    const second =
      bytes.charCodeAt(4 * i + 2) | (bytes.charCodeAt(4 * i + 3) << 8);
    const lat = (first & 0x7fff) / 100 - 90;
    const lon = second / 100 - 180;
    const isLatam = first >> 15 === 1;
    const isUs = lat > 24.5 && lat < 49.4 && lon > -125 && lon < -66.5;
    [dots.x[i], dots.y[i], dots.z[i]] = toVector(lat, lon);
    dots.lat[i] = lat;
    dots.region[i] = isLatam ? 2 : isUs ? 1 : 0;
  }
  return dots;
}

async function fetchLandDots(): Promise<LandDots> {
  try {
    const response = await fetch(DOTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decodeLandDots((await response.text()).trim());
  } catch {
    // Without the dots the globe still shows its grid, cities and arcs.
    return decodeLandDots("");
  }
}

/**
 * Starts the globe inside `.www-net-stage`. Returns a function that stops it.
 */
function startGlobe(
  stage: HTMLElement,
  promptInput: HTMLInputElement | null,
  dots: LandDots,
): () => void {
  const canvas = stage.querySelector<HTMLCanvasElement>(
    "[data-network-canvas]",
  );
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return () => {};

  const stop = new AbortController();
  const { signal } = stop;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const labelFont = `500 11px ${getComputedStyle(canvas).fontFamily}`;

  const captionLines = [...stage.querySelectorAll<HTMLElement>(".hs-line")];
  const teamChip = stage.querySelector<HTMLElement>("#hsCo");
  const talentChipBogota = stage.querySelector<HTMLElement>("#hsT1");
  const talentChipSaoPaulo = stage.querySelector<HTMLElement>("#hsT2");
  const latamPinChip = stage.querySelector<HTMLElement>("#hsPin");
  let shownCaption = -1;

  // Stage size, pixel ratio, and the globe's centre and base radius.
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let centerX = 0;
  let centerY = 0;
  let baseRadius = 0;

  // Pointer parallax: `pointerTarget` follows the mouse (-1..1 on each axis),
  // `pointer` eases towards it every frame.
  const pointer = [0, 0];
  let pointerTarget = [0, 0];

  // Current globe rotation (row-major 3x3), rebuilt every frame.
  let rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const rotate = (v: Vec3): Vec3 => [
    rotation[0] * v[0] + rotation[1] * v[1] + rotation[2] * v[2],
    rotation[3] * v[0] + rotation[4] * v[1] + rotation[5] * v[2],
    rotation[6] * v[0] + rotation[7] * v[1] + rotation[8] * v[2],
  ];

  function measure() {
    const box = stage.getBoundingClientRect();
    width = box.width;
    height = box.height;
    pixelRatio = Math.min(devicePixelRatio || 1, 2);
    canvas!.width = (width * pixelRatio) | 0;
    canvas!.height = (height * pixelRatio) | 0;
    if (innerWidth <= 980) {
      // Narrow layout: globe centred behind the text.
      baseRadius = Math.min(0.44 * width, 0.42 * height);
      centerX = 0.5 * width;
      centerY = 0.55 * height;
    } else {
      // Wide layout: globe on the right-hand side.
      baseRadius = Math.min(0.29 * width, 0.45 * height);
      centerX = 0.73 * width;
      centerY = 0.53 * height;
    }
    if (reducedMotion) draw(STILL_FRAME_TIME);
  }

  /** Shows a floating chip next to a place on the globe, or hides it. */
  function placeChip(
    chip: HTMLElement | null,
    place: Vec3,
    radius: number,
    visible: boolean,
    offsetX: number,
    offsetY: number,
    anchor: "" | "left" | "center",
  ) {
    if (!chip) return;
    const p = rotate(place);
    const show = visible && p[2] > 0.15;
    chip.classList.toggle("on", show);
    if (!show) return;
    const chipWidth = chip.offsetWidth;
    const chipHeight = chip.offsetHeight;
    let x = centerX + p[0] * radius + offsetX;
    let y = centerY - p[1] * radius + offsetY - chipHeight;
    if (anchor === "left") x -= chipWidth;
    if (anchor === "center") x -= chipWidth / 2;
    x = clamp(x, 8, width - chipWidth - 8);
    y = clamp(y, 8, height - chipHeight - 8);
    chip.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }

  // Extra arcs (random ones while idling, and one per burst of typing) and
  // the rings that expand where an arc lands.
  type Arc = {
    from: City;
    to: City;
    startTime: number;
    duration: number;
    lift: number;
    color: string;
    landed: boolean;
  };
  type Ring = { at: Vec3; startTime: number; color: string };
  const arcs: Arc[] = [];
  const rings: Ring[] = [];

  function launchArc(from: City, to: City, startTime: number, color: string) {
    const angle = Math.acos(
      clamp(
        from.v[0] * to.v[0] + from.v[1] * to.v[1] + from.v[2] * to.v[2],
        -1,
        1,
      ),
    );
    // Longer trips take longer and fly higher above the surface.
    arcs.push({
      from,
      to,
      startTime,
      duration: 1.1 + 0.6 * angle,
      lift: 0.06 + 0.16 * angle,
      color,
      landed: false,
    });
  }

  /** Screen position of a point on a lifted arc: [x, y, visible, fraction]. */
  function arcPoint(
    from: Vec3,
    to: Vec3,
    lift: number,
    fraction: number,
    radius: number,
  ): [number, number, boolean, number] {
    const onSurface = slerp(from, to, fraction);
    const altitude = 1 + lift * Math.sin(Math.PI * fraction);
    const p = rotate([
      onSurface[0] * altitude,
      onSurface[1] * altitude,
      onSurface[2] * altitude,
    ]);
    // Hidden only when it is behind the globe's disc.
    const visible = p[2] > 0 || p[0] * p[0] + p[1] * p[1] > 1;
    return [
      centerX + p[0] * radius,
      centerY - p[1] * radius,
      visible,
      fraction,
    ];
  }

  function arcPoints(
    from: Vec3,
    to: Vec3,
    lift: number,
    upTo: number,
    radius: number,
    steps = 40,
  ) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      points.push(arcPoint(from, to, lift, (upTo * i) / steps, radius));
    }
    return points;
  }

  /** A dot with a soft halo. */
  function glowDot(
    x: number,
    y: number,
    r: number,
    rgb: string,
    alpha: number,
  ) {
    ctx!.fillStyle = `rgba(${rgb},${0.2 * alpha})`;
    ctx!.beginPath();
    ctx!.arc(x, y, 2.6 * r, 0, FULL_CIRCLE);
    ctx!.fill();
    ctx!.fillStyle = `rgba(${rgb},${alpha})`;
    ctx!.beginPath();
    ctx!.arc(x, y, r, 0, FULL_CIRCLE);
    ctx!.fill();
  }

  function draw(time: number) {
    const c = ctx!;

    // --- Camera -----------------------------------------------------------
    let lon = cameraValue(time, "lon");
    let lat = cameraValue(time, "lat");
    const zoom = cameraValue(time, "z");
    // After the story the globe keeps drifting gently.
    const drift = smoothstep(10.2, 13.2, time);
    const driftTime = time - 10.2;
    lon += 5 * drift * Math.sin(0.13 * driftTime) + 7 * pointer[0];
    lat += 2.2 * drift * Math.sin(0.09 * driftTime) - 4 * pointer[1];
    const radius = baseRadius * zoom;

    const yaw = -lon * DEG;
    const pitch = lat * DEG;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    rotation = [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
    const project = (v: Vec3): [number, number, number] => {
      const p = rotate(v);
      return [centerX + p[0] * radius, centerY - p[1] * radius, p[2]];
    };

    c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    c.clearRect(0, 0, width, height);

    // --- Story phases (0..1 each) -------------------------------------------
    const globeIn = smoothstep(0, 1.6, time);
    const usHighlight =
      smoothstep(0.9, 2.6, time) * lerp(1, 0.5, smoothstep(6, 8, time));
    const latamHighlight = smoothstep(3.7, 5.6, time);
    const scanning = time > 3.9 && time < 7.2;
    const scanLat = lerp(36, -60, smoothstep(4, 6.8, time));

    // --- Halo and shading ---------------------------------------------------
    let gradient = c.createRadialGradient(
      centerX,
      centerY,
      0.9 * radius,
      centerX,
      centerY,
      1.22 * radius,
    );
    gradient.addColorStop(0, `rgba(152,121,213,${0.11 * globeIn})`);
    gradient.addColorStop(0.45, `rgba(110,123,255,${0.05 * globeIn})`);
    gradient.addColorStop(1, "rgba(110,123,255,0)");
    c.fillStyle = gradient;
    c.beginPath();
    c.arc(centerX, centerY, 1.22 * radius, 0, FULL_CIRCLE);
    c.fill();

    gradient = c.createRadialGradient(
      centerX - 0.35 * radius,
      centerY - 0.4 * radius,
      0.1 * radius,
      centerX,
      centerY,
      radius,
    );
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, `rgba(110,123,255,${0.035 * globeIn})`);
    c.fillStyle = gradient;
    c.beginPath();
    c.arc(centerX, centerY, radius, 0, FULL_CIRCLE);
    c.fill();

    // --- Dashed grid of meridians and parallels -------------------------------
    c.save();
    c.setLineDash([1.2, 4.5]);
    c.lineWidth = 0.8;
    c.strokeStyle = `rgba(110,123,255,${0.13 * globeIn})`;
    c.beginPath();
    const gridLine = (pointAt: (t: number) => Vec3) => {
      let drawing = false;
      for (let i = 0; i <= 72; i++) {
        const [x, y, depth] = project(pointAt(i / 72));
        if (depth < 0.02) {
          drawing = false;
          continue;
        }
        if (drawing) c.lineTo(x, y);
        else c.moveTo(x, y);
        drawing = true;
      }
    };
    for (let meridian = -180; meridian < 180; meridian += 30) {
      gridLine((t) => toVector(-80 + 160 * t, meridian));
    }
    for (const parallel of [-60, -30, 0, 30, 60]) {
      gridLine((t) => toVector(parallel, -180 + 360 * t));
    }
    c.stroke();
    c.restore();

    // --- Land dots ----------------------------------------------------------
    // Dots are grouped into paths by brightness (7 depth shades) so each group
    // is filled once: far-side dots, plain land, the US, Latin America (4
    // colour bands north to south) and the dots under the scan line.
    const SHADES = 7;
    const farSide = new Path2D();
    const scanned = new Path2D();
    const plain: Path2D[] = [];
    const us: Path2D[] = [];
    const latam: Path2D[][] = [];
    for (let i = 0; i < SHADES; i++) {
      plain.push(new Path2D());
      us.push(new Path2D());
      latam.push([new Path2D(), new Path2D(), new Path2D(), new Path2D()]);
    }
    const addDot = (path: Path2D, x: number, y: number, r: number) => {
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, FULL_CIRCLE);
    };
    const dotSize = Math.max(1.05, radius / 250);
    const m = rotation;
    for (let i = 0; i < dots.count; i++) {
      const depth = m[6] * dots.x[i] + m[7] * dots.y[i] + m[8] * dots.z[i];
      const x =
        centerX +
        (m[0] * dots.x[i] + m[1] * dots.y[i] + m[2] * dots.z[i]) * radius;
      const y =
        centerY -
        (m[3] * dots.x[i] + m[4] * dots.y[i] + m[5] * dots.z[i]) * radius;

      if (depth < 0.02) {
        // Far side: every other dot shows faintly through the globe.
        if (depth > -0.96 && globeIn > 0.5 && i & 1) {
          addDot(farSide, x, y, 0.55 * dotSize);
        }
        continue;
      }
      // While fading in, the centre of the disc appears before the rim.
      const appear = globeIn >= 1 ? 1 : clamp(1.7 * globeIn - (1 - depth));
      if (appear <= 0) continue;
      const shade = Math.min(6, (Math.pow(depth, 0.75) * appear * 7) | 0);
      const region = dots.region[i];

      if (region === 2 && latamHighlight > 0) {
        const underScan = scanning && Math.abs(dots.lat[i] - scanLat) < 5;
        const r =
          dotSize *
          (0.55 + 0.45 * depth) *
          (1 + 0.25 * latamHighlight) *
          (underScan ? 1.45 : 1);
        if (underScan) addDot(scanned, x, y, r);
        const band = Math.min(3, (((32 - dots.lat[i]) / 88) * 4) | 0);
        addDot(latam[shade][band], x, y, r);
        if (latamHighlight < 1) addDot(plain[shade], x, y, r);
      } else {
        const r = dotSize * (0.55 + 0.45 * depth);
        const isLitUs = region === 1 && usHighlight > 0;
        addDot(isLitUs ? us[shade] : plain[shade], x, y, r);
        if (isLitUs && usHighlight < 1) addDot(plain[shade], x, y, r);
      }
    }

    c.fillStyle = `rgba(${INDIGO},${0.07 * globeIn})`;
    c.fill(farSide);
    const plainDim = lerp(1, 0.72, latamHighlight);
    for (let shade = 0; shade < SHADES; shade++) {
      const brightness = (shade + 0.5) / SHADES;
      c.fillStyle = `rgba(${INDIGO},${(0.12 + 0.7 * brightness) * plainDim})`;
      c.fill(plain[shade]);
      if (usHighlight > 0) {
        c.fillStyle = `rgba(${BLUE},${(0.2 + 0.8 * brightness) * usHighlight})`;
        c.fill(us[shade]);
      }
      if (latamHighlight > 0) {
        for (let band = 0; band < 4; band++) {
          c.fillStyle = `rgba(${latamRamp(band / 3)},${(0.18 + 0.82 * brightness) * latamHighlight})`;
          c.fill(latam[shade][band]);
        }
      }
    }

    // --- Scan line sweeping down Latin America --------------------------------
    if (scanning) {
      const alpha =
        smoothstep(3.9, 4.4, time) * (1 - smoothstep(6.7, 7.2, time));
      c.fillStyle = `rgba(${VIOLET},${0.9 * alpha})`;
      c.fill(scanned);
      c.save();
      c.strokeStyle = `rgba(${VIOLET},${0.45 * alpha})`;
      c.lineWidth = 1.2;
      c.shadowColor = "rgba(152,121,213,.8)";
      c.shadowBlur = 8;
      c.beginPath();
      let drawing = false;
      for (let i = 0; i <= 60; i++) {
        const [x, y, depth] = project(toVector(scanLat, -118 + (86 * i) / 60));
        if (depth < 0.05) {
          drawing = false;
          continue;
        }
        if (drawing) c.lineTo(x, y);
        else c.moveTo(x, y);
        drawing = true;
      }
      c.stroke();
      c.restore();
    }

    // --- Cities -------------------------------------------------------------
    c.lineCap = "round";
    // US cities pop in one after another, each with an expanding ring.
    US_CITIES.forEach((usCity, i) => {
      const appearTime = 1 + 0.28 * i;
      const appear = smoothstep(appearTime, appearTime + 0.4, time);
      if (appear <= 0) return;
      const [x, y, depth] = project(usCity.v);
      if (depth < 0.08) return;
      const age = time - appearTime;
      if (age < 1.2) {
        c.strokeStyle = `rgba(${BLUE},${(1 - age / 1.2) * 0.6})`;
        c.lineWidth = 1.1;
        c.beginPath();
        c.arc(x, y, 3 + 20 * age, 0, FULL_CIRCLE);
        c.stroke();
      }
      glowDot(
        x,
        y,
        2.6,
        BLUE.join(","),
        0.95 * appear * Math.min(1, 3 * depth),
      );
    });
    // Latin American cities light up as the scan line passes them, then pulse.
    LATAM_CITIES.forEach((latamCity, i) => {
      const [x, y, depth] = project(latamCity.v);
      if (depth < 0.08) return;
      const scannedYet = time > 4 && scanLat < latamCity.lat + 1;
      const alpha = reducedMotion ? 1 : scannedYet ? latamHighlight : 0;
      if (alpha <= 0) return;
      const pulse = (0.7 * time + 0.13 * i) % 1;
      c.strokeStyle = `rgba(${VIOLET},${(1 - pulse) * 0.5 * alpha})`;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x, y, 4 + 14 * pulse, 0, FULL_CIRCLE);
      c.stroke();
      glowDot(x, y, 2.8, DEEP_VIOLET, 0.92 * alpha);
    });

    // --- The story's fixed routes ---------------------------------------------
    for (const route of ROUTES) {
      const progress = reducedMotion
        ? 2
        : (time - route.startTime) / ROUTE_DRAW_SECONDS;
      if (progress <= 0) continue;
      const flying = progress < 1;
      const drawn = Math.min(1, easeInOutCubic(clamp(progress)));
      const points = arcPoints(
        route.from.v,
        route.to.v,
        ROUTE_LIFT,
        drawn,
        radius,
      );
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a[2] || !b[2]) continue;
        // While flying, the head of the arc is brighter and thicker.
        const head = flying
          ? smoothstep(0.6, 1, b[3] / Math.max(drawn, 0.001))
          : 0;
        c.strokeStyle = `rgba(${latamRamp(1 - b[3])},${flying ? 0.32 + 0.6 * head : 0.38})`;
        c.lineWidth = flying ? 1 + 1.5 * head : 1.2;
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.stroke();
      }
      if (flying) {
        const tip = points[points.length - 1];
        if (tip[2]) glowDot(tip[0], tip[1], 2.8, VIOLET, 0.95);
        continue;
      }
      if (reducedMotion) continue;
      if (!route.landed) {
        route.landed = true;
        rings.push({ at: route.to.v, startTime: time, color: BLUE.join(",") });
      }
      // Two small dots keep travelling along each finished route.
      for (const offset of [0, 0.5]) {
        const fraction = (0.27 * time + route.phase + offset) % 1;
        const p = arcPoint(
          route.from.v,
          route.to.v,
          ROUTE_LIFT,
          fraction,
          radius,
        );
        if (!p[2]) continue;
        glowDot(p[0], p[1], 1.9, VIOLET, 0.9 * Math.sin(Math.PI * fraction));
      }
    }

    // --- Extra arcs: fly, then fade out ---------------------------------------
    for (let n = arcs.length - 1; n >= 0; n--) {
      const arc = arcs[n];
      const progress = (time - arc.startTime) / arc.duration;
      if (progress > 2) {
        arcs.splice(n, 1);
        continue;
      }
      const flying = progress < 1;
      const drawn = Math.min(1, easeInOutCubic(clamp(progress)));
      const fade = 1 - smoothstep(1.1, 2, progress);
      const points = arcPoints(
        arc.from.v,
        arc.to.v,
        arc.lift,
        drawn,
        radius,
        32,
      );
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a[2] || !b[2]) continue;
        const head = flying
          ? smoothstep(0.6, 1, b[3] / Math.max(drawn, 0.001))
          : 0;
        c.strokeStyle = `rgba(${arc.color},${(0.25 + 0.65 * head) * fade})`;
        c.lineWidth = 1 + 1.3 * head;
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.stroke();
      }
      if (flying) {
        const tip = points[points.length - 1];
        if (tip[2]) glowDot(tip[0], tip[1], 2.6, arc.color, 0.95);
      } else if (!arc.landed) {
        arc.landed = true;
        rings.push({ at: arc.to.v, startTime: time, color: arc.color });
      }
    }

    // --- Landing rings --------------------------------------------------------
    for (let n = rings.length - 1; n >= 0; n--) {
      const ring = rings[n];
      const age = (time - ring.startTime) / 1.2;
      if (age > 1) {
        rings.splice(n, 1);
        continue;
      }
      const [x, y, depth] = project(ring.at);
      if (depth < 0) continue;
      c.strokeStyle = `rgba(${ring.color},${(1 - age) * 0.55})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(x, y, 3 + 22 * age, 0, FULL_CIRCLE);
      c.stroke();
    }

    // --- City names -------------------------------------------------------------
    // US names show briefly at the start; a selection of names comes back for
    // the idle state.
    c.font = labelFont;
    const earlyLabels = smoothstep(1.2, 2, time) * (1 - smoothstep(4, 5, time));
    const idleLabels = smoothstep(9.6, 11, time);
    for (const usCity of US_CITIES) {
      const alpha = Math.max(
        0.8 * earlyLabels,
        LABELLED_CITIES.includes(usCity.name) ? 0.55 * idleLabels : 0,
      );
      if (alpha < 0.02) continue;
      const [x, y, depth] = project(usCity.v);
      if (depth < 0.15) continue;
      c.fillStyle = `rgba(51,65,85,${alpha * Math.min(1, 2 * depth)})`;
      c.fillText(usCity.name, x + 7, y - 6);
    }
    for (const latamCity of LATAM_CITIES) {
      if (!LABELLED_CITIES.includes(latamCity.name)) continue;
      const alpha = 0.55 * idleLabels;
      if (alpha < 0.02) continue;
      const [x, y, depth] = project(latamCity.v);
      if (depth < 0.15) continue;
      c.fillStyle = `rgba(${DEEP_VIOLET},${alpha * Math.min(1, 2 * depth)})`;
      c.fillText(latamCity.name, x + 7, y + 14);
    }

    // --- Caption lines and floating chips (DOM) ---------------------------------
    const caption = reducedMotion
      ? 2
      : time < 0.4
        ? -1
        : time < 3.7
          ? 0
          : time < 6.9
            ? 1
            : 2;
    if (caption !== shownCaption) {
      shownCaption = caption;
      captionLines.forEach((line, i) =>
        line.classList.toggle("on", i === caption),
      );
    }
    const animated = !reducedMotion;
    placeChip(
      teamChip,
      CITY_BY_NAME["New York"].v,
      radius,
      animated && time > 1.7 && time < 4.6,
      10,
      -10,
      "",
    );
    placeChip(
      talentChipBogota,
      CITY_BY_NAME["Bogotá"].v,
      radius,
      animated && time > 4.9 && time < 7.3,
      -12,
      -8,
      "left",
    );
    placeChip(
      talentChipSaoPaulo,
      CITY_BY_NAME["São Paulo"].v,
      radius,
      animated && time > 5.8 && time < 7.9,
      12,
      -8,
      "",
    );
    placeChip(
      latamPinChip,
      LATAM_PIN,
      radius,
      time > 9.6 || reducedMotion,
      0,
      -14,
      "center",
    );
  }

  // --- Clock: runs only while the hero is on screen and the tab is visible ------
  let running = false;
  let clockStart = 0; // performance.now() value that counts as time 0
  let pausedAt = 0;
  let time = 0;
  let frame = 0;
  let onScreen = true;
  let nextRandomArcTime = FIRST_RANDOM_ARC_TIME;
  const randomOf = <T>(list: T[], among = list.length) =>
    list[(Math.random() * among) | 0];

  function tick(now: number) {
    if (!running || signal.aborted) return;
    time = (now - clockStart) / 1000;
    pointer[0] += (pointerTarget[0] - pointer[0]) * 0.05;
    pointer[1] += (pointerTarget[1] - pointer[1]) * 0.05;
    if (time > nextRandomArcTime) {
      launchArc(randomOf(LATAM_CITIES), randomOf(US_CITIES), time, VIOLET);
      nextRandomArcTime = time + 1.6 + 1.4 * Math.random();
    }
    draw(time);
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (running || reducedMotion) return;
    running = true;
    clockStart += performance.now() - pausedAt;
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frame);
    pausedAt = performance.now();
  }

  const visibility = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen && !document.hidden) resume();
    else pause();
  });
  visibility.observe(stage);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) pause();
      else if (onScreen) resume();
    },
    { signal },
  );

  // Keep the canvas in step with the stage size.
  addEventListener("resize", measure, { passive: true, signal });
  measure();
  const layout = new ResizeObserver(() => {
    const box = stage.getBoundingClientRect();
    if (box.width === width && box.height === height) return;
    measure();
    if (!reducedMotion && running) draw(time);
  });
  layout.observe(document.body);
  layout.observe(stage);

  if (reducedMotion) {
    draw(STILL_FRAME_TIME);
  } else {
    requestAnimationFrame(() => {
      if (signal.aborted) return;
      pausedAt = clockStart = performance.now();
      running = false;
      resume();
    });
  }

  // Moving the mouse over the hero tilts the globe slightly.
  const hero = stage.parentElement;
  if (hero && matchMedia("(hover:hover)").matches && !reducedMotion) {
    hero.addEventListener(
      "pointermove",
      (event) => {
        const box = stage.getBoundingClientRect();
        pointerTarget = [
          clamp(
            (event.clientX - (box.left + centerX)) / (0.5 * box.width),
            -1,
            1,
          ),
          clamp(
            (event.clientY - (box.top + centerY)) / (0.5 * box.height),
            -1,
            1,
          ),
        ];
      },
      { signal },
    );
    hero.addEventListener("pointerleave", () => (pointerTarget = [0, 0]), {
      signal,
    });
  }

  // Typing in the hero prompt sends arcs from Latin America to the US.
  let lastTypingArcTime = 0;
  promptInput?.addEventListener(
    "input",
    () => {
      if (reducedMotion || !running) return;
      if (time - lastTypingArcTime < TYPING_ARC_INTERVAL) return;
      lastTypingArcTime = time;
      const target = randomOf(US_CITIES, TYPING_ARC_TARGETS);
      launchArc(randomOf(LATAM_CITIES), target, time, VIOLET);
    },
    { signal },
  );

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    stop.abort();
    visibility.disconnect();
    layout.disconnect();
  };
}

const hero = document.querySelector<HTMLElement>(".www-net-hero");
const stage = hero?.querySelector<HTMLElement>(".www-net-stage");
if (hero && stage) {
  const promptInput = hero.querySelector<HTMLInputElement>(
    '.www-net-words input[type="text"]',
  );
  fetchLandDots().then((dots) => {
    let stopGlobe = startGlobe(stage, promptInput, dots);
    // Restart from scratch when the reduced-motion setting changes.
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      () => {
        stopGlobe();
        ROUTES.forEach((route) => (route.landed = false));
        stopGlobe = startGlobe(stage, promptInput, dots);
      },
    );
  });
}
