/**
 * Keyboard map. `resolveKey` is the only place keys get meaning; `KEY_HELP`
 * documents the same bindings for the `?` panel (a test keeps them in sync).
 */
import type { Action } from './actions';

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface KeyContext {
  /** Focus is in the search field. */
  typing: boolean;
  hasQuery: boolean;
  selecting: boolean;
  reviewOpen: boolean;
  helpOpen: boolean;
  hasCursor: boolean;
}

export type KeyCommand =
  | { kind: 'action'; action: Action }
  /** Move focus to search, optionally typing `text` into it. */
  | { kind: 'focusSearch'; text?: string }
  /** Leave the search field so single-letter shortcuts work. */
  | { kind: 'blurSearch' };

const act = (action: Action): KeyCommand => ({ kind: 'action', action });

/** Rows moved by PageUp / PageDown. */
export const PAGE = 8;

/** Command for a key press, or `null` to let the browser handle it. */
export function resolveKey(e: KeyLike, ctx: KeyContext): KeyCommand | null {
  const mod = Boolean(e.metaKey || e.ctrlKey);
  const key = e.key;

  if (ctx.helpOpen) {
    return key === 'Escape' || key === '?' ? act({ type: 'toggleHelp' }) : null;
  }

  // Keys that work everywhere, including while typing.
  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const delta = key === 'ArrowDown' ? 1 : -1;
      if (e.shiftKey && ctx.selecting) return act({ type: 'extendSelection', delta });
      if (mod) return act({ type: 'cursorTo', where: delta > 0 ? 'last' : 'first' });
      return act({ type: 'moveCursor', delta });
    }
    case 'PageDown':
      return act({ type: 'moveCursor', delta: PAGE });
    case 'PageUp':
      return act({ type: 'moveCursor', delta: -PAGE });
    case 'Enter':
      return ctx.hasCursor || ctx.reviewOpen ? act({ type: 'cursorKey', key: 'enter' }) : null;
    case 'Escape':
      if (ctx.hasQuery) return act({ type: 'clearQuery' });
      if (ctx.selecting) return act({ type: 'exitSelect' });
      if (ctx.reviewOpen) return act({ type: 'closeReview' });
      return ctx.typing ? { kind: 'blurSearch' } : { kind: 'focusSearch' };
  }
  if (mod && key.toLowerCase() === 'f') return { kind: 'focusSearch' };
  if (mod && key === 'Backspace' && ctx.typing && ctx.hasQuery) return act({ type: 'closeResults' });

  // Everything below is for when focus is not in the search field.
  if (ctx.typing) return null;
  if (mod && key.toLowerCase() === 'z') return act({ type: 'undo' });
  if (mod && key.toLowerCase() === 'a' && ctx.selecting) return act({ type: 'selectAll' });
  if (mod || e.altKey) return null;

  switch (key) {
    case 'Home':
      return act({ type: 'cursorTo', where: 'first' });
    case 'End':
      return act({ type: 'cursorTo', where: 'last' });
    case 'j':
      return act({ type: 'moveCursor', delta: 1 });
    case 'k':
      return act({ type: 'moveCursor', delta: -1 });
    case 'J':
    case 'K':
      return ctx.selecting ? act({ type: 'extendSelection', delta: key === 'J' ? 1 : -1 }) : null;
    case ' ':
      return act({ type: 'cursorKey', key: 'space' });
    case 'ArrowRight':
      return act({ type: 'cursorKey', key: 'right' });
    case 'ArrowLeft':
      return act({ type: 'cursorKey', key: 'left' });
    case 'Backspace':
    case 'Delete':
      return act({ type: 'cursorKey', key: 'delete' });
    case 'u':
      return act({ type: 'cursorKey', key: 'unload' });
    case 'd':
      return act({ type: 'openReview' });
    case 'x':
      return act({ type: 'toggleSelectMode' });
    case 's':
      return act({ type: 'toggleView' });
    case '?':
      return act({ type: 'toggleHelp' });
    case '/':
      return { kind: 'focusSearch' };
  }
  // Any other printable character starts a search with it.
  if (key.length === 1 && key.trim()) return { kind: 'focusSearch', text: key };
  return null;
}

export interface HelpEntry {
  keys: string[];
  label: string;
}

export interface HelpSection {
  title: string;
  entries: HelpEntry[];
}

/** Shown by the `?` panel. Key names here are display labels. */
export const KEY_HELP: HelpSection[] = [
  {
    title: 'Move',
    entries: [
      { keys: ['↑', '↓'], label: 'Previous / next (also j k)' },
      { keys: ['PgUp', 'PgDn'], label: `Jump ${PAGE} rows` },
      { keys: ['Home', 'End'], label: 'First / last (also ⌘↑ ⌘↓)' },
      { keys: ['←', '→'], label: 'Collapse / expand a site' },
    ],
  },
  {
    title: 'Act',
    entries: [
      { keys: ['↵'], label: 'Go to tab · toggle site · confirm review' },
      { keys: ['⌫'], label: 'Close tab, site or selection' },
      { keys: ['U'], label: 'Unload (free memory, keep the tab)' },
      { keys: ['Space'], label: 'Select · flip keep/close in review' },
      { keys: ['⌘Z'], label: 'Undo the last close' },
    ],
  },
  {
    title: 'Views',
    entries: [
      { keys: ['/'], label: 'Search (or just start typing)' },
      { keys: ['S'], label: 'Switch Tabs / Sites' },
      { keys: ['D'], label: 'Review duplicates' },
      { keys: ['X'], label: 'Select mode (⇧↑↓ to extend, ⌘A all)' },
      { keys: ['Esc'], label: 'Clear search · leave mode · back' },
      { keys: ['?'], label: 'This panel' },
    ],
  },
];
