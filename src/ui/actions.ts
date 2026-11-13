import type { Snapshot, Tab } from '../core/types';
import type { ItemKey } from './model';

/** Everything that can happen to the popup: user intent or browser news. */
export type Action =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'query'; text: string }
  | { type: 'clearQuery' }
  | { type: 'searchFocus'; focused: boolean }
  | { type: 'setView'; view: 'tabs' | 'sites' }
  | { type: 'cycleSort' }
  | { type: 'cycleScope' }
  | { type: 'toggleSite'; domain: string; open?: boolean }
  | { type: 'openReview' }
  | { type: 'closeReview' }
  | { type: 'flip'; tabId: number }
  | { type: 'confirmReview' }
  | { type: 'activate'; tabId: number }
  | { type: 'closeTab'; tabId: number }
  | { type: 'closeSite'; domain: string }
  | { type: 'unloadSite'; domain: string }
  | { type: 'closeResults' }
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
  | { type: 'moveCursor'; delta: 1 | -1 }
  /** Enter / Space / Delete / U / ←→ on whatever the cursor is on. */
  | { type: 'cursorKey'; key: 'enter' | 'space' | 'delete' | 'unload' | 'left' | 'right' }
  | { type: 'openSettings' };

/** Side effects the runtime performs; results come back as actions. */
export type Effect =
  | { kind: 'close'; tabIds: number[]; message: string }
  | { kind: 'restore'; tabs: readonly Tab[] }
  | { kind: 'activate'; tabId: number }
  | { kind: 'discard'; tabIds: number[] }
  | { kind: 'move'; tabIds: number[] }
  | { kind: 'expireToast'; id: number }
  | { kind: 'openSettings' };
