import { describe, expect, it, vi } from 'vitest';
import {
  bindDuplicateGroupListClicks,
  bindTabListClicks
} from './popup-list-events.js';

function createList() {
  let listener = null;
  return {
    addEventListener: vi.fn((eventName, callback) => {
      if (eventName === 'click') listener = callback;
    }),
    click(target) {
      listener({
        target,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn()
      });
    }
  };
}

function createTarget({ item, closeButton = false }) {
  return {
    closest(selector) {
      if (selector === '.tab-close') return closeButton ? this : null;
      if (selector === '.tab-item') return item;
      return null;
    }
  };
}

describe('popup list events', () => {
  it('switches tabs when a tab row is clicked', () => {
    const list = createList();
    const item = { dataset: { tabId: '12', windowId: '34' } };
    const onCloseTab = vi.fn();
    const onSwitchTab = vi.fn();

    bindTabListClicks(list, { onCloseTab, onSwitchTab });
    list.click(createTarget({ item }));

    expect(onSwitchTab).toHaveBeenCalledWith(12, 34);
    expect(onCloseTab).not.toHaveBeenCalled();
  });

  it('closes tabs when a tab close button is clicked', () => {
    const list = createList();
    const item = { dataset: { tabId: '12', windowId: '34', navId: 'tab:tabs:12' } };
    const onCloseTab = vi.fn();
    const onSwitchTab = vi.fn();

    bindTabListClicks(list, { onCloseTab, onSwitchTab });
    list.click(createTarget({ item, closeButton: true }));

    expect(onCloseTab).toHaveBeenCalledWith(12, 'tab:tabs:12');
    expect(onSwitchTab).not.toHaveBeenCalled();
  });

  it('closes duplicate groups by URL', () => {
    const list = createList();
    const item = { dataset: { url: 'https://example.test' } };
    const onCloseDuplicates = vi.fn();

    bindDuplicateGroupListClicks(list, { onCloseDuplicates });
    list.click(createTarget({ item, closeButton: true }));

    expect(onCloseDuplicates).toHaveBeenCalledWith('https://example.test');
  });
});
