/** A count for people: `num(1102)` → `"1,102"`. */
export const num = (n: number): string => n.toLocaleString('en-US');

/**
 * A count where space is tight and it is only for orientation (the view tabs):
 * `1.2k`, `12.3k`, `123k` from `from` up. Close buttons and search use `num`.
 */
export function shortNum(n: number, from = 1_000): string {
  if (n < from) return num(n);
  return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}k`;
}

/** `plural(3, 'tab')` → `"3 tabs"`; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}
