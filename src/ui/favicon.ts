import { h } from './dom';

const TINTS = ['#9ebcce', '#a3cbb2', '#e2c084', '#efa4a0', '#c2b3e3', '#c9d1d9', '#d7d0c0', '#b9c4cc'];

/** Stable tint for a domain, so a site keeps its color across renders. */
export function tintFor(domain: string): string {
  let hash = 0;
  for (const ch of domain) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return TINTS[hash % TINTS.length] ?? '#b9c4cc';
}

/** First letter of the registrable-looking part of the domain. */
export function initialFor(domain: string): string {
  const host = domain.replace(/^(www|m|mail|docs|developer|blog|news)\./, '');
  return (host.charAt(0) || '?').toUpperCase();
}

/** Favicon image, or a tinted letter tile when there is none. */
export function favicon(domain: string, url?: string): HTMLElement {
  if (url) return h('img', { class: 'fav', src: url, alt: '', width: 20, height: 20 });
  return h('span', { class: 'fav', style: `--c:${tintFor(domain)}`, 'aria-hidden': 'true' }, initialFor(domain));
}
