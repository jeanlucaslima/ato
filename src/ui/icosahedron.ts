/**
 * The ATO logo as a real 3D icosahedron, built from 20 flat CSS faces.
 * Each face is an equilateral SVG triangle placed in 3D with `matrix3d`;
 * the stylesheet tilts the whole solid and spins it like a globe.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

export type Vec = readonly [x: number, y: number, z: number];
export type Face = readonly [Vec, Vec, Vec];

/** Face triangle in its own 2D box (px): base along the bottom, apex at the top. */
export const FACE_W = 100;
export const FACE_H = (FACE_W * Math.sqrt(3)) / 2;
const P0 = [0, FACE_H] as const;

/**
 * Faces of an icosahedron with circumradius `r`, standing on a vertex: one
 * vertex at each pole, two rings of five between. CSS y points down, so the
 * top pole is `-r`.
 */
export function icosahedronFaces(r: number): Face[] {
  const ringY = r / Math.sqrt(5);
  const ringR = (2 * r) / Math.sqrt(5);
  const ring = (y: number, offset: number): Vec[] =>
    Array.from({ length: 5 }, (_, k) => {
      const a = ((k * 72 + offset) * Math.PI) / 180;
      return [ringR * Math.cos(a), y, ringR * Math.sin(a)] as const;
    });
  const top: Vec = [0, -r, 0];
  const bottom: Vec = [0, r, 0];
  const upper = ring(-ringY, 0);
  const lower = ring(ringY, 36);
  const faces: Face[] = [];
  for (let k = 0; k < 5; k++) {
    const u0 = upper[k]!, u1 = upper[(k + 1) % 5]!, l0 = lower[k]!, l1 = lower[(k + 1) % 5]!;
    faces.push([top, u0, u1], [u0, l0, u1], [l0, l1, u1], [l0, bottom, l1]);
  }
  return faces;
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Affine map taking the face box's triangle — (0,H) (W,H) (W/2,0) — onto the
 * 3D face. Equilateral to equilateral, so strokes keep an even width.
 */
export function faceMatrix([v0, v1, v2]: Face): string {
  const colX = scale(sub(v1, v0), 1 / FACE_W);
  // colX·(W/2) − colY·H = v2 − v0
  const colY = scale(sub(scale(colX, FACE_W / 2), sub(v2, v0)), 1 / FACE_H);
  const n = cross(colX, colY);
  const len = Math.hypot(...n) || 1;
  const colZ = scale(n, 1 / len);
  const t = sub(v0, scale(colY, P0[1]));
  const f = (v: number) => +v.toFixed(5);
  return `matrix3d(${[...colX, 0, ...colY, 0, ...colZ, 0, ...t, 1].map(f).join(',')})`;
}

/** The spinning solid. Decorative: hidden from assistive tech. */
export function icosahedron(radius: number): HTMLElement {
  const solid = document.createElement('div');
  solid.className = 'ico-spin';
  for (const face of icosahedronFaces(radius)) {
    const el = document.createElement('div');
    el.className = 'ico-face';
    el.style.transform = faceMatrix(face);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${FACE_W} ${FACE_H}`);
    svg.setAttribute('width', String(FACE_W));
    svg.setAttribute('height', String(FACE_H));
    const tri = document.createElementNS(SVG_NS, 'polygon');
    tri.setAttribute('points', `0,${FACE_H} ${FACE_W},${FACE_H} ${FACE_W / 2},0`);
    svg.appendChild(tri);
    el.appendChild(svg);
    solid.appendChild(el);
  }
  const tilt = document.createElement('div');
  tilt.className = 'ico-tilt';
  tilt.appendChild(solid);
  const stage = document.createElement('div');
  stage.className = 'ico';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.setProperty('--ico-size', `${radius * 2}px`);
  stage.append(tilt, Object.assign(document.createElement('div'), { className: 'ico-shadow' }));
  return stage;
}
