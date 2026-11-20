import type { DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { ItemKey } from './model';

/** Everything that can happen to the popup: user intent or browser news. */
export type Action =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'query'; text: string }
  | { type: 'clearQuery' }
  /** Remove the url:/title: chip, keeping the typed text. */
  | { type: 'clearField' }
  | { type: 'searchFocus'; focused: boolean }
  | { type: 'setView'; view: 'tabs' | 'sites' | 'windows' }
  | { type: 'cycleSort' }
  | { type: 'cycleScope' }
  | { type: 'toggleSite'; domain: string; open?: boolean }
  | { type: 'openReview' }
  | { type: 'closeReview' }
  | { type: 'flip'; tabId: number }
  /** Review: open or close a big set's fold of Close copies. */
  | { type: 'toggleFold'; key: string; open?: boolean }
  | { type: 'confirmReview' }
  /** Close every duplicate the planner would, without opening review. */
  | { type: 'closeDuplicates' }
  | { type: 'activate'; tabId: number }
  | { type: 'closeTab'; tabId: number }
  | { type: 'closeSite'; domain: string }
  | { type: 'unloadSite'; domain: string }
  /** Windows view: open or close a window's tab list. */
  | { type: 'toggleWindow'; windowId: number; open?: boolean }
  | { type: 'focusWindow'; windowId: number }
  /** Move a window's tabs into the current window. */
  | { type: 'mergeWindow'; windowId: number }
  | { type: 'closeWindow'; windowId: number }
  | { type: 'unloadWindow'; windowId: number }
  /** Gather a site's tabs (or the search results) into a new window. */
  | { type: 'moveSite'; domain: string }
  | { type: 'moveResults' }
  | { type: 'closeResults' }
  | { type: 'showAllResults' }
  | { type: 'unloadResults' }
  | { type: 'closed'; tabs: readonly Tab[]; message: string }
  | { type: 'undo' }
  | { type: 'restored'; count: number }
  | { type: 'dismissToast'; id: number }
  | { type: 'toggleSelectMode' }
  | { type: 'exitSelect' }
  | { type: 'toggleSelected'; tabId: number; range?: boolean }
  | { type: 'closeSelected' }
  | { type: 'unloadSelected' }
  | { type: 'moveSelected' }
  | { type: 'setCursor'; key: ItemKey }
  | { type: 'moveCursor'; delta: number }
  | { type: 'cursorTo'; where: 'first' | 'last' }
  /** Select mode: move the cursor and add the row it lands on (Shift+↑↓). */
  | { type: 'extendSelection'; delta: 1 | -1 }
  | { type: 'selectAll' }
  | { type: 'toggleView' }
  | { type: 'toggleHelp' }
  /** Enter / Space / Delete / U / ←→ on whatever the cursor is on. */
  | { type: 'cursorKey'; key: 'enter' | 'space' | 'delete' | 'unload' | 'move' | 'left' | 'right' }
  | { type: 'openSettings' }
  | { type: 'toggleMute'; tabId: number }
  /** Cleanup settings changed while the popup is open (options page, another machine). */
  | { type: 'policy'; policy: DuplicatePolicy };

/** Side effects the runtime performs; results come back as actions. */
export type Effect =
  | { kind: 'close'; tabIds: number[]; message: string }
  | { kind: 'restore'; tabs: readonly Tab[] }
  | { kind: 'activate'; tabId: number }
  | { kind: 'discard'; tabIds: number[] }
  | { kind: 'move'; tabIds: number[] }
  | { kind: 'moveTo'; tabIds: number[]; windowId: number }
  | { kind: 'focusWindow'; windowId: number }
  | { kind: 'expireToast'; id: number }
  | { kind: 'openSettings' }
  | { kind: 'mute'; tabId: number; muted: boolean };
