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
  /** Review: open or fold a duplicate set. */
  | { type: 'toggleSet'; key: string; open?: boolean }
  /** Review: close one set's extra copies (one stays, as planned). */
  | { type: 'closeSet'; key: string }
  /** Review: unload every copy in a set (the current tab stays loaded). */
  | { type: 'unloadSet'; key: string }
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
  /**
   * A close ran: `tabs` were really closed (undo covers exactly these), out of
   * `requested`; `kept` were left open as protected (at the decision or the recheck).
   */
  | { type: 'closed'; tabs: readonly Tab[]; requested: readonly number[]; noun: string; kept: number; at?: number }
  /**
   * A close failed (Chrome refused: a tab being dragged, a window closing). `tabs`
   * of `requested` were gone afterwards anyway (closed before the failure).
   */
  | { type: 'closeFailed'; tabs: readonly Tab[]; requested: readonly number[]; noun: string; at?: number }
  /** Some other browser effect failed; say so. */
  | { type: 'effectFailed'; message: string }
  /** The popup opened soon after a right-click close: offer its undo. */
  | { type: 'offerUndo'; tabs: readonly Tab[]; closedAt: number; message: string }
  | { type: 'undo' }
  | { type: 'restored'; count: number; fresh?: number }
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
  /**
   * Close after the animation. `policy` (bulk closes) has protection checked again
   * on the fresh state; `null` closes what the user picked. `skipped`: protected
   * tabs already left out when deciding, for the message. `cleanup`: duplicate
   * cleanup, which also keeps a copy of every page on the fresh state.
   */
  | { kind: 'close'; tabIds: number[]; noun: string; skipped: number; policy: DuplicatePolicy | null; cleanup: boolean }
  | { kind: 'restore'; tabs: readonly Tab[]; closedAt?: number }
  | { kind: 'activate'; tabId: number }
  | { kind: 'discard'; tabIds: number[] }
  | { kind: 'move'; tabIds: number[] }
  | { kind: 'moveTo'; tabIds: number[]; windowId: number }
  | { kind: 'focusWindow'; windowId: number }
  | { kind: 'expireToast'; id: number }
  | { kind: 'openSettings' }
  | { kind: 'mute'; tabId: number; muted: boolean };
