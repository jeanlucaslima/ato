/** `plural(3, 'tab')` → `"3 tabs"`; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
