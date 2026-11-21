/**
 * Write the ATO logo SVG from the 3D icosahedron (same model as the settings
 * page). Run with `npm run logo`; choose the pose with --spin=<deg>, --pitch=<deg>
 * and --lean=<deg> (e.g. `npm run logo -- --spin=100 --pitch=-18 --lean=-20`).
 */
import { writeFileSync } from 'node:fs';
import { logoSvg } from '../src/ui/logo-svg';

const arg = (name: string): number | undefined => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? Number(found.slice(name.length + 3)) : undefined;
};

/** The app icon's pose, picked in the gallery's angle picker (2026-11-21). */
export const POSE = { spin: 17, pitch: -18, lean: -41 };

const out = 'src/assets/icons/ato-logo-3d.svg';
writeFileSync(out, logoSvg({ spin: arg('spin') ?? POSE.spin, pitch: arg('pitch') ?? POSE.pitch, lean: arg('lean') ?? POSE.lean }));
console.log(`wrote ${out}`);
