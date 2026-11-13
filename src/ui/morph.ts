/**
 * Update `current` in place to match `next`, reusing existing nodes so CSS
 * transitions, focus, scroll position and in-progress typing survive a re-render.
 *
 * Children are matched by `data-key` when present, otherwise by position and tag.
 * A node whose tag or key differs is replaced, so a new key is how a render asks
 * for a fresh element (and its enter animation).
 */
export function morph(current: Element, next: Element): void {
  syncAttributes(current, next);
  syncFormState(current, next);
  syncChildren(current, next);
}

const keyOf = (node: Node): string | null =>
  node.nodeType === Node.ELEMENT_NODE ? (node as Element).getAttribute('data-key') : null;

function sameKind(a: Node, b: Node): boolean {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);
}

function syncAttributes(current: Element, next: Element): void {
  for (const { name } of Array.from(current.attributes)) {
    if (!next.hasAttribute(name)) current.removeAttribute(name);
  }
  for (const { name, value } of Array.from(next.attributes)) {
    if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  }
}

function syncFormState(current: Element, next: Element): void {
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    // Never fight the user's caret: a focused field already holds the latest text.
    if (current.value !== next.value && current.ownerDocument.activeElement !== current) current.value = next.value;
    if (current.checked !== next.checked) current.checked = next.checked;
  }
}

function syncChildren(current: Element, next: Element): void {
  const oldChildren = Array.from(current.childNodes);
  const keyed = new Map<string, Node>();
  for (const child of oldChildren) {
    const key = keyOf(child);
    if (key !== null) keyed.set(key, child);
  }
  const used = new Set<Node>();
  let unkeyedCursor = 0;

  const takeUnkeyed = (target: Node): Node | undefined => {
    while (unkeyedCursor < oldChildren.length) {
      const candidate = oldChildren[unkeyedCursor++];
      if (candidate && keyOf(candidate) === null && !used.has(candidate)) {
        return sameKind(candidate, target) ? candidate : undefined;
      }
    }
    return undefined;
  };

  const nextChildren = Array.from(next.childNodes);
  nextChildren.forEach((target, index) => {
    const key = keyOf(target);
    let match = key !== null ? keyed.get(key) : takeUnkeyed(target);
    if (match && (used.has(match) || !sameKind(match, target))) match = undefined;

    let node: Node;
    if (match) {
      used.add(match);
      if (match.nodeType === Node.ELEMENT_NODE) morph(match as Element, target as Element);
      else if (match.nodeValue !== target.nodeValue) match.nodeValue = target.nodeValue;
      node = match;
    } else {
      node = target; // adopt the freshly rendered node as-is
    }

    const atIndex = current.childNodes[index];
    if (atIndex !== node) current.insertBefore(node, atIndex ?? null);
  });

  for (const child of oldChildren) {
    if (!used.has(child) && child.parentNode === current && !nextChildren.includes(child as ChildNode)) {
      current.removeChild(child);
    }
  }
  while (current.childNodes.length > nextChildren.length) {
    const last = current.lastChild;
    if (!last) break;
    current.removeChild(last);
  }
}
