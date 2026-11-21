import { describe, expect, it } from 'vitest';
import { KEY_HELP, PAGE, resolveKey, type KeyContext, type KeyLike } from './keys';

const ctx = (patch: Partial<KeyContext> = {}): KeyContext => ({
  typing: false,
  hasQuery: false,
  selecting: false,
  reviewOpen: false,
  helpOpen: false,
  hasCursor: true,
  ...patch,
});

const action = (e: KeyLike, c = ctx()) => {
  const command = resolveKey(e, c);
  return command?.kind === 'action' ? command.action : command;
};

describe('resolveKey', () => {
  it('opens review with ⌘D / Ctrl+D even while typing; plain d types', () => {
    expect(action({ key: 'd', metaKey: true }, ctx({ typing: true }))).toEqual({ type: 'openReview' });
    expect(action({ key: 'd', ctrlKey: true }, ctx({ typing: true }))).toEqual({ type: 'openReview' });
    expect(action({ key: 'd' }, ctx({ typing: true }))).toBeNull();
    expect(action({ key: 'd' })).toEqual({ type: 'openReview' });
    expect(action({ key: 'd', metaKey: true }, ctx({ reviewOpen: true }))).toEqual({ type: 'confirmReview' });
  });

  it('navigates with arrows, j/k, paging and Home/End', () => {
    expect(action({ key: 'ArrowDown' })).toEqual({ type: 'moveCursor', delta: 1 });
    expect(action({ key: 'k' })).toEqual({ type: 'moveCursor', delta: -1 });
    expect(action({ key: 'PageDown' })).toEqual({ type: 'moveCursor', delta: PAGE });
    expect(action({ key: 'End' })).toEqual({ type: 'cursorTo', where: 'last' });
    expect(action({ key: 'ArrowUp', metaKey: true })).toEqual({ type: 'cursorTo', where: 'first' });
  });

  it('keeps arrows working while typing, but letters go to the field', () => {
    expect(action({ key: 'ArrowDown' }, ctx({ typing: true }))).toEqual({ type: 'moveCursor', delta: 1 });
    expect(resolveKey({ key: 'j' }, ctx({ typing: true }))).toBeNull();
    expect(resolveKey({ key: 'Backspace' }, ctx({ typing: true }))).toBeNull();
    expect(resolveKey({ key: 'Backspace' }, ctx({ typing: true, fieldChip: true }))).toBeNull();
    expect(action({ key: 'Backspace' }, ctx({ typing: true, fieldChip: true, caretAtStart: true }))).toEqual({ type: 'clearField' });
    expect(resolveKey({ key: 'z', metaKey: true }, ctx({ typing: true }))).toBeNull();
  });

  it('closes from the search field with ⌘⌫: the results with a query, else the row under the cursor', () => {
    expect(action({ key: 'Backspace', metaKey: true }, ctx({ typing: true, hasQuery: true }))).toEqual({ type: 'closeResults' });
    expect(action({ key: 'Backspace', metaKey: true }, ctx({ typing: true }))).toEqual({ type: 'cursorKey', key: 'delete' });
    expect(resolveKey({ key: 'Backspace', metaKey: true }, ctx({ typing: true, hasCursor: false }))).toBeNull();
    // Plain ⌫ in an empty field still does nothing: holding it to clear the text never closes tabs.
    expect(resolveKey({ key: 'Backspace' }, ctx({ typing: true }))).toBeNull();
  });

  it('goes up into search with ↑ from the top of the list; from search, or in review, ↑ wraps', () => {
    expect(resolveKey({ key: 'ArrowUp' }, ctx({ atTop: true }))).toEqual({ kind: 'focusSearch', fromList: true });
    expect(action({ key: 'ArrowUp' }, ctx({ atTop: false }))).toEqual({ type: 'moveCursor', delta: -1 });
    expect(action({ key: 'ArrowUp' }, ctx({ atTop: true, typing: true }))).toEqual({ type: 'moveCursor', delta: -1 });
    expect(action({ key: 'ArrowUp' }, ctx({ atTop: true, reviewOpen: true }))).toEqual({ type: 'moveCursor', delta: -1 });
    expect(action({ key: 'ArrowDown' }, ctx({ atTop: true }))).toEqual({ type: 'moveCursor', delta: 1 });
  });

  it('only takes Enter when there is something to act on', () => {
    expect(resolveKey({ key: 'Enter' }, ctx({ hasCursor: false }))).toBeNull();
    // Review too: ↵ acts on the row under the cursor; ⌘D closes everything.
    expect(resolveKey({ key: 'Enter' }, ctx({ hasCursor: false, reviewOpen: true }))).toBeNull();
  });

  it('unwinds Escape one layer at a time', () => {
    expect(action({ key: 'Escape' }, ctx({ helpOpen: true, hasQuery: true }))).toEqual({ type: 'toggleHelp' });
    expect(action({ key: 'Escape' }, ctx({ hasQuery: true, selecting: true }))).toEqual({ type: 'clearQuery' });
    expect(action({ key: 'Escape' }, ctx({ selecting: true, reviewOpen: true }))).toEqual({ type: 'exitSelect' });
    expect(action({ key: 'Escape' }, ctx({ reviewOpen: true }))).toEqual({ type: 'closeReview' });
    expect(resolveKey({ key: 'Escape' }, ctx({ typing: true }))).toEqual({ kind: 'blurSearch' });
    expect(resolveKey({ key: 'Escape' }, ctx())).toEqual({ kind: 'focusSearch' });
  });

  it('extends a selection with Shift only in select mode', () => {
    expect(action({ key: 'ArrowDown', shiftKey: true }, ctx({ selecting: true }))).toEqual({ type: 'extendSelection', delta: 1 });
    expect(action({ key: 'ArrowDown', shiftKey: true })).toEqual({ type: 'moveCursor', delta: 1 });
    expect(action({ key: 'a', metaKey: true }, ctx({ selecting: true }))).toEqual({ type: 'selectAll' });
  });

  it('starts a search when an unbound letter is typed', () => {
    expect(resolveKey({ key: 'g' }, ctx())).toEqual({ kind: 'focusSearch', text: 'g' });
    expect(resolveKey({ key: 'g', ctrlKey: true }, ctx())).toBeNull();
  });

  it('swallows everything but Escape and ? while help is open', () => {
    expect(resolveKey({ key: 'j' }, ctx({ helpOpen: true }))).toBeNull();
    expect(action({ key: '?' }, ctx({ helpOpen: true }))).toEqual({ type: 'toggleHelp' });
  });
});

/** Display label in KEY_HELP → the key event it stands for. */
const DISPLAY: Record<string, KeyLike> = {
  '↑': { key: 'ArrowUp' },
  '↓': { key: 'ArrowDown' },
  '←': { key: 'ArrowLeft' },
  '→': { key: 'ArrowRight' },
  PgUp: { key: 'PageUp' },
  PgDn: { key: 'PageDown' },
  Home: { key: 'Home' },
  End: { key: 'End' },
  '↵': { key: 'Enter' },
  '⌫': { key: 'Backspace' },
  Space: { key: ' ' },
  '⌘Z': { key: 'z', metaKey: true },
  '⌘D': { key: 'd', metaKey: true },
  Esc: { key: 'Escape' },
};

describe('KEY_HELP', () => {
  const entries = KEY_HELP.flatMap((s) => s.entries.flatMap((e) => e.keys));
  it.each(entries)('%s does something', (label) => {
    const event = DISPLAY[label] ?? { key: label.length === 1 ? label.toLowerCase() : label };
    expect(resolveKey(event, ctx())).not.toBeNull();
  });
});
