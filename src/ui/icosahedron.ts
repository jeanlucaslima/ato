/**
 * The ATO logo as a real 3D icosahedron, built from 20 flat CSS faces.
 *
 * Each face is an equilateral triangle placed in 3D with `matrix3d`, drawn
 * twice: solid edges that show while the face looks at you, dashed edges that
 * show while it looks away. That gives the logo's look (dashed hidden edges
 * meeting in stars at the back vertices) from any angle. The solid turns
 * about an axis through the centres of two opposite faces, like a globe on a
 * tilted rod, and can be spun by dragging.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

export type Vec = readonly [x: number, y: number, z: number];
export type Face = readonly [Vec, Vec, Vec];

/** Face triangle in its own 2D box (px): base along the bottom, apex at the top. */
export const FACE_W = 100;
export const FACE_H = (FACE_W * Math.sqrt(3)) / 2;
const CORNERS = [
  [0, FACE_H],
  [FACE_W, FACE_H],
  [FACE_W / 2, 0],
] as const;

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
 * Every face is wound so its `matrix3d` front looks outward.
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
    return outward([a, b, c]) ? [a, b, c] : [a, c, b];
  });
}

/** Local z of the face's `matrix3d` (its front) points away from the middle. */
function outward(face: Face): boolean {
  return dot(faceBasis(face).z, centroid(face)) > 0;
}

function faceBasis([v0, v1, v2]: Face): { x: Vec; y: Vec; z: Vec; t: Vec } {
  const x = scale(sub(v1, v0), 1 / FACE_W);
  // x·(W/2) − y·H = v2 − v0
  const y = scale(sub(scale(x, FACE_W / 2), sub(v2, v0)), 1 / FACE_H);
  const n = cross(x, y);
  return { x, y, z: scale(n, 1 / (norm(n) || 1)), t: sub(v0, scale(y, FACE_H)) };
}

/**
 * Affine map taking the face box's triangle — (0,H) (W,H) (W/2,0) — onto the
 * 3D face. Equilateral to equilateral, so strokes keep an even width.
 */
export function faceMatrix(face: Face): string {
  const { x, y, z, t } = faceBasis(face);
  const f = (v: number) => +v.toFixed(5);
  return `matrix3d(${[...x, 0, ...y, 0, ...z, 0, ...t, 1].map(f).join(',')})`;
}

function edges(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', `0 0 ${FACE_W} ${FACE_H}`);
  svg.setAttribute('width', String(FACE_W));
  svg.setAttribute('height', String(FACE_H));
  CORNERS.forEach(([x1, y1], i) => {
    const [x2, y2] = CORNERS[(i + 1) % 3]!;
    const line = document.createElementNS(SVG_NS, 'line');
    for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(k, String(+v.toFixed(3)));
    svg.appendChild(line);
  });
  return svg;
}

/** The axis rod: solid outside the solid, dashed (hidden) inside it. */
function axis(radius: number, length: number): SVGSVGElement {
  const inner = radius * INRADIUS_RATIO;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ico-axis');
  svg.setAttribute('width', '4');
  svg.setAttribute('height', String(2 * length));
  svg.setAttribute('viewBox', `-2 ${-length} 4 ${2 * length}`);
  for (const [y1, y2, hidden] of [[-length, -inner, false], [-inner, inner, true], [inner, length, false]] as const) {
    const line = document.createElementNS(SVG_NS, 'line');
    for (const [k, v] of Object.entries({ x1: 0, x2: 0, y1, y2 })) line.setAttribute(k, String(+v.toFixed(3)));
    if (hidden) line.setAttribute('class', 'is-hidden');
    svg.appendChild(line);
  }
  return svg;
}

/**
 * The solid, standing still. Decorative: hidden from assistive tech. Marked
 * `data-morph-keep` because `attachSpin` owns its rotation once mounted.
 */
export function icosahedron(radius: number): HTMLElement {
  const solid = document.createElement('div');
  solid.className = 'ico-spin';
  for (const face of icosahedronFaces(radius)) {
    const el = document.createElement('div');
    el.className = 'ico-face';
    el.style.transform = faceMatrix(face);
    el.append(edges('ico-front'), edges('ico-back'));
    solid.appendChild(el);
  }
  const tilt = document.createElement('div');
  tilt.className = 'ico-tilt';
  tilt.append(axis(radius, radius * 1.22), solid);
  const stage = document.createElement('div');
  stage.className = 'ico';
  stage.setAttribute('aria-hidden', 'true');
  stage.setAttribute('data-morph-keep', '');
  stage.style.setProperty('--ico-size', `${Math.round(radius * 2.5)}px`);
  stage.appendChild(tilt);
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
/** How long a fling takes to settle back to the slow turn (s, time constant). */
const SETTLE_S = 1;
const DEG_PER_PX = 0.6;
const MAX_FLING = 360;

/** Advance a free spin by `dt` seconds: any fling eases back to `auto`. */
export function coast(spin: Spin, dt: number, auto: number): Spin {
  const velocity = auto + (spin.velocity - auto) * Math.exp(-dt / SETTLE_S);
  return { angle: (spin.angle + ((spin.velocity + velocity) / 2) * dt) % 360, velocity };
}

/**
 * Turn the solid: slowly on its own, and with the pointer (drag sideways to
 * spin it; let go mid-swipe to fling). With reduced motion it only moves while
 * dragged. Returns a stop function.
 */
export function attachSpin(stage: HTMLElement, reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches): () => void {
  const solid = stage.querySelector<HTMLElement>('.ico-spin');
  if (!solid) return () => {};
  const auto = reducedMotion ? 0 : AUTO_SPEED;
  let spin: Spin = { angle: 18, velocity: auto };
  let drag: { x: number; t: number } | null = null;
  let frame = 0;
  let last = 0;

  const paint = () => (solid.style.transform = `rotateY(${spin.angle.toFixed(3)}deg)`);
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!drag) spin = coast(spin, dt, auto);
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
    const held = e.timeStamp - drag.t > 90;
    const fling = held || reducedMotion ? 0 : Math.max(-MAX_FLING, Math.min(MAX_FLING, spin.velocity));
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
