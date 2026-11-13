// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { h } from './dom';
import { morph } from './morph';

const list = (keys: string[]) =>
  h('ul', null, keys.map((k) => h('li', { 'data-key': k, class: `item-${k}` }, `text ${k}`)));

describe('morph', () => {
  it('updates text and attributes in place', () => {
    const el = h('div', { class: 'a', title: 'x' }, 'hello');
    const before = el.firstChild;
    morph(el, h('div', { class: 'b' }, 'world'));
    expect(el.outerHTML).toBe('<div class="b">world</div>');
    expect(el.firstChild).toBe(before);
  });

  it('reuses keyed nodes when they reorder', () => {
    const el = list(['a', 'b', 'c']);
    const [a, b, c] = Array.from(el.children);
    morph(el, list(['c', 'a', 'b']));
    expect(Array.from(el.children)).toEqual([c, a, b]);
  });

  it('replaces a node whose key changed', () => {
    const el = h('div', null, h('section', { 'data-key': 'one' }));
    const old = el.firstElementChild;
    morph(el, h('div', null, h('section', { 'data-key': 'two' })));
    expect(el.firstElementChild).not.toBe(old);
    expect(el.firstElementChild?.getAttribute('data-key')).toBe('two');
  });

  it('keeps the value of a focused input', () => {
    const input = h('input', { value: 'old' });
    const el = h('div', null, input);
    document.body.append(el);
    input.focus();
    input.value = 'typed';
    morph(el, h('div', null, h('input', { value: 'old' })));
    expect(el.firstElementChild).toBe(input);
    expect(input.value).toBe('typed');
    el.remove();
  });

  it('syncs checkbox state', () => {
    const el = h('div', null, h('input', { type: 'checkbox' }));
    morph(el, h('div', null, h('input', { type: 'checkbox', checked: true })));
    expect((el.firstElementChild as HTMLInputElement).checked).toBe(true);
  });

  it('produces the same markup as a fresh render, for any keyed list change', () => {
    const keys = fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { maxLength: 6 });
    fc.assert(
      fc.property(keys, keys, (from, to) => {
        const el = list(from);
        const survivors = new Map(Array.from(el.children).map((c) => [c.getAttribute('data-key'), c]));
        morph(el, list(to));
        expect(el.outerHTML).toBe(list(to).outerHTML);
        for (const child of Array.from(el.children)) {
          const key = child.getAttribute('data-key');
          if ((from as string[]).includes(key ?? '')) expect(child).toBe(survivors.get(key));
        }
      }),
    );
  });
});
