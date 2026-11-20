/**
 * Write the ATO logo SVG from the 3D icosahedron (same model as the settings
 * page). Run with `npm run logo`; choose the pose with --spin=<deg> and
 * --pitch=<deg> (e.g. `npm run logo -- --spin=100 --pitch=-18`).
 */
import { writeFileSync } from 'node:fs';
import { logoSvg } from '../src/ui/logo-svg';

const arg = (name: string): number | undefined => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? Number(found.slice(name.length + 3)) : undefined;
};

/** The pose the logo file uses unless told otherwise. */
const POSE = { spin: 100, pitch: -18 };

const out = 'src/assets/icons/ato-logo-3d.svg';
writeFileSync(out, logoSvg({ spin: arg('spin') ?? POSE.spin, pitch: arg('pitch') ?? POSE.pitch }));
console.log(`wrote ${out}`);
