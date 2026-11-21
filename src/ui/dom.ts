/** Minimal DOM builder. Text always goes in as text nodes, never as HTML. */

export type Child = Node | string | number | null | undefined | false | Child[];
export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue | EventListener>;

/**
 * Create an element. `on*` function attributes become event listeners;
 * `true` sets a boolean attribute; `false`, `null` and `undefined` are skipped.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value != null && value !== false) {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

/** Join class names, dropping falsy entries. */
export function cls(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
