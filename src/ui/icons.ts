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
  gear: {
    viewBox: '0 0 24 24',
    body: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  },
  close: { viewBox: '0 0 12 12', body: '<path d="m2.5 2.5 7 7m0-7-7 7"/>' },
  chevron: { viewBox: '0 0 12 12', body: '<path d="m3 4.5 3 3 3-3"/>' },
  back: { viewBox: '0 0 12 12', body: '<path d="M7.5 2.5 4 6l3.5 3.5"/>' },
  audio: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.8,
    body: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
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
