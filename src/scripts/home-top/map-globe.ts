// Globe renderer for the "You bring the role…" map story.
//
// A lit, orthographic 3D globe drawn on a 2D canvas (no WebGL, no
// dependencies): land dots shaded by a light from the upper left, an
// atmosphere rim, routes that arc above the surface and over the horizon,
// glowing nodes, a thin wireframe network and slow space dust for depth.
// The story (map-story.ts) decides what to show; this file only draws.
//
// Data: the same land dots as the hero globe (/brand/home/network-dots.txt),
// so the browser downloads them once.

export type LatLon = readonly [lat: number, lon: number];
export type Rgb = readonly [number, number, number];
type Vec3 = [number, number, number];

export interface Camera {
  /** Point of the globe facing the viewer. */
  lat: number;
  lon: number;
  /** Globe centre and radius, in CSS pixels. */
  x: number;
  y: number;
  r: number;
}

export interface Projected {
  x: number;
  y: number;
  /** -1 (far side) .. 1 (facing the viewer). */
  z: number;
  /** 0..1, fades out as the point turns towards the horizon and behind it. */
  facing: number;
}

/** Brand colours used on the map (from the site's indigo / violet palette). */
export const COLORS = {
  indigo: [124, 140, 255] as Rgb, // #7c8cff
  periwinkle: [143, 151, 255] as Rgb, // #8f97ff
  violet: [154, 126, 240] as Rgb, // #9a7ef0
  blue: [92, 134, 234] as Rgb, // #5c86ea
  white: [236, 238, 255] as Rgb,
};

export type Quality = "high" | "lite";

const DOTS_URL = "/brand/home/network-dots.txt";
const DEG = Math.PI / 180;
// Light comes from the upper left, slightly in front.
const LIGHT: Vec3 = normalize([-0.55, 0.62, 0.56]);

export const toVector = ([lat, lon]: LatLon): Vec3 => [
  Math.cos(lat * DEG) * Math.sin(lon * DEG),
  Math.sin(lat * DEG),
  Math.cos(lat * DEG) * Math.cos(lon * DEG),
];

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Height of a route above the surface, from the angle it spans (radians). */
const routeLift = (angle: number) => Math.min(0.3, 0.05 + angle * 0.16);

const rgba = (c: Rgb, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

/* ------------------------------------------------------------------ data */

export interface LandDots {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  lon: Float32Array;
  /** 0 = rest of the world, 1 = United States, 2 = Latin America */
  region: Uint8Array;
  /** Per-dot brightness variation (0.55..1), so land reads like lights, not a grid. */
  glow: Float32Array;
}

/**
 * 4 bytes per dot, two little-endian uint16 (see network-globe.ts):
 * (lat + 90) * 100 in the low 15 bits with the top bit = Latin America,
 * then (lon + 180) * 100.
 */
function decode(base64: string): LandDots {
  const bytes = atob(base64);
  const count = bytes.length / 4;
  const dots: LandDots = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    lon: new Float32Array(count),
    region: new Uint8Array(count),
    glow: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    const first = bytes.charCodeAt(4 * i) | (bytes.charCodeAt(4 * i + 1) << 8);
    const second = bytes.charCodeAt(4 * i + 2) | (bytes.charCodeAt(4 * i + 3) << 8);
    const lat = (first & 0x7fff) / 100 - 90;
    const lon = second / 100 - 180;
    const isUs = lat > 24.5 && lat < 49.4 && lon > -125 && lon < -66.5;
    [dots.x[i], dots.y[i], dots.z[i]] = toVector([lat, lon]);
    dots.lon[i] = lon;
    dots.region[i] = first >> 15 === 1 ? 2 : isUs ? 1 : 0;
    // Deterministic hash -> brightness, so the pattern is stable between visits.
    const h = Math.sin(i * 12.9898 + lat * 78.233) * 43758.5453;
    dots.glow[i] = 0.55 + 0.45 * (h - Math.floor(h));
  }
  return dots;
}

