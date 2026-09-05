import { describe, expect, it } from 'vitest';
import {
  createInitialPopupMachineState,
  getBrowseView,
  getPopupMode,
  isDuplicateReviewMode,
  isDomainFilterOpen,
  isPopupBusy,
  isSearchMode,
  transitionPopupMachine
} from './popup-machine.js';
import {
  createInitialPopupState,
  reducePopupState
} from './popup-state.js';

describe('popup machine', () => {
  it('starts loading in the configured browse mode and becomes ready after snapshot load', () => {
    let machine = createInitialPopupMachineState({ defaultBrowseView: 'domains' });

    expect(machine.status).toBe('loading');
    expect(getPopupMode(machine)).toBe('browsingDomains');
    expect(getBrowseView(machine)).toBe('domains');

    machine = transitionPopupMachine(machine, { type: 'SNAPSHOT_LOADED' });

    expect(machine.status).toBe('ready');
    expect(getPopupMode(machine)).toBe('browsingDomains');
  });

  it('can change the default browse view without leaving loading state', () => {
    let machine = createInitialPopupMachineState();

    machine = transitionPopupMachine(machine, { type: 'SET_VIEW', view: 'domains' });

    expect(machine.status).toBe('loading');
    expect(getPopupMode(machine)).toBe('browsingDomains');
  });

  it('remembers the last browse view while entering and clearing search', () => {
    let machine = createInitialPopupMachineState();
    machine = transitionPopupMachine(machine, { type: 'SNAPSHOT_LOADED' });
    machine = transitionPopupMachine(machine, { type: 'SET_VIEW', view: 'domains' });
    machine = transitionPopupMachine(machine, { type: 'SEARCH_CHANGED', query: 'github' });

    expect(isSearchMode(machine)).toBe(true);
    expect(getBrowseView(machine)).toBe('domains');

    machine = transitionPopupMachine(machine, { type: 'CLEAR_SEARCH' });

    expect(isSearchMode(machine)).toBe(false);
    expect(getPopupMode(machine)).toBe('browsingDomains');
  });

  it('enters and exits duplicate review without losing the previous browse view', () => {
    let machine = createInitialPopupMachineState({ defaultBrowseView: 'domains' });
    machine = transitionPopupMachine(machine, { type: 'SNAPSHOT_LOADED' });
    machine = transitionPopupMachine(machine, { type: 'REVIEW_DUPLICATES' });

    expect(isDuplicateReviewMode(machine)).toBe(true);

    machine = transitionPopupMachine(machine, { type: 'EXIT_DUPLICATES_REVIEW' });

    expect(isDuplicateReviewMode(machine)).toBe(false);
    expect(getPopupMode(machine)).toBe('browsingDomains');
  });

  it('tracks transient action states separately from ready modes', () => {
    let machine = createInitialPopupMachineState();
    machine = transitionPopupMachine(machine, { type: 'SNAPSHOT_LOADED' });
    machine = transitionPopupMachine(machine, { type: 'BEGIN_CLOSING_TABS' });

    expect(isPopupBusy(machine)).toBe(true);
    expect(machine.status).toBe('closingTabs');

    machine = transitionPopupMachine(machine, { type: 'ACTION_DONE' });

    expect(isPopupBusy(machine)).toBe(false);
    expect(machine.status).toBe('ready');
    expect(getPopupMode(machine)).toBe('browsingTabs');
  });

  it('tracks domain filter disclosure state', () => {
    let machine = createInitialPopupMachineState();
    machine = transitionPopupMachine(machine, { type: 'OPEN_DOMAIN_FILTER' });
    expect(isDomainFilterOpen(machine)).toBe(true);

    machine = transitionPopupMachine(machine, { type: 'CLOSE_DOMAIN_FILTER' });
    expect(isDomainFilterOpen(machine)).toBe(false);
  });
});

describe('popup reducer machine integration', () => {
  it('keeps legacy view and duplicate review fields in sync with machine mode', () => {
    let state = createInitialPopupState({ defaultBrowseView: 'tabs' });
    state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs: [], focusedWindowId: 1 });
    state = reducePopupState(state, { type: 'SET_VIEW', view: 'domains' });

    expect(state.view.type).toBe('domains');
    expect(getPopupMode(state.ui.machine)).toBe('browsingDomains');

    state = reducePopupState(state, { type: 'SET_DUPLICATE_REVIEW', open: true });

    expect(state.duplicateReviewOpen).toBe(true);
    expect(isDuplicateReviewMode(state.ui.machine)).toBe(true);

    state = reducePopupState(state, { type: 'SET_DUPLICATE_REVIEW', open: false });

    expect(state.duplicateReviewOpen).toBe(false);
    expect(state.view.type).toBe('domains');
  });

  it('keeps search mode in the machine while preserving search query behavior', () => {
    let state = createInitialPopupState({ defaultBrowseView: 'domains' });
    state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs: [], focusedWindowId: 1 });
    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'docs' });

    expect(state.search.query).toBe('docs');
    expect(isSearchMode(state.ui.machine)).toBe(true);

    state = reducePopupState(state, { type: 'CLEAR_SEARCH', defaultMode: 'contains' });

    expect(state.search.query).toBe('');
    expect(isSearchMode(state.ui.machine)).toBe(false);
    expect(state.view.type).toBe('domains');
  });
});
