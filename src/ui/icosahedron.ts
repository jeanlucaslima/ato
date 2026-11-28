/**
 * The ATO logo as a real 3D icosahedron, drawn as one flat SVG.
 *
 * Every frame the 12 corners are turned (a slow spin about the axis through two
 * opposite face centres, tilted like the Earth's) and projected with
 * perspective; each of the 30 edges is then drawn once, in screen space, so a
 * line keeps its width at any angle. An edge is solid while either of its faces
 * looks at you and fades to dashed as both turn away, so the outline is always
 * solid and hidden edges meet in dashed stars at the back. Each corner is cut
 * by a small flat pentagon (a bold chamfer) shaded by how it faces the light,
 * so the joints read as worked facets rather than points.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

export type Vec = readonly [x: number, y: number, z: number];
export type Face = readonly [Vec, Vec, Vec];

/** Inradius / circumradius: how far a face centre sits from the middle. */
export const INRADIUS_RATIO = 0.7946544722917661;

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): number => Math.hypot(...a);
export const centroid = ([a, b, c]: Face): Vec => scale(add(add(a, b), c), 1 / 3);

/** Rotate `v` by the rotation taking unit vector `from` onto unit vector `to` (Rodrigues). */
function rotateOnto(v: Vec, from: Vec, to: Vec): Vec {
  const axis = cross(from, to);
  const c = dot(from, to);
  const k = 1 / (1 + c);
  // v·cos + (axis×v) + axis(axis·v)/(1+c), with |axis| = sin
  return add(add(scale(v, c), cross(axis, v)), scale(axis, dot(axis, v) * k));
}

/**
 * Faces of an icosahedron with circumradius `r`, turned so the axis through
 * two opposite face centres is vertical (CSS y; the top face is at `-y`).
 * Every face is wound counter-clockwise seen from outside.
 */
export function icosahedronFaces(r: number): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const base: Vec[] = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) base.push([0, s, t * phi], [s, t * phi, 0], [t * phi, 0, s]);
  // Triangles of vertices that are pairwise one edge (length 2) apart.
  const raw: Face[] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        const [a, b, c] = [base[i]!, base[j]!, base[k]!];
        if ([norm(sub(a, b)), norm(sub(b, c)), norm(sub(c, a))].every((d) => Math.abs(d - 2) < 1e-9)) raw.push([a, b, c]);
      }
  const top = centroid(raw[0]!);
  const from = scale(top, 1 / norm(top));
  const up: Vec = [0, -1, 0];
  const place = (v: Vec): Vec => scale(rotateOnto(v, from, up), r / Math.hypot(1, phi));
  return raw.map((face) => {
    const [a, b, c] = face.map(place) as unknown as Face;
    // Wound counter-clockwise seen from outside (normal along the centroid).
    return dot(cross(sub(b, a), sub(c, a)), centroid([a, b, c])) > 0 ? [a, b, c] : [a, c, b];
  });
}


// --- Model and frame ------------------------------------------------------------

/** How far along each edge a corner is cut: a small facet at each joint. */
export const CHAMFER = 0.09;
/** Viewer distance (px), as CSS `perspective`. */
const EYE = 900;
/** Tilt of the spin axis: leaning top-left to bottom-right, about as much as the Earth's. */
const TILT_Z = (-20 * Math.PI) / 180;
const TILT_X = (-6 * Math.PI) / 180;
/** Where the light comes from (up, left, toward you; CSS y points down). */
const LIGHT = ((v: Vec) => scale(v, 1 / norm(v)))([-0.45, -0.75, 0.6]);
/** Near edges are this much thicker, far ones this much thinner (at the front and back of the solid). */
export const DEPTH = 0.15;
/** Facing below -FADE is behind, above +FADE in front; between, solid and dashed cross-fade. */
const FADE = 0.12;

export interface Model {
  vertices: Vec[];
  /** Vertex index pairs, each with the outward normals of its two faces. */
  edges: { a: number; b: number; normals: [Vec, Vec] }[];
  /** For each vertex, its 5 neighbours in order around it. */
  rings: number[][];
}