export async function loadLandDots(): Promise<LandDots> {
  try {
    const response = await fetch(DOTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decode((await response.text()).trim());
  } catch {
    return decode("");
  }
}

/* ------------------------------------------------------------------ scene */

export function createGlobeScene(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let quality: Quality = "high";
  let dots: LandDots | null = null;

  // Camera rotation terms, rebuilt by setCamera().
  let cam: Camera = { lat: 0, lon: 0, x: 0, y: 0, r: 1 };
  let ca = 1, sa = 0, cb = 1, sb = 0;

  // Soft glow sprites, pre-rendered once per colour (drawImage is cheap; shadowBlur is not).
  const sprites = new Map<string, HTMLCanvasElement>();
  function sprite(color: Rgb) {
    const key = color.join();
    let s = sprites.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, rgba(color, 1));
      grad.addColorStop(0.25, rgba(color, 0.45));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      sprites.set(key, s);
    }
    return s;
  }

  // Space dust: points on shells around the globe; they move with the camera at
  // different depths, which is what makes camera moves read as 3D.
  const DUST = 110;
  const dust = Array.from({ length: DUST }, (_, i) => {
    const u = Math.sin(i * 91.7) * 0.5 + 0.5;
    const v = Math.sin(i * 47.3 + 1.3) * 0.5 + 0.5;
    const lat = Math.asin(2 * v - 1) / DEG;
    const lon = u * 360 - 180;
    const shell = 1.25 + ((Math.sin(i * 13.1) + 1) / 2) * 1.6;
    const p = toVector([lat, lon]);
    return { p: [p[0] * shell, p[1] * shell, p[2] * shell] as Vec3, size: 0.6 + ((i * 7) % 5) * 0.22, phase: i * 0.7 };
  });

  function resize(w: number, h: number) {
    width = w;
    height = h;
    pixelRatio = quality === "lite" ? 1 : Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * pixelRatio);
    canvas.height = Math.round(h * pixelRatio);
  }

  function setQuality(q: Quality) {
    if (q === quality) return;
    quality = q;
    resize(width, height);
  }

  function setCamera(c: Camera) {
    cam = c;
    const a = -c.lon * DEG;
    const b = c.lat * DEG;
    ca = Math.cos(a);
    sa = Math.sin(a);
    cb = Math.cos(b);
    sb = Math.sin(b);
  }

  /** World vector (any length) -> view space. */
  function view(v: Vec3): Vec3 {
    const x1 = v[0] * ca + v[2] * sa;
    const z1 = -v[0] * sa + v[2] * ca;
    return [x1, v[1] * cb - z1 * sb, v[1] * sb + z1 * cb];
  }

  function projectVector(v: Vec3): Projected {
    const [x, y, z] = view(v);
    // Points above the surface stay visible past the horizon, like the reference's arcs.
    const outside = x * x + y * y > 1;
    const facing = outside ? 1 : Math.max(0, Math.min(1, z * 4));
    return { x: cam.x + cam.r * x, y: cam.y - cam.r * y, z, facing };
  }

  const project = (p: LatLon) => projectVector(toVector(p));

  /* ---------------------------------------------------------------- frame */

  function begin() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
  }

  function drawDust(now: number, alpha: number) {
    if (quality === "lite" || alpha <= 0) return;
    ctx.save();
    ctx.fillStyle = "#c9cdff";
    for (const d of dust) {
      const [x, y, z] = view(d.p);
      // Behind the globe disc: hidden.
      if (z < 0 && x * x + y * y < 1) continue;
      const sx = cam.x + cam.r * x;
      const sy = cam.y - cam.r * y;
      if (sx < -4 || sy < -4 || sx > width + 4 || sy > height + 4) continue;
      const twinkle = 0.55 + 0.45 * Math.sin(now * 0.0011 + d.phase);
      ctx.globalAlpha = alpha * 0.35 * twinkle;
      ctx.fillRect(sx, sy, d.size, d.size);
    }
    ctx.restore();
  }

  /** Atmosphere halo + the globe's body (drawn before the land). */
  function drawBody(glowColor: Rgb, glowAlpha: number) {
    const { x, y, r } = cam;
    // Halo around the limb.
    const halo = ctx.createRadialGradient(x, y, r * 0.86, x, y, r * 1.34);
    halo.addColorStop(0, rgba(glowColor, 0));
    halo.addColorStop(0.3, rgba(glowColor, 0.42 * glowAlpha));
    halo.addColorStop(0.5, rgba(COLORS.violet, 0.14 * glowAlpha));
    halo.addColorStop(1, rgba(COLORS.violet, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.34, 0, Math.PI * 2);
    ctx.fill();

    // Body: lit from the upper left, almost black at the far edge.
    const body = ctx.createRadialGradient(x - r * 0.42, y - r * 0.48, r * 0.05, x, y, r);
    body.addColorStop(0, "#232738");
    body.addColorStop(0.55, "#151822");
    body.addColorStop(1, "#090a0f");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Thin bright rim where the atmosphere catches the light (drawn after the land). */
  function drawRim(color: Rgb, alpha: number) {
    const { x, y, r } = cam;
    const rim = ctx.createLinearGradient(x - r, y - r, x + r * 0.6, y + r * 0.6);
    rim.addColorStop(0, rgba(COLORS.white, 0.75 * alpha));
    rim.addColorStop(0.35, rgba(color, 0.5 * alpha));
    rim.addColorStop(0.75, rgba(color, 0.08 * alpha));
    ctx.save();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.004);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.999, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Land dots, lit and coloured by region. `colors` = [rest, US, LatAm] with
   * alpha in [3]. `band` optionally tints dots between two longitudes.
   */
  function drawLand(
    colors: readonly (readonly [number, number, number, number])[],
    band?: { from: number; to: number; alpha: number; color: Rgb },
  ) {
    if (!dots || !dots.count) return;
    const LEVELS = 5;
    const buckets: number[][] = Array.from({ length: 3 * LEVELS + LEVELS }, () => []);
    // Sized to the dot spacing so the land reads as a lit mass, not a sparse grid.
    const size = Math.max(1.4, Math.min(5.5, cam.r / 165)) * (quality === "lite" ? 1.2 : 1);
    const step = quality === "lite" ? 2 : 1;
    const { x: cx, y: cy, r } = cam;
    const useBand = band && band.alpha > 0.01;

    for (let i = 0; i < dots.count; i += step) {
      const x0 = dots.x[i];
      const z0 = dots.z[i];
      const y0 = dots.y[i];
      const x1 = x0 * ca + z0 * sa;
      const z1 = -x0 * sa + z0 * ca;
      const z = y0 * sb + z1 * cb;
      if (z <= 0.02) continue;
      const y = y0 * cb - z1 * sb;
      const sx = cx + r * x1;
      const sy = cy - r * y;
      if (sx < -2 || sy < -2 || sx > width + 2 || sy > height + 2) continue;
      // Lambert light + limb darkening + per-dot variation.
      const lambert = Math.max(0, x1 * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
      const light = (0.3 + 0.7 * lambert) * Math.min(1, z * 2.4) * dots.glow[i];
      const level = Math.min(LEVELS - 1, (light * LEVELS) | 0);
      const inBand = useBand && dots.lon[i] >= band!.from && dots.lon[i] <= band!.to;
      const bucket = inBand ? 3 * LEVELS + level : dots.region[i] * LEVELS + level;
      buckets[bucket].push(sx, sy);
    }

    const half = size / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let b = 0; b < buckets.length; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      const level = b % LEVELS;
      const lightFactor = 0.3 + (0.7 * (level + 0.5)) / LEVELS;
      let color: readonly number[];
      let alpha: number;
      if (b >= 3 * LEVELS) {
        // Time-zone band: mix the US colour towards the band colour.
        color = band!.color;
        alpha = Math.max(colors[1][3], band!.alpha) * lightFactor;
      } else {
        const c = colors[(b / LEVELS) | 0];
        color = c;
        alpha = c[3] * lightFactor;
      }
      if (alpha < 0.01) continue;
      ctx.fillStyle = `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${Math.min(1, alpha).toFixed(3)})`;
      if (size < 2.2) {
        for (let k = 0; k < list.length; k += 2) ctx.fillRect(list[k] - half, list[k + 1] - half, size, size);
      } else {
        // Round dots once they are big enough for the shape to show.
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 2) {
          ctx.moveTo(list[k] + half, list[k + 1]);
          ctx.arc(list[k], list[k + 1], half, 0, 6.2832);
        }
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- routes */

  function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const omega = Math.acos(dot);
    if (omega < 1e-5) return a;
    const so = Math.sin(omega);
    const k0 = Math.sin((1 - t) * omega) / so;
    const k1 = Math.sin(t * omega) / so;
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
  }

  /** Point on a route at t (0..1), lifted above the surface. */
  function routePoint(a: Vec3, b: Vec3, lift: number, t: number) {
    const p = slerp(a, b, t);
    const h = 1 + lift * Math.sin(Math.PI * t);
    return projectVector([p[0] * h, p[1] * h, p[2] * h]);
  }

  /**
   * A route that arcs above the surface from `from` to `to`, drawn between
   * `start` and `end` (0..1). Parts hidden behind the globe are skipped.
   * Returns the head position (for comets / labels).
   */
  function drawRoute(
    from: LatLon,
    to: LatLon,
    opts: {
      start?: number;
      end: number;
      alpha: number;
      color?: Rgb;
      colorTo?: Rgb;
      width?: number;
      lift?: number;
      glow?: boolean;
      head?: boolean;
    },
  ): Projected | null {
    const { start = 0, end, alpha } = opts;
    if (end <= start || alpha <= 0.005) return null;
    const a = toVector(from);
    const b = toVector(to);
    const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const lift = opts.lift ?? routeLift(angle);
    const color = opts.color ?? COLORS.violet;
    const colorTo = opts.colorTo ?? COLORS.indigo;
    const steps = Math.max(16, Math.round(64 * (end - start)));
    const pts: Projected[] = [];
    for (let i = 0; i <= steps; i++) pts.push(routePoint(a, b, lift, start + ((end - start) * i) / steps));

    const first = pts[0];
    const last = pts[pts.length - 1];
    const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
    gradient.addColorStop(0, rgba(color, 0.15));
    gradient.addColorStop(0.5, rgba(color, 1));
    gradient.addColorStop(1, rgba(colorTo, 1));

    const width = (opts.width ?? 1.6) * Math.max(0.8, Math.min(1.4, cam.r / 500));
    const passes: [number, number][] = opts.glow === false ? [[width, 1]] : [[width * 5, 0.14], [width, 1]];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = gradient;
    for (const [lw, la] of passes) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      let drawing = false;
      for (const p of pts) {
        const visible = p.facing > 0.05;
        if (visible && !drawing) {
          ctx.moveTo(p.x, p.y);
          drawing = true;
        } else if (visible) ctx.lineTo(p.x, p.y);
        else drawing = false;
      }
      ctx.globalAlpha = alpha * la;
      ctx.stroke();
    }
    ctx.restore();

    if (opts.head && last.facing > 0.05) drawSpark(last, alpha, colorTo);
    return last;
  }

  /** Bright moving point with a soft halo (route heads, travelling lights). */
  function drawSpark(at: { x: number; y: number }, alpha: number, color: Rgb = COLORS.white, size = 1) {
    if (alpha <= 0) return;
    const s = 22 * size * Math.max(0.8, Math.min(1.3, cam.r / 500));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * 0.9;
    ctx.drawImage(sprite(color), at.x - s / 2, at.y - s / 2, s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(at.x, at.y, 1.8 * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Light travelling along a finished route, `t` in 0..1. */
  function routeLight(from: LatLon, to: LatLon, t: number, alpha: number, color?: Rgb, lift?: number) {
    const a = toVector(from);
    const b = toVector(to);
    const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const p = routePoint(a, b, lift ?? routeLift(angle), t);
    if (p.facing > 0.05) drawSpark(p, alpha * p.facing, color);
    return p;
  }

  /** Thin wireframe line between two places, just above the surface (reference's network mesh). */
  function drawMesh(pairs: readonly (readonly [LatLon, LatLon])[], alpha: number) {
    if (alpha <= 0.005 || quality === "lite") return;
    ctx.save();
    ctx.strokeStyle = rgba(COLORS.white, 1);
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const [from, to] of pairs) {
      const a = toVector(from);
      const b = toVector(to);
      let drawing = false;
      for (let i = 0; i <= 20; i++) {
        const p = routePoint(a, b, 0.035, i / 20);
        if (p.facing > 0.3) {
          if (drawing) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          drawing = true;
        } else drawing = false;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Node: solid dot with a halo; optional pulse ring (0..1 phase). */
  function drawNode(place: LatLon | Projected, alpha: number, opts: { color?: Rgb; size?: number; pulse?: number; square?: boolean } = {}) {
    const p = "facing" in place ? place : project(place);
    const a = alpha * p.facing;
    if (a <= 0.01) return p;
    const color = opts.color ?? COLORS.periwinkle;
    const k = (opts.size ?? 1) * Math.max(0.8, Math.min(1.35, cam.r / 520));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a * 0.8;
    const s = 34 * k;
    ctx.drawImage(sprite(color), p.x - s / 2, p.y - s / 2, s, s);
    if (opts.pulse !== undefined) {
      ctx.globalAlpha = a * (1 - opts.pulse) * 0.7;
      ctx.strokeStyle = rgba(color, 1);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (6 + 20 * opts.pulse) * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = a;
    ctx.fillStyle = opts.square ? "#fff" : rgba(color, 1);
    if (opts.square) ctx.fillRect(p.x - 4.5 * k, p.y - 4.5 * k, 9 * k, 9 * k);
    else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.2 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.7 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return p;
  }

  /** Meridian (line of longitude) across the visible face, with an optional label at its top. */
  function drawMeridian(lon: number, alpha: number, label?: string) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.strokeStyle = rgba(COLORS.periwinkle, 1);
    ctx.globalAlpha = alpha * 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    let drawing = false;
    let top: Projected | null = null;
    for (let lat = -70; lat <= 75; lat += 2.5) {
      const p = projectVector(toVector([lat, lon]));
      if (p.facing > 0.15) {
        if (drawing) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        drawing = true;
        if (!top || p.y < top.y) top = p;
      } else drawing = false;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (label && top) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = rgba(COLORS.white, 0.85);
      ctx.font = `500 10.5px ${getComputedStyle(canvas).fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(label, top.x, top.y - 10);
    }
    ctx.restore();
  }

  /** Converging rings on a place: "narrowing down to one person". */
  function drawFocusRings(place: LatLon, t: number, alpha: number) {
    if (alpha <= 0.01) return;
    const p = project(place);
    if (p.facing < 0.1) return;
    const k = Math.max(0.8, Math.min(1.4, cam.r / 520));
    ctx.save();
    ctx.strokeStyle = rgba(COLORS.periwinkle, 1);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const ring = (1 - t) * (90 - i * 22) + 12;
      ctx.globalAlpha = alpha * (0.25 + 0.25 * i) * p.facing;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ring * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Corner ticks of a target, closing in.
    const box = ((1 - t) * 60 + 18) * k;
    const tick = 8 * k;
    ctx.globalAlpha = alpha * p.facing;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = p.x + sx * box;
      const y = p.y + sy * box;
      ctx.moveTo(x, y - sy * tick);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * tick, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Curved screen-space connector from a globe point to a DOM card. */
  function drawConnector(from: { x: number; y: number }, to: { x: number; y: number }, drawn: number, alpha: number, bend = 0.25) {
    if (drawn <= 0 || alpha <= 0) return null;
    const control = {
      x: (from.x + to.x) / 2 - (to.y - from.y) * bend,
      y: (from.y + to.y) / 2 + (to.x - from.x) * bend,
    };
    const at = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      };
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, rgba(COLORS.violet, 0.9));
    gradient.addColorStop(1, rgba(COLORS.white, 0.85));
    ctx.strokeStyle = gradient;
    ctx.lineCap = "round";
    for (const [lw, la] of [[6, 0.12], [1.3, 0.9]] as const) {
      ctx.lineWidth = lw;
      ctx.globalAlpha = alpha * la;
      ctx.beginPath();
      for (let i = 0; i <= 40 * drawn; i++) {
        const p = at(i / 40);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (drawn < 1) drawSpark(at(drawn), alpha, COLORS.white, 0.8);
    return at;
  }

  return {
    ctx,
    get quality() {
      return quality;
    },
    get camera() {
      return cam;
    },
    setDots(d: LandDots) {
      dots = d;
    },
    resize,
    setQuality,
    setCamera,
    project,
    begin,
    drawDust,
    drawBody,
    drawRim,
    drawLand,
    drawRoute,
    routeLight,
    drawSpark,
    drawMesh,
    drawNode,
    drawMeridian,
    drawFocusRings,
    drawConnector,
  };
}

export type GlobeScene = ReturnType<typeof createGlobeScene>;
