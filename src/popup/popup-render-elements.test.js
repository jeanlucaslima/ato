import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDomainSection,
  createFaviconElement,
  createGroupedDuplicateItem,
  createTabItem
} from './popup-render-elements.js';

const originalDocument = globalThis.document;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.title = '';
    this.alt = '';
    this.loading = '';
    this.src = '';
    this.textContent = '';
    this.innerHTML = '';
    this.onclick = null;
    this.style = {
      values: {},
      setProperty: (name, value) => {
        this.style.values[name] = value;
      }
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      contains: name => classes.has(name),
      toString: () => [...classes].join(' ')
    };
  }

  set className(value) {
    this._className = value;
    value.split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name));
  }

  get className() {
    return this._className || '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
    delete this.attributes[name];
  }
}

beforeEach(() => {
  globalThis.document = {
    createElement: tagName => new FakeElement(tagName),
    createElementNS: (namespace, tagName) => new FakeElement(tagName)
  };
});

afterEach(() => {
  globalThis.document = originalDocument;
});

describe('popup render elements', () => {
  it('creates a tab item with status classes and metadata', () => {
    const item = createTabItem({
      id: 7,
      windowId: 2,
      title: 'Example',
      url: 'https://example.test',
      favIconUrl: 'https://example.test/favicon.ico',
      active: true,
      audible: true,
      pinned: true,
      lastAccessed: 1
    }, 3, 4, null, 'tab:tabs:7');

    expect(item.classList.contains('tab-item')).toBe(true);
    expect(item.classList.contains('is-current')).toBe(true);
    expect(item.classList.contains('is-audible')).toBe(true);
    expect(item.classList.contains('is-pinned')).toBe(true);
    expect(item.dataset.tabId).toBe(7);
    expect(item.dataset.windowId).toBe(2);
    expect(item.dataset.navId).toBe('tab:tabs:7');
    expect(item.style.values['--item-index']).toBe(4);
  });

  it('falls back to a favicon placeholder for non-loadable URLs', () => {
    const favicon = createFaviconElement('chrome://favicon');

    expect(favicon.className).toBe('tab-favicon placeholder');
    expect(favicon.src).toMatch(/^data:image\/svg\+xml/);
  });

  it('creates a duplicate group row keyed by URL', () => {
    const item = createGroupedDuplicateItem({
      url: 'https://example.test',
      tabs: [{ audible: true }, {}],
      representative: {
        id: 7,
        windowId: 2,
        title: 'Example',
        url: 'https://example.test',
        audible: true
      },
      totalCount: 3
    });

    expect(item.classList.contains('duplicate-group-item')).toBe(true);
    expect(item.dataset.url).toBe('https://example.test');
    expect(item.dataset.tabId).toBe(7);
  });

  it('wires domain section callbacks without closing over popup globals', () => {
    const onToggleDomain = vi.fn();
    const onMoveDomain = vi.fn();
    const onCloseDomain = vi.fn();
    const section = createDomainSection('example.test', [{
      id: 7,
      windowId: 2,
      title: 'Example',
      url: 'https://example.test'
    }], new Map(), {
      isExpanded: false,
      matchMode: 'exact',
      onToggleDomain,
      onMoveDomain,
      onCloseDomain
    });

    const header = section.children[0];
    const actionBar = section.children[1].children[0].children[0];
    const moveButton = actionBar.children[0];
    const closeButton = actionBar.children[1];

    header.onclick();
    moveButton.onclick({ stopPropagation: vi.fn() });
    closeButton.onclick({ stopPropagation: vi.fn() });

    expect(header.attributes['aria-expanded']).toBe('false');
    expect(onToggleDomain).toHaveBeenCalledWith('example.test');
    expect(onMoveDomain).toHaveBeenCalledWith('example.test');
    expect(onCloseDomain).toHaveBeenCalledWith('example.test');
  });
});