export function icosahedronModel(r: number): Model {
  const faces = icosahedronFaces(r);
  const vertices: Vec[] = [];
  const idx = (v: Vec) => {
    const i = vertices.findIndex((u) => norm(sub(u, v)) < 1e-6);
    if (i >= 0) return i;
    vertices.push(v);
    return vertices.length - 1;
  };
  const byEdge = new Map<string, { a: number; b: number; normals: Vec[] }>();
  for (const face of faces) {
    const ids = face.map(idx);
    const n = scale(centroid(face), 1 / norm(centroid(face)));
    for (let k = 0; k < 3; k++) {
      const [a, b] = [ids[k]!, ids[(k + 1) % 3]!].sort((x, y) => x - y) as [number, number];
      const e = byEdge.get(`${a}-${b}`) ?? { a, b, normals: [] };
      e.normals.push(n);
      byEdge.set(`${a}-${b}`, e);
    }
  }
  const edges = [...byEdge.values()].map((e) => ({ a: e.a, b: e.b, normals: e.normals as [Vec, Vec] }));
  const rings = vertices.map((v, i) => {
    const near = edges.flatMap((e) => (e.a === i ? [e.b] : e.b === i ? [e.a] : []));
    // Order the neighbours around the vertex: angles in its tangent plane.
    const n = scale(v, 1 / norm(v));
    const u0 = sub(vertices[near[0]!]!, v);
    const u = scale(sub(u0, scale(n, dot(u0, n))), 1);
    const w = cross(n, u);
    return near.sort((p, q) => {
      const at = (j: number) => {
        const d = sub(vertices[j]!, v);
        return Math.atan2(dot(d, w), dot(d, u));
      };
      return at(p) - at(q);
    });
  });
  return { vertices, edges, rings };
}

/** Turn a point: spin about the vertical axis, then the tilt (CSS rotateZ · rotateX · rotateY). */
export function turn(p: Vec, spinDeg: number): Vec {
  const s = (spinDeg * Math.PI) / 180;
  let [x, y, z] = p;
  [x, z] = [x * Math.cos(s) + z * Math.sin(s), -x * Math.sin(s) + z * Math.cos(s)];
  [y, z] = [y * Math.cos(TILT_X) - z * Math.sin(TILT_X), y * Math.sin(TILT_X) + z * Math.cos(TILT_X)];
  [x, y] = [x * Math.cos(TILT_Z) - y * Math.sin(TILT_Z), x * Math.sin(TILT_Z) + y * Math.cos(TILT_Z)];
  return [x, y, z];
}

const project = (p: Vec): [number, number] => [(p[0] * EYE) / (EYE - p[2]), (p[1] * EYE) / (EYE - p[2])];
/** How much a surface with outward normal `n` at `p` looks at the viewer, -1…1. */
const facing = (n: Vec, p: Vec): number => dot(n, scale(sub([0, 0, EYE], p), 1 / norm(sub([0, 0, EYE], p))));
/** 0 behind, 1 in front, a smooth cross-fade in between. */
export const frontness = (f: number): number => {
  const t = Math.min(1, Math.max(0, (f + FADE) / (2 * FADE)));
  return t * t * (3 - 2 * t);
};

export interface Frame {
  /** Each edge once, between its two cut points: `front` 1 solid … 0 dashed; `weight` its line width, 1 ± DEPTH by nearness. */
  edges: { x1: number; y1: number; x2: number; y2: number; front: number; weight: number; full: [number, number, number, number] }[];
  /** Each corner's cut: a pentagon, its frontness, how lit it is (0…1) and its line weight. */
  facets: { corner: number; points: [number, number][]; front: number; light: number; weight: number; z: number }[];
}

/** `full`: the dashed line's ends: the corner's point when it is behind, its cut when it faces you. */
export function frame(model: Model, spinDeg: number, chamfer = CHAMFER): Frame {
  const at = model.vertices.map((v) => turn(v, spinDeg));
  const radius = norm(model.vertices[0]!);
  const weight = (z: number) => 1 + DEPTH * (z / radius);
  const cut = (i: number, j: number, t = chamfer): Vec => add(at[i]!, scale(sub(at[j]!, at[i]!), t));
  /** How much each corner faces you (0…1): a front corner is cut, so even dashed lines stop at its cut. */
  const cornerFront = at.map((v) => frontness(facing(scale(v, 1 / norm(v)), v)));
  const edges = model.edges.map((e) => {
    const mid = scale(add(at[e.a]!, at[e.b]!), 0.5);
    const front = frontness(Math.max(...e.normals.map((n) => facing(turn(n, spinDeg), mid))));
    const [x1, y1] = project(cut(e.a, e.b));
    const [x2, y2] = project(cut(e.b, e.a));
    // Dashed ends run into the point of a back corner (stars meet) but stop at a front corner's cut.
    const [fx1, fy1] = project(cut(e.a, e.b, chamfer * cornerFront[e.a]!));
    const [fx2, fy2] = project(cut(e.b, e.a, chamfer * cornerFront[e.b]!));
    return { x1, y1, x2, y2, front, weight: weight(mid[2]), full: [fx1, fy1, fx2, fy2] as [number, number, number, number] };
  });
  const facets = model.rings
    .map((ring, i) => {
      const n = scale(at[i]!, 1 / norm(at[i]!));
      return { corner: i, points: ring.map((j) => project(cut(i, j))), front: frontness(facing(n, at[i]!)), light: Math.max(0, dot(n, LIGHT)), weight: weight(at[i]![2]), z: at[i]![2] };
    })
    .sort((p, q) => p.z - q.z);
  return { edges, facets };
}

