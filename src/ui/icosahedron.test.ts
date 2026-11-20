import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AUTO_SPEED, FACE_H, FACE_W, INRADIUS_RATIO, centroid, coast, faceMatrix, icosahedronFaces, type Vec } from './icosahedron';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const R = 72;
const faces = icosahedronFaces(R);

function matrixOf(css: string): number[] {
  return css.slice('matrix3d('.length, -1).split(',').map(Number);
}

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

  it('maps the face box triangle onto each face, front looking outward', () => {
    for (const face of faces) {
      const m = matrixOf(faceMatrix(face));
      const apply = (x: number, y: number): Vec => [m[0]! * x + m[4]! * y + m[12]!, m[1]! * x + m[5]! * y + m[13]!, m[2]! * x + m[6]! * y + m[14]!];
      const corners = [apply(0, FACE_H), apply(FACE_W, FACE_H), apply(FACE_W / 2, 0)];
      corners.forEach((c, i) => expect(dist(c, face[i]!)).toBeLessThan(0.01));
      const z: Vec = [m[8]!, m[9]!, m[10]!];
      const c = centroid(face);
      expect(z[0] * c[0] + z[1] * c[1] + z[2] * c[2]).toBeGreaterThan(0);
    }
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
