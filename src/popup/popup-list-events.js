function parseTabId(item) {
  const tabId = parseInt(item.dataset.tabId, 10);
  return Number.isFinite(tabId) ? tabId : null;
}

function parseWindowId(item) {
  const windowId = parseInt(item.dataset.windowId, 10);
  return Number.isFinite(windowId) ? windowId : null;
}

export function bindDuplicateGroupListClicks(listEl, { onCloseDuplicates }) {
  listEl.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.tab-close');
    const item = event.target.closest('.tab-item');

    if (closeBtn && item) {
      event.stopPropagation();
      const url = item.dataset.url;
      if (url) onCloseDuplicates(url);
      return;
    }

    if (item) {
      event.preventDefault();
    }
  });
}

export function bindTabListClicks(listEl, { onCloseTab, onSwitchTab }) {
  listEl.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.tab-close');
    const item = event.target.closest('.tab-item');

    if (!item) return;

    const tabId = parseTabId(item);
    if (!tabId) return;

    if (closeBtn) {
      event.stopPropagation();
      onCloseTab(tabId, item.dataset.navId);
      return;
    }

    const windowId = parseWindowId(item);
    if (windowId != null) onSwitchTab(tabId, windowId);
  });
}
