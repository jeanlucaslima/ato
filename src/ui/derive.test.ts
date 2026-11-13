import { describe, expect, it } from 'vitest';
import { SNAPSHOT } from '../dev/fixtures';
import { deriveModel, displayUrl } from './derive';
import { initialUi } from './state';

describe('deriveModel', () => {
  it('shows a loading screen before the first snapshot', () => {
    expect(deriveModel({ snapshot: null, ui: initialUi() }).screen.kind).toBe('loading');
  });

  it('summarises duplicates the way review will close them', () => {
    const model = deriveModel({ snapshot: SNAPSHOT, ui: initialUi() });
    expect(model.duplicates).toEqual({ extra: 4, sets: 3 });
    const review = deriveModel({ snapshot: SNAPSHOT, ui: initialUi({ reviewOpen: true }) }).screen;
    if (review.kind !== 'review') throw new Error('expected review');
    const closes = review.sets.flatMap((s) => s.copies).filter((c) => c.verdict.action === 'close');
    expect(closes).toHaveLength(4);
    const active = SNAPSHOT.tabs.filter((t) => t.active).map((t) => t.id);
    expect(closes.some((c) => active.includes(c.tabId))).toBe(false);
  });

  it('limits browsing to the focused window in current-window scope', () => {
    const model = deriveModel({ snapshot: SNAPSHOT, ui: initialUi({ scope: 'current' }) });
    expect(model.tabCount).toBe(SNAPSHOT.tabs.filter((t) => t.windowId === SNAPSHOT.focusedWindowId).length);
  });
});

describe('displayUrl', () => {
  it('drops the scheme and shifts highlight ranges', () => {
    expect(displayUrl('https://www.a.test/x', [[12, 18]])).toEqual({ text: 'a.test/x', ranges: [[0, 6]] });
  });
});
