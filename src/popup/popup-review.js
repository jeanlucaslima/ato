import { currentTab, protectionReason } from '../engine/policy.js';
import { getTabs } from './popup-state.js';

/** Present a bounded, cancellable review; execution and live validation remain in the engine. */
export function bindCloseReview(dialog, { getState, onConfirm }) {
  let pending = null;
  let returnFocus = null;
  dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { pending = null; returnFocus?.focus(); });
  dialog.querySelector('[data-confirm]').addEventListener('click', () => {
    const review = pending;
    dialog.close();
    if (review) onConfirm(review.command, review.context);
  });
  return (command, context, tabs) => {
    const state = getState();
    const currentId = currentTab(getTabs(state), state.browser.focusedWindowId)?.id;
    const eligible = tabs.filter(tab => !protectionReason(tab, state, currentId)).length;
    pending = { command: { ...command, scope: { ...state.scope }, targets: tabs.map(tab => ({ ...tab })) }, context };
    returnFocus = document.activeElement;
    dialog.querySelector('[data-summary]').textContent = `${tabs.length} tabs requested · up to ${eligible} can close · ${tabs.length - eligible} protected. ${new Set(tabs.map(tab => tab.windowId)).size} window(s) affected.`;
    dialog.querySelector('[data-confirm]').disabled = eligible === 0;
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
  };
}
