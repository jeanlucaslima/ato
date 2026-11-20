import { describe, expect, it } from 'vitest';
import { FACE_H, FACE_W, faceMatrix, icosahedronFaces, type Vec } from './icosahedron';

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('icosahedron', () => {
  const R = 72;
  const faces = icosahedronFaces(R);

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

  it('maps the face box triangle onto each 3D face', () => {
    for (const face of faces) {
      const m = faceMatrix(face).slice('matrix3d('.length, -1).split(',').map(Number);
      const apply = (x: number, y: number): Vec => [m[0]! * x + m[4]! * y + m[12]!, m[1]! * x + m[5]! * y + m[13]!, m[2]! * x + m[6]! * y + m[14]!];
      const corners = [apply(0, FACE_H), apply(FACE_W, FACE_H), apply(FACE_W / 2, 0)];
      corners.forEach((c, i) => expect(dist(c, face[i]!)).toBeLessThan(1e-3));
    }
  });
});
