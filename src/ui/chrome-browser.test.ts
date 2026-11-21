import { describe, expect, it } from 'vitest';
import { fromChromeGroup, fromChromeTab } from './chrome-browser';

const base = { index: 0, windowId: 1, active: false, pinned: false, highlighted: false, incognito: false, discarded: false, autoDiscardable: true, groupId: -1, selected: false, frozen: false } as unknown as chrome.tabs.Tab;

describe('fromChromeGroup', () => {
  it('keeps id, window, colour and fold; an unnamed group gets an empty title', () => {
    const g = { id: 3, windowId: 2, color: 'cyan', collapsed: true } as chrome.tabGroups.TabGroup;
    expect(fromChromeGroup(g)).toEqual({ id: 3, windowId: 2, title: '', color: 'cyan', collapsed: true });
  });
});

describe('fromChromeTab', () => {
  it('skips tabs without an id', () => {
    expect(fromChromeTab({ ...base }, 0)).toBeNull();
    expect(fromChromeTab({ ...base, id: -1 }, 0)).toBeNull();
  });

  it('fills the gaps Chrome leaves', () => {
    const tab = fromChromeTab({ ...base, id: 7, pendingUrl: 'https://a.test/', groupId: undefined } as unknown as chrome.tabs.Tab, 99);
    expect(tab).toMatchObject({ id: 7, url: 'https://a.test/', title: 'https://a.test/', audible: false, groupId: -1, lastAccessed: 99 });
    expect(tab?.favIconUrl).toBeUndefined();
  });

  it('keeps what Chrome reports', () => {
    const tab = fromChromeTab({ ...base, id: 3, url: 'https://b.test/', title: 'B', audible: true, pinned: true, groupId: 4, lastAccessed: 5, favIconUrl: 'x.png', splitViewId: 2 } as chrome.tabs.Tab, 99);
    expect(tab).toEqual({ id: 3, windowId: 1, index: 0, title: 'B', url: 'https://b.test/', favIconUrl: 'x.png', active: false, pinned: true, audible: true, muted: false, discarded: false, splitViewId: 2, groupId: 4, lastAccessed: 5 });
  });
});
