const BROWSE_MODES = new Set(['browsingTabs', 'browsingDomains']);
const ACTION_STATES = new Set(['closingTabs', 'movingTabs', 'restoringTabs']);

function browseModeForView(view) {
  return view === 'domains' ? 'browsingDomains' : 'browsingTabs';
}

function viewForBrowseMode(mode) {
  return mode === 'browsingDomains' ? 'domains' : 'tabs';
}

function cloneMachine(machine) {
  return {
    ...machine,
    previousReadyMode: machine.previousReadyMode || 'browsingTabs',
    domainFilterOpen: Boolean(machine.domainFilterOpen)
  };
}

function readyMachine(mode, machine) {
  const readyMode = BROWSE_MODES.has(mode) || mode === 'searching' || mode === 'reviewingDuplicates'
    ? mode
    : machine.previousReadyMode;

  return {
    ...machine,
    status: 'ready',
    mode: readyMode,
    action: null,
    previousReadyMode: BROWSE_MODES.has(readyMode) ? readyMode : machine.previousReadyMode
  };
}

export function createInitialPopupMachineState({ defaultBrowseView = 'tabs' } = {}) {
  const initialBrowseMode = browseModeForView(defaultBrowseView);
  return {
    status: 'loading',
    mode: initialBrowseMode,
    action: null,
    previousReadyMode: initialBrowseMode,
    domainFilterOpen: false,
    error: null
  };
}

export function transitionPopupMachine(currentMachine, event) {
  const machine = cloneMachine(currentMachine || createInitialPopupMachineState());

  switch (event.type) {
    case 'SNAPSHOT_LOADED':
      return readyMachine(machine.mode, machine);
    case 'SET_VIEW': {
      const nextMode = browseModeForView(event.view);
      if (machine.status === 'loading') {
        return {
          ...machine,
          mode: nextMode,
          previousReadyMode: nextMode
        };
      }
      return readyMachine(nextMode, {
        ...machine,
        previousReadyMode: nextMode
      });
    }
    case 'SEARCH_CHANGED':
      return event.query?.trim()
        ? readyMachine('searching', machine)
        : readyMachine(machine.previousReadyMode, machine);
    case 'CLEAR_SEARCH':
      return readyMachine(machine.previousReadyMode, machine);
    case 'REVIEW_DUPLICATES':
      return readyMachine('reviewingDuplicates', machine);
    case 'EXIT_DUPLICATES_REVIEW':
      return readyMachine(machine.previousReadyMode, machine);
    case 'BEGIN_CLOSING_TABS':
      return { ...machine, status: 'closingTabs', action: 'closingTabs', error: null };
    case 'BEGIN_MOVING_TABS':
      return { ...machine, status: 'movingTabs', action: 'movingTabs', error: null };
    case 'BEGIN_RESTORING_TABS':
      return { ...machine, status: 'restoringTabs', action: 'restoringTabs', error: null };
    case 'ACTION_DONE':
      return ACTION_STATES.has(machine.status)
        ? readyMachine(machine.previousReadyMode, machine)
        : machine;
    case 'ACTION_FAILED':
      return { ...machine, status: 'error', action: null, error: event.error || 'Unknown popup action error' };
    case 'OPEN_DOMAIN_FILTER':
      return { ...machine, domainFilterOpen: true };
    case 'CLOSE_DOMAIN_FILTER':
      return { ...machine, domainFilterOpen: false };
    default:
      return machine;
  }
}

export function getPopupMode(machine) {
  return machine?.mode || 'browsingTabs';
}

export function getBrowseView(machine) {
  const mode = getPopupMode(machine);
  if (BROWSE_MODES.has(mode)) return viewForBrowseMode(mode);
  return viewForBrowseMode(machine?.previousReadyMode || 'browsingTabs');
}

export function isSearchMode(machine) {
  return getPopupMode(machine) === 'searching';
}

export function isDuplicateReviewMode(machine) {
  return getPopupMode(machine) === 'reviewingDuplicates';
}

export function isDomainFilterOpen(machine) {
  return Boolean(machine?.domainFilterOpen);
}

export function isPopupBusy(machine) {
  return ACTION_STATES.has(machine?.status);
}