// --- Pixels --------------------------------------------------------------------

/** Pixel shades: 0 empty, 1–3 faces from most to least lit, 4 the outline. */
export type PixelShade = 0 | 1 | 2 | 3 | 4;

/**
 * The solid drawn on an n×n grid of pixels at a spin angle: its front faces filled in
 * three shades by how much they face the light, and a 1-pixel outline. On a big grid
 * every front edge is traced; on a small one (under 24, the popup's logo) only the
 * silhouette is, and the shading alone shows the facets, as sprites are drawn: inner
 * lines at that size crowd it into a scribble. Row-major, shade per pixel. A theme
 * can show it in place of the vector drawing (Missing Link's 8-bit logo).
 */
export function pixelIcosahedron(n: number, spinDeg: number, radius = 72, lines: 'edges' | 'silhouette' = n >= 24 ? 'edges' : 'silhouette'): Uint8Array {
  const out = new Uint8Array(n * n);
  const size = radius * 2.2;
  const toGrid = ([x, y]: [number, number]): [number, number] => [((x / size) + 0.5) * n, ((y / size) + 0.5) * n];
  const faces = icosahedronFaces(radius).map((face) => {
    const at = face.map((v) => turn(v, spinDeg)) as [Vec, Vec, Vec];
    const c = centroid(at);
    const normal = scale(c, 1 / norm(c));
    return { pts: at.map((v) => toGrid(project(v))) as [number, number][], front: facing(normal, c), light: dot(normal, LIGHT), z: c[2] };
  });
  const front = faces.filter((f) => f.front > 0).sort((a, b) => a.z - b.z);
  const inside = (p: [number, number], [a, b, c]: [number, number][]) => {
    const s = (u: [number, number], v: [number, number], w: [number, number]) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    const d1 = s(a!, b!, p), d2 = s(b!, c!, p), d3 = s(c!, a!, p);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  };
  for (const f of front) {
    const shade: PixelShade = f.light > 0.55 ? 1 : f.light > 0.1 ? 2 : 3;
    const xs = f.pts.map((p) => p[0]), ys = f.pts.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(n - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(n - 1, Math.ceil(Math.max(...xs))); x++) {
        if (inside([x + 0.5, y + 0.5], f.pts)) out[y * n + x] = shade;
      }
    }
  }
  if (lines === 'silhouette') {
    // A filled pixel beside an empty one (or the grid's edge) is the outline.
    const filled = out.slice();
    const empty = (x: number, y: number) => x < 0 || y < 0 || x >= n || y >= n || filled[y * n + x] === 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (filled[y * n + x] && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) out[y * n + x] = 4;
      }
    }
    return out;
  }
  const plot = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < n && y < n) out[y * n + x] = 4;
  };
  for (const f of front) {
    for (let k = 0; k < 3; k++) {
      // Bresenham between the two corners, on whole pixels.
      let [x0, y0] = f.pts[k]!.map(Math.floor) as [number, number];
      const [x1, y1] = f.pts[(k + 1) % 3]!.map(Math.floor) as [number, number];
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        plot(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  }
  return out;
}

/**
 * Paint `pixelIcosahedron` into a canvas, in the colours the theme gives the stage
 * (--ico-px-1…3 for the faces, --ico-px-edge for the outline).
 */
export function paintPixels(canvas: HTMLCanvasElement, n: number, spinDeg: number, colours: string[]): void {
  if (canvas.width !== n) canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const shades = pixelIcosahedron(n, spinDeg);
  const image = ctx.createImageData(n, n);
  const rgb = colours.map((c) => {
    const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
    const v = m ? parseInt(m[1]!, 16) : 0;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  });
  for (let i = 0; i < shades.length; i++) {
    const s = shades[i]!;
    if (!s) continue;
    const [r, g, b] = rgb[s - 1]!;
    image.data.set([r!, g!, b!, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
}

// --- SVG ------------------------------------------------------------------------

const DASH_OPACITY = 0.45;
const r3 = (v: number) => +v.toFixed(2);

/** The solid as SVG, and a function that redraws it at a spin angle. */
function drawing(radius: number, chamfer: number): { svg: SVGSVGElement; canvas: HTMLCanvasElement; draw: (spinDeg: number) => void } {
  const model = icosahedronModel(radius);
  const size = Math.round(radius * 2.2);
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, cls?: string) => {
    const node = document.createElementNS(SVG_NS, tag);
    if (cls) node.setAttribute('class', cls);
    return node;
  };
  const svg = el('svg', 'ico-svg');
  svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  const back = el('g', 'ico-back');
  const frontGroup = el('g', 'ico-front');
  svg.append(back, frontGroup);
  const dashed = model.edges.map(() => back.appendChild(el('line')));
  const solid = model.edges.map(() => frontGroup.appendChild(el('line')));
  const frontFacets = model.rings.map(() => frontGroup.appendChild(el('polygon', 'ico-facet')));

  const canvas = document.createElement('canvas');
  canvas.className = 'ico-px';
  canvas.setAttribute('aria-hidden', 'true');
  const draw = (spinDeg: number) => {
    // A theme that sets --ico-pixels gets the 8-bit drawing (the SVG stays, hidden by the theme).
    const style = canvas.isConnected ? getComputedStyle(canvas) : null;
    const grid = style ? parseInt(style.getPropertyValue('--ico-pixels'), 10) : NaN;
    if (grid > 0) {
      const c = (k: string) => style!.getPropertyValue(k);
      // It turns in frames, like a sprite: the angle steps by --ico-px-step degrees (12 by default).
      const step = parseFloat(c('--ico-px-step')) || 12;
      paintPixels(canvas, grid, Math.round(spinDeg / step) * step, [c('--ico-px-1'), c('--ico-px-2'), c('--ico-px-3'), c('--ico-px-edge')]);
    }
    const f = frame(model, spinDeg, chamfer);
    f.edges.forEach((e, i) => {
      const cutEnds = [e.x1, e.y1, e.x2, e.y2];
      for (const [line, opacity, ends] of [[solid[i]!, e.front, cutEnds], [dashed[i]!, (1 - e.front) * DASH_OPACITY, e.full]] as const) {
        line.setAttribute('x1', String(r3(ends[0]!)));
        line.setAttribute('y1', String(r3(ends[1]!)));
        line.setAttribute('x2', String(r3(ends[2]!)));
        line.setAttribute('y2', String(r3(ends[3]!)));
        line.setAttribute('opacity', String(r3(opacity)));
        line.style.setProperty('--w', String(r3(e.weight)));
      }
    });
    // Facets in depth order, nearest last, so a near corner covers the edge ends under it.
    f.facets.forEach((facet, k) => {
      const points = facet.points.map(([x, y]) => `${r3(x)},${r3(y)}`).join(' ');
      const fp = frontFacets[k]!;
      fp.setAttribute('points', points);
      fp.setAttribute('opacity', String(r3(facet.front)));
      fp.style.setProperty('--lit', String(r3(facet.light)));
      fp.style.setProperty('--w', String(r3(facet.weight)));
    });
  };
  return { svg, canvas, draw };
}

const drawings = new WeakMap<HTMLElement, (spinDeg: number) => void>();
/** The angle it is first drawn at, before any spin. */
const START = 18;

/** Draw a logo made by `icosahedron` at a given spin angle (screenshots and the README's GIF). */
export function drawAt(stage: HTMLElement, spinDeg: number): void {
  drawings.get(stage)?.(spinDeg);
}

/**
 * The solid, standing still. Decorative: hidden from assistive tech. Marked
 * `data-morph-keep` because `attachSpin` owns its drawing once mounted.
 */
export function icosahedron(radius: number, chamfer = CHAMFER): HTMLElement {
  const { svg, canvas, draw } = drawing(radius, chamfer);
  const stage = document.createElement('div');
  stage.className = 'ico';
  stage.setAttribute('aria-hidden', 'true');
  stage.setAttribute('data-morph-keep', '');
  stage.style.setProperty('--ico-size', `${Math.round(radius * 2.2)}px`);
  stage.append(svg, canvas);
  draw(START);
  drawings.set(stage, draw);
  return stage;
}

// --- Spin ---------------------------------------------------------------------

export interface Spin {
  /** Degrees about the axis. */
  angle: number;
  /** Degrees per second. */
  velocity: number;
}

/** One turn every two minutes. */
export const AUTO_SPEED = 3;
/** How long a fling takes to wind down to the slow turn (s, time constant): a light, well-oiled globe. */
const SETTLE_S = 5;
const DEG_PER_PX = 0.6;
const MAX_FLING = 360;

/** Advance a free spin by `dt` seconds: any fling eases toward the steady `auto` speed (time constant `settle`). */
export function coast(spin: Spin, dt: number, auto: number, settle = SETTLE_S): Spin {
  const velocity = auto + (spin.velocity - auto) * Math.exp(-dt / settle);
  return { angle: (spin.angle + ((spin.velocity + velocity) / 2) * dt) % 360, velocity };
}

/**
 * Turn the solid: slowly on its own, and with the pointer. Drag sideways to
 * spin it; let go mid-swipe and it keeps spinning that way, slowing over a few
 * seconds into the slow turn in the same direction. With reduced motion it only
 * moves while dragged. Returns a stop function.
 */
export function attachSpin(
  stage: HTMLElement,
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
  /** Time scale for the free spin (the gallery's speed buttons); 1 is real time. */
  rate: () => number = () => 1,
): () => void {
  const draw = drawings.get(stage);
  if (!draw) return () => {};
  return spin(stage, draw, { reducedMotion, rate, start: START });
}

/** How fast the popup's logo turns while the pointer is over it (deg/s), and how quickly it gets there or stops (s). */
const HOVER_SPEED = 45;
const HOVER_SETTLE_S = 0.6;

/**
 * The popup's logo: still until the pointer is over it, then it turns, and
 * eases to a stop when the pointer leaves. Drag and fling work as on the
 * settings page. `draw` paints it at an angle. Returns a stop function.
 */
export function attachHoverSpin(
  stage: HTMLElement,
  draw: (spinDeg: number) => void,
  start: number,
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
): () => void {
  return spin(stage, draw, { reducedMotion, rate: () => 1, start, hover: true });
}

function spin(
  stage: HTMLElement,
  draw: (spinDeg: number) => void,
  opts: { reducedMotion: boolean; rate: () => number; start: number; hover?: boolean },
): () => void {
  const { reducedMotion, rate, hover = false } = opts;
  const speed = reducedMotion ? 0 : hover ? HOVER_SPEED : AUTO_SPEED;
  const settle = hover ? HOVER_SETTLE_S : SETTLE_S;
  /** Direction of the last fling: the turn keeps it. */
  let direction = 1;
  let over = false;
  /** Steady speed to settle to: the slow turn, or (hover) a turn only while the pointer is over it. */
  const auto = () => (hover && !over ? 0 : direction * speed);
  let turnState: Spin = { angle: opts.start, velocity: hover ? 0 : auto() };
  let drag: { x: number; t: number } | null = null;
  let frame = 0;
  let last = 0;

  const paint = () => draw(turnState.angle);
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!drag) turnState = coast(turnState, dt * rate(), auto(), settle);
    // Winding down to a standstill: below half a degree a second it has stopped.
    if (!drag && auto() === 0 && Math.abs(turnState.velocity) < 0.5) turnState = { ...turnState, velocity: 0 };
    paint();
    const moving = Math.abs(turnState.velocity) > 0.01 || Math.abs(turnState.velocity - auto()) > 0.01;
    frame = drag || moving ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, t: e.timeStamp };
    turnState = { ...turnState, velocity: 0 };
    stage.classList.add('is-dragging');
    run();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const turn = (e.clientX - drag.x) * DEG_PER_PX;
    const dt = Math.max((e.timeStamp - drag.t) / 1000, 0.004);
    turnState = { angle: turnState.angle + turn, velocity: 0.6 * turnState.velocity + 0.4 * (turn / dt) };
    drag = { x: e.clientX, t: e.timeStamp };
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    // Holding still before letting go means "stop here", not "fling".
    const held = e.timeStamp - drag.t > 150;
    const fling = held || reducedMotion ? 0 : Math.max(-MAX_FLING, Math.min(MAX_FLING, turnState.velocity));
    // It keeps turning the way it was thrown, winding down to the steady turn.
    if (fling !== 0) direction = Math.sign(fling);
    turnState = { ...turnState, velocity: fling };
    drag = null;
    stage.classList.remove('is-dragging');
    run();
  };
  const onEnter = () => {
    over = true;
    run();
  };
  const onLeave = () => {
    over = false;
    run();
  };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  if (hover) {
    stage.addEventListener('pointerenter', onEnter);
    stage.addEventListener('pointerleave', onLeave);
  }
  paint();
  run();

  return () => {
    cancelAnimationFrame(frame);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    stage.removeEventListener('pointerenter', onEnter);
    stage.removeEventListener('pointerleave', onLeave);
  };
}
