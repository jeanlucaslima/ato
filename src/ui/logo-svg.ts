/**
 * The ATO logo as a static SVG, rendered from the same 3D icosahedron the
 * settings page spins: edges facing the viewer solid, hidden edges dashed and
 * fainter. Pure string output, so a script can write it to disk
 * (`npm run logo`) and tests can check it.
 */
import { centroid, icosahedronFaces, type Vec } from './icosahedron';

export interface LogoOptions {
  /** Square canvas size (SVG units). */
  size?: number;
  /** Turn about the axis, degrees. The three-fold axis repeats every 120°. */
  spin?: number;
  /** Lean of the axis (CSS rotateZ, degrees): negative leans top-left. */
  lean?: number;
  /** View from above (CSS rotateX, degrees). */
  pitch?: number;
  /** Camera distance in circumradii; `Infinity` for a flat, orthographic view. */
  distance?: number;
  /** Rounded-square backdrop like the app icon; `null` for transparent. */
  background?: { fill: string; stroke?: string } | null;
  color?: string;
  /** Opacity of hidden (dashed) edges. */
  hiddenOpacity?: number;
  /** Line weight relative to the spinning logo's (1); small renders need more. */
  weight?: number;
  /** Dashes per hidden edge; small renders need fewer. */
  dashes?: number;
}

const DEFAULTS: Required<LogoOptions> = {
  size: 512,
  spin: 18,
  lean: -20,
  pitch: -6,
  distance: 900 / 72, // what the settings page uses: perspective 900px, radius 72px
  background: { fill: '#151617', stroke: '#184667' },
  color: '#c7c7c7',
  hiddenOpacity: 0.45,
  weight: 1,
  dashes: 6,
};

/**
 * Dash pattern (in pathLength-100 units) with `n` dashes that exactly fill an
 * edge, starting and ending on a dash, gaps ~1.47× the dash as on the page.
 */
export function dashPattern(n: number): string {
  const dash = 100 / (n + (n - 1) * 1.4667);
  const f = (v: number) => +v.toFixed(3);
  return n <= 1 ? '100 0' : `${f(dash)} ${f(dash * 1.4667)}`;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Options over defaults; an option given as `undefined` keeps its default. */
function withDefaults(options: LogoOptions): Required<LogoOptions> {
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  return { ...DEFAULTS, ...given };
}

/** CSS rotate matrices (y down, z toward the viewer), applied like `rotateZ() rotateX() rotateY()`. */
function rotate([x, y, z]: Vec, { spin, lean, pitch }: { spin: number; lean: number; pitch: number }): Vec {
  let c = Math.cos(rad(spin)), s = Math.sin(rad(spin));
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rad(pitch)); s = Math.sin(rad(pitch));
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(rad(lean)); s = Math.sin(rad(lean));
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

interface Edge {
  a: Vec;
  b: Vec;
  /** Seen by the viewer: at least one of its two faces looks toward the camera. */
  visible: boolean;
}

/** The 30 edges, turned into view, each marked visible or hidden. */
export function logoEdges(options: LogoOptions = {}): Edge[] {
  const o = withDefaults(options);
  const r = 1;
  const eye: Vec = [0, 0, o.distance * r];
  const edges = new Map<string, Edge>();
  for (const face of icosahedronFaces(r)) {
    const [a, b, c] = face.map((v) => rotate(v, o)) as [Vec, Vec, Vec];
    const mid = centroid([a, b, c]);
    // Outward normal: the centroid direction (the solid is centred at the origin).
    const toEye = Number.isFinite(o.distance) ? [eye[0] - mid[0], eye[1] - mid[1], eye[2] - mid[2]] : [0, 0, 1];
    const facing = mid[0] * toEye[0]! + mid[1] * toEye[1]! + mid[2] * toEye[2]! > 0;
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      const key = [p, q].map((v) => v.map((n) => n.toFixed(6)).join()).sort().join('|');
      const edge = edges.get(key);
      if (edge) edge.visible ||= facing;
      else edges.set(key, { a: p, b: q, visible: facing });
    }
  }
  return [...edges.values()];
}

export function logoSvg(options: LogoOptions = {}): string {
  const o = withDefaults(options);
  const project = ([x, y, z]: Vec): [number, number] => {
    const k = Number.isFinite(o.distance) ? o.distance / (o.distance - z) : 1;
    return [x * k, y * k];
  };
  const edges = logoEdges(o).map((e) => ({ ...e, p: project(e.a), q: project(e.b) }));
  // Fit the drawing in the middle of the canvas.
  const xs = edges.flatMap((e) => [e.p[0], e.q[0]]);
  const ys = edges.flatMap((e) => [e.p[1], e.q[1]]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const fit = o.background ? 0.74 : 0.9;
  const scale = (o.size * fit) / span;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const at = ([x, y]: [number, number]) => [o.size / 2 + (x - cx) * scale, o.size / 2 + (y - cy) * scale].map((n) => +n.toFixed(2));
  // Same weight as the spinning logo: 3.6% of an edge.
  const edgeLen = 1.0514622 * scale;
  const stroke = +(edgeLen * 0.036 * o.weight).toFixed(2);
  const line = (e: (typeof edges)[number]) => {
    const [x1, y1] = at(e.p), [x2, y2] = at(e.q);
    // pathLength 100 + dashPattern(n): n dashes that exactly fill each edge, as on the page.
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${e.visible ? '' : ' pathLength="100"'}/>`;
  };
  const bg = o.background;
  const radius = +(o.size * 0.317).toFixed(2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.size} ${o.size}" width="${o.size}" height="${o.size}">`,
    bg && `  <rect x="1" y="1" width="${o.size - 2}" height="${o.size - 2}" rx="${radius}" fill="${bg.fill}"${bg.stroke ? ` stroke="${bg.stroke}" stroke-width="2"` : ''}/>`,
    `  <g fill="none" stroke="${o.color}" stroke-width="${stroke}" stroke-linecap="round">`,
    `    <g opacity="${o.hiddenOpacity}" stroke-dasharray="${dashPattern(o.dashes)}">`,
    ...edges.filter((e) => !e.visible).map((e) => `      ${line(e)}`),
    `    </g>`,
    ...edges.filter((e) => e.visible).map((e) => `    ${line(e)}`),
    `  </g>`,
    `</svg>`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
}
