import { describe, expect, it } from 'vitest';
import { dashPattern, logoEdges, logoSvg } from './logo-svg';

describe('logo svg', () => {
  it('draws all 30 edges, the front ones solid and the hidden ones dashed', () => {
    const edges = logoEdges();
    expect(edges).toHaveLength(30);
    const visible = edges.filter((e) => e.visible).length;
    // A convex solid always shows some edges and hides some.
    expect(visible).toBeGreaterThan(15);
    expect(visible).toBeLessThan(30);
    const svg = logoSvg();
    expect(svg.match(/<line /g)).toHaveLength(30);
    expect(svg.match(/pathLength="100"/g)).toHaveLength(30 - visible);
  });

  it('fits n dashes exactly into an edge', () => {
    for (let n = 2; n <= 8; n++) {
      const [dash, gap] = dashPattern(n).split(' ').map(Number) as [number, number];
      expect(n * dash + (n - 1) * gap).toBeCloseTo(100, 1);
    }
    expect(dashPattern(6)).toBe('7.5 11');
  });

  it('treats an option given as undefined as not given', () => {
    expect(logoSvg({ spin: undefined })).toBe(logoSvg());
    expect(logoSvg({ spin: undefined })).not.toContain('NaN');
  });

  it('keeps every point on the canvas', () => {
    for (const spin of [0, 37, 90, 200]) {
      const nums = [...logoSvg({ spin, size: 256 }).matchAll(/[xy][12]="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...nums)).toBeLessThanOrEqual(256);
    }
  });
});
