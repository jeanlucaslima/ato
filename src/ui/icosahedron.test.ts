import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AUTO_SPEED, CHAMFER, DEPTH, INRADIUS_RATIO, centroid, coast, frame, frontness, icosahedronFaces, icosahedronModel, type Vec } from './icosahedron';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const R = 72;
const faces = icosahedronFaces(R);


describe('icosahedron', () => {
  it('has 20 equilateral faces over 12 vertices on the sphere', () => {
    expect(faces).toHaveLength(20);
    const vertices = new Set(faces.flat().map((v) => v.map((n) => n.toFixed(6)).join()));
    expect(vertices.size).toBe(12);
    const edge = dist(faces[0]![0], faces[0]![1]);
    for (const [a, b, c] of faces) {
      for (const v of [a, b, c]) expect(Math.hypot(...v)).toBeCloseTo(R, 6);
      for (const [p, q] of [[a, b], [b, c], [c, a]] as const) expect(dist(p, q)).toBeCloseTo(edge, 6);
    }
  });

  it('has 30 distinct edges, each shared by two faces', () => {
    const key = (p: Vec, q: Vec) => [p, q].map((v) => v.map((n) => n.toFixed(4)).join()).sort().join('|');
    const counts = new Map<string, number>();
    for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]] as const) counts.set(key(p, q), (counts.get(key(p, q)) ?? 0) + 1);
    expect(counts.size).toBe(30);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });

  it('turns on an axis through the centres of the top and bottom faces', () => {
    const centres = faces.map(centroid);
    for (const y of [-1, 1]) {
      const hit = centres.filter((c) => Math.abs(c[0]) < 1e-9 && Math.abs(c[2]) < 1e-9 && Math.sign(c[1]) === y);
      expect(hit).toHaveLength(1);
      expect(Math.abs(hit[0]![1])).toBeCloseTo(R * INRADIUS_RATIO, 6);
    }
  });

});

describe('frame', () => {
  const model = icosahedronModel(R);
  const angles = fc.double({ min: -720, max: 720, noNaN: true });

  it('draws each of the 30 edges once, and cuts each of the 12 corners with a pentagon', () => {
    expect(model.edges).toHaveLength(30);
    expect(model.rings.every((ring) => ring.length === 5)).toBe(true);
    const f = frame(model, 18);
    expect(f.edges).toHaveLength(30);
    expect(f.facets).toHaveLength(12);
    expect(f.facets.every((facet) => facet.points.length === 5)).toBe(true);
  });

  it('keeps the outline solid at every angle: an edge is solid when either of its faces looks at you', () => {
    fc.assert(
      fc.property(angles, (deg) => {
        const f = frame(model, deg);
        // Some edges are fully solid, some fully dashed, and every value is a blend in 0…1.
        return f.edges.some((e) => e.front === 1) && f.edges.some((e) => e.front === 0) && f.edges.every((e) => e.front >= 0 && e.front <= 1);
      }),
    );
  });

  it('cross-fades solid and dashed smoothly, never a jump', () => {
    expect(frontness(-1)).toBe(0);
    expect(frontness(1)).toBe(1);
    expect(frontness(0)).toBeCloseTo(0.5, 9);
    for (let f = -0.2; f < 0.2; f += 0.01) expect(frontness(f + 0.01) - frontness(f)).toBeLessThan(0.15);
  });

  it('turns smoothly: a small turn moves every edge end only a little (no glitch at the outline)', () => {
    fc.assert(
      fc.property(angles, (deg) => {
        const [a, b] = [frame(model, deg), frame(model, deg + 0.5)];
        return a.edges.every((e, i) => Math.hypot(e.x1 - b.edges[i]!.x1, e.y1 - b.edges[i]!.y1) < 1.5 && Math.abs(e.front - b.edges[i]!.front) < 0.2);
      }),
    );
  });

  it('cuts corners at CHAMFER along each edge, and weighs lines by nearness within ±DEPTH', () => {
    const f = frame(model, 0);
    const len = (e: (typeof f.edges)[number]) => Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    // Projected, a cut edge is about (1 - 2·CHAMFER) of the full edge (edges seen face on are the longest).
    const full = dist(model.vertices[model.edges[0]!.a]!, model.vertices[model.edges[0]!.b]!);
    expect(Math.max(...f.edges.map(len))).toBeLessThan(full * (1 - 2 * CHAMFER) * 1.1);
    expect(f.edges.every((e) => e.weight >= 1 - DEPTH - 1e-9 && e.weight <= 1 + DEPTH + 1e-9)).toBe(true);
  });
});

describe('coast', () => {
  it('keeps the slow turn steady', () => {
    const s = coast({ angle: 0, velocity: AUTO_SPEED }, 2, AUTO_SPEED);
    expect(s.velocity).toBeCloseTo(AUTO_SPEED, 9);
    expect(s.angle).toBeCloseTo(2 * AUTO_SPEED, 9);
  });

  it('eases any fling back toward the slow turn, never overshooting', () => {
    fc.assert(
      fc.property(fc.double({ min: -360, max: 360, noNaN: true }), fc.double({ min: 0.001, max: 0.1, noNaN: true }), (v, dt) => {
        const next = coast({ angle: 0, velocity: v }, dt, AUTO_SPEED);
        return Math.abs(next.velocity - AUTO_SPEED) <= Math.abs(v - AUTO_SPEED) + 1e-9 && Math.sign(next.velocity - AUTO_SPEED) * Math.sign(v - AUTO_SPEED) >= 0;
      }),
    );
  });
});
