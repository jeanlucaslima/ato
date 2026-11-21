import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readCloseRecord, UNDO_OFFER_MS, undoOffer } from './close-record';
import type { Tab } from './types';

const tab: Tab = { id: 1, windowId: 1, index: 0, title: 'A', url: 'https://a.test/', active: false, pinned: false, audible: false, discarded: false, groupId: -1, lastAccessed: 0 };

describe('undoOffer', () => {
  it('offers exactly the menu closes with tabs from the last minute', () => {
    fc.assert(
      fc.property(fc.constantFrom('menu', 'popup'), fc.integer({ min: 0, max: 3 }), fc.integer({ min: -5_000, max: 2 * UNDO_OFFER_MS }), (source, n, age) => {
        const now = 1_800_000_000_000;
        const record = { tabs: Array.from({ length: n }, (_, i) => ({ ...tab, id: i + 1 })), closedAt: now - age, message: 'Closed', source };
        const offered = undoOffer(record, now) !== null;
        return offered === (source === 'menu' && n > 0 && age >= 0 && age <= UNDO_OFFER_MS);
      }),
    );
  });

  it('ignores anything malformed in storage', () => {
    expect(readCloseRecord(undefined)).toBeNull();
    expect(readCloseRecord({ tabs: [{ id: 'x' }], closedAt: 1, message: '', source: 'menu' })).toBeNull();
    expect(readCloseRecord({ tabs: [tab], closedAt: '1', message: '', source: 'menu' })).toBeNull();
    expect(readCloseRecord({ tabs: [tab], closedAt: 1, message: '', source: 'other' })).toBeNull();
    expect(readCloseRecord({ tabs: [tab], closedAt: 1, message: 'm', source: 'menu' })).toEqual({ tabs: [tab], closedAt: 1, message: 'm', source: 'menu' });
  });
});
