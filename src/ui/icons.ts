const SVG_NS = 'http://www.w3.org/2000/svg';

interface IconDef {
  viewBox: string;
  /** Static, trusted SVG markup (constants in this file only). */
  body: string;
  fill?: boolean;
  strokeWidth?: number;
}

const ICONS = {
  search: { viewBox: '0 0 24 24', body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>' },
  /** Eight square-cut teeth round a hub: reads as a gear, not a sun. */
  gear: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.7,
    body: '<path d="M10.08 4.85L10.35 2.14L13.65 2.14L13.92 4.85A7.4 7.4 0 0 1 15.70 5.59L17.81 3.86L20.14 6.19L18.41 8.30A7.4 7.4 0 0 1 19.15 10.08L21.86 10.35L21.86 13.65L19.15 13.92A7.4 7.4 0 0 1 18.41 15.70L20.14 17.81L17.81 20.14L15.70 18.41A7.4 7.4 0 0 1 13.92 19.15L13.65 21.86L10.35 21.86L10.08 19.15A7.4 7.4 0 0 1 8.30 18.41L6.19 20.14L3.86 17.81L5.59 15.70A7.4 7.4 0 0 1 4.85 13.92L2.14 13.65L2.14 10.35L4.85 10.08A7.4 7.4 0 0 1 5.59 8.30L3.86 6.19L6.19 3.86L8.30 5.59A7.4 7.4 0 0 1 10.08 4.85Z"/><circle cx="12" cy="12" r="3"/>',
  },
  /** Settings as a mixing desk: Cyber's take on the gear. */
  sliders: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.7,
    body: '<path d="M3.5 7h9.5M17 7h3.5M3.5 12h3.5M11 12h9.5M3.5 17h11.5M19 17h1.5"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  },
  close: { viewBox: '0 0 12 12', body: '<path d="m2.5 2.5 7 7m0-7-7 7"/>' },
  chevron: { viewBox: '0 0 12 12', body: '<path d="m3 4.5 3 3 3-3"/>' },
  back: { viewBox: '0 0 12 12', body: '<path d="M7.5 2.5 4 6l3.5 3.5"/>' },
  newWindow: { viewBox: '0 0 24 24', body: '<rect x="3.5" y="6.5" width="14" height="13" rx="2"/><path d="M3.5 10.5h14M14 3.5h6.5V10M20.5 3.5l-6 6"/>' },
  check: { viewBox: '0 0 24 24', body: '<path d="m5 12.5 4.5 4.5L19 7.5"/>' },
  audio: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.8,
    body: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  },
  muted: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.8,
    body: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5m0-5-5 5"/>',
  },
  puzzle: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.7,
    body: '<path d="M9 4.5a2 2 0 0 1 4 0V6h4v4h1.5a2 2 0 0 1 0 4H17v4.5H5V14h1.5a2 2 0 0 0 0-4H5V6h4z"/>',
  },
  pin: { viewBox: '0 0 24 24', strokeWidth: 1.8, body: '<path d="M9 3h6l-1 6 4 3v2H6v-2l4-3zM12 14v7"/>' },
  caretRight: { viewBox: '0 0 12 12', fill: true, body: '<path d="M4 2l4 4-4 4z"/>' },
  caretDown: { viewBox: '0 0 12 12', fill: true, body: '<path d="M2 4h8l-4 4z"/>' },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

/**
 * Inline SVG icon in `currentColor`. Decorative unless `label` is given,
 * in which case it is exposed as an image with that accessible name.
 */
export function icon(name: IconName, size: number, label?: string): SVGSVGElement {
  const def: IconDef = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', def.viewBox);
  if (def.fill) {
    svg.setAttribute('fill', 'currentColor');
  } else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(def.strokeWidth ?? 1.6));
  }
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  svg.innerHTML = def.body;
  return svg;
}
