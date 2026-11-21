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
  facets: { points: [number, number][]; front: number; light: number; weight: number; z: number }[];
}

/** `full`: the uncut edge, for the dashed line, so hidden edges still meet at the corners. */
export function frame(model: Model, spinDeg: number, chamfer = CHAMFER): Frame {
  const at = model.vertices.map((v) => turn(v, spinDeg));
  const radius = norm(model.vertices[0]!);
  const weight = (z: number) => 1 + DEPTH * (z / radius);
  const cut = (i: number, j: number): Vec => add(at[i]!, scale(sub(at[j]!, at[i]!), chamfer));
  const edges = model.edges.map((e) => {
    const mid = scale(add(at[e.a]!, at[e.b]!), 0.5);
    const front = frontness(Math.max(...e.normals.map((n) => facing(turn(n, spinDeg), mid))));
    const [x1, y1] = project(cut(e.a, e.b));
    const [x2, y2] = project(cut(e.b, e.a));
    const [fx1, fy1] = project(at[e.a]!);
    const [fx2, fy2] = project(at[e.b]!);
    return { x1, y1, x2, y2, front, weight: weight(mid[2]), full: [fx1, fy1, fx2, fy2] as [number, number, number, number] };
  });
  const facets = model.rings
    .map((ring, i) => {
      const n = scale(at[i]!, 1 / norm(at[i]!));
      return { points: ring.map((j) => project(cut(i, j))), front: frontness(facing(n, at[i]!)), light: Math.max(0, dot(n, LIGHT)), weight: weight(at[i]![2]), z: at[i]![2] };
    })
    .sort((p, q) => p.z - q.z);
  return { edges, facets };
}

// --- SVG ------------------------------------------------------------------------

const DASH_OPACITY = 0.45;
const r3 = (v: number) => +v.toFixed(2);

/** The solid as SVG, and a function that redraws it at a spin angle. */
function drawing(radius: number, chamfer: number): { svg: SVGSVGElement; draw: (spinDeg: number) => void } {
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

  const draw = (spinDeg: number) => {
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
  return { svg, draw };
}

const drawings = new WeakMap<HTMLElement, (spinDeg: number) => void>();
/** The angle it is first drawn at, before any spin. */
const START = 18;

/**
 * The solid, standing still. Decorative: hidden from assistive tech. Marked
 * `data-morph-keep` because `attachSpin` owns its drawing once mounted.
 */
export function icosahedron(radius: number, chamfer = CHAMFER): HTMLElement {
  const { svg, draw } = drawing(radius, chamfer);
  draw(START);
  const stage = document.createElement('div');
  stage.className = 'ico';
  stage.setAttribute('aria-hidden', 'true');
  stage.setAttribute('data-morph-keep', '');
  stage.style.setProperty('--ico-size', `${Math.round(radius * 2.2)}px`);
  stage.appendChild(svg);
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

/** Advance a free spin by `dt` seconds: any fling eases toward the steady `auto` speed. */
export function coast(spin: Spin, dt: number, auto: number): Spin {
  const velocity = auto + (spin.velocity - auto) * Math.exp(-dt / SETTLE_S);
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
  const speed = reducedMotion ? 0 : AUTO_SPEED;
  /** Steady speed to settle to; follows the direction of the last fling. */
  let auto = speed;
  let spin: Spin = { angle: START, velocity: auto };
  let drag: { x: number; t: number } | null = null;
  let frame = 0;
  let last = 0;

  const paint = () => draw(spin.angle);
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!drag) spin = coast(spin, dt * rate(), auto);
    paint();
    frame = drag || Math.abs(spin.velocity) > 0.01 ? requestAnimationFrame(tick) : 0;
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
    spin = { ...spin, velocity: 0 };
    stage.classList.add('is-dragging');
    run();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const turn = (e.clientX - drag.x) * DEG_PER_PX;
    const dt = Math.max((e.timeStamp - drag.t) / 1000, 0.004);
    spin = { angle: spin.angle + turn, velocity: 0.6 * spin.velocity + 0.4 * (turn / dt) };
    drag = { x: e.clientX, t: e.timeStamp };
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    // Holding still before letting go means "stop here", not "fling".
    const held = e.timeStamp - drag.t > 150;
    const fling = held || reducedMotion ? 0 : Math.max(-MAX_FLING, Math.min(MAX_FLING, spin.velocity));
    // It keeps turning the way it was thrown, winding down to the slow turn.
    if (fling !== 0) auto = Math.sign(fling) * speed;
    spin = { ...spin, velocity: fling };
    drag = null;
    stage.classList.remove('is-dragging');
    run();
  };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  paint();
  run();

  return () => {
    cancelAnimationFrame(frame);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
  };
}
