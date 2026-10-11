import {
  formatTimeAgo,
  extractDomain,
  highlightMatches,
  isLoadableFavicon,
  normalizeUrl,
  sortAudibleFirst
} from '../engine/queries.js';
import { makeTabItemId } from './popup-state.js';

export function createMediaIcon() {
  const span = document.createElement('span');
  span.className = 'tab-media-icon';
  span.title = 'Playing media';
  span.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  `;
  return span;
}

export function createFaviconElement(favIconUrl) {
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.alt = '';

  if (isLoadableFavicon(favIconUrl)) {
    favicon.loading = 'lazy';
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.removeAttribute('src');
      favicon.className = 'tab-favicon placeholder';
    };
    favicon.src = favIconUrl;
  } else {
    favicon.className = 'tab-favicon placeholder';
  }

  return favicon;
}

function addTabStatusClasses(item, tab) {
  if (tab.audible) item.classList.add('is-audible');
  if (tab.active) item.classList.add('is-current');
  if (tab.pinned) item.classList.add('is-pinned');
  if (tab.discarded) item.classList.add('is-discarded');
}

function createHighlightedTextElement(className, text, match) {
  const element = document.createElement('div');
  element.className = className;

  if (match) {
    element.innerHTML = highlightMatches(text, match.indices);
  } else {
    element.textContent = text;
  }

  element.title = text;
  return element;
}

export function createGroupedDuplicateItem(group, index = 0, matchResult = null) {
  const { url, tabs: duplicateTabs, representative, totalCount } = group;

  const item = document.createElement('div');
  item.className = 'tab-item duplicate-group-item';
  if (duplicateTabs.some(t => t.audible)) item.classList.add('is-audible');
  addTabStatusClasses(item, representative);
  item.dataset.url = url;
  item.dataset.tabId = representative.id;
  item.dataset.windowId = representative.windowId;
  item.style.setProperty('--item-index', index);

  const favicon = createFaviconElement(representative.favIconUrl);
  const info = document.createElement('div');
  info.className = 'tab-info';

  const titleText = representative.title || 'Untitled';
  info.appendChild(createHighlightedTextElement('tab-title', titleText, matchResult?.matches?.title));
  info.appendChild(createHighlightedTextElement('tab-url', url, matchResult?.matches?.url));

  const badge = document.createElement('span');
  badge.className = 'duplicate-badge';
  badge.textContent = `×${totalCount}`;
  badge.title = `${totalCount} tabs with this URL`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  const actionableCount = group.actionableCount ?? duplicateTabs.length;
  closeBtn.title = `Close ${actionableCount} eligible duplicate(s) · ${duplicateTabs.length} duplicates total`;
  closeBtn.disabled = actionableCount === 0;

  item.appendChild(favicon);
  item.appendChild(info);

  if (duplicateTabs.some(t => t.audible)) {
    item.appendChild(createMediaIcon());
  }

  item.appendChild(badge);
  item.appendChild(closeBtn);

  return item;
}

export function createTabItem(tab, duplicateCount = 0, index = 0, matchResult = null, navigationId = null, { selected = false, showRecency = false } = {}) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  addTabStatusClasses(item, tab);
  item.dataset.tabId = tab.id;
  item.dataset.windowId = tab.windowId;
  if (navigationId) item.dataset.navId = navigationId;
  item.style.setProperty('--item-index', index);

  const favicon = createFaviconElement(tab.favIconUrl);
  const info = document.createElement('div');
  info.className = 'tab-info';

  const titleText = tab.title || 'Untitled';
  info.appendChild(createHighlightedTextElement('tab-title', titleText, matchResult?.matches?.title));
  const metadata = matchResult?.matches?.url ? tab.url : (extractDomain(tab.url) || tab.url || 'Loading…');
  info.appendChild(createHighlightedTextElement('tab-url', metadata, matchResult?.matches?.url || matchResult?.matches?.domain));

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'row-checkbox';
  checkbox.checked = selected;
  checkbox.setAttribute('aria-label', `Select ${titleText}`);
  item.classList.add(...(selected ? ['bulk-selected'] : []));
  item.appendChild(checkbox);

  const activate = document.createElement('button');
  activate.className = 'tab-main';
  activate.tabIndex = index === 0 ? 0 : -1;
  activate.setAttribute('aria-label', `Activate ${titleText}`);
  activate.title = `${tab.url || 'Loading…'} · Window ${tab.windowId}`;
  activate.appendChild(favicon);
  activate.appendChild(info);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close this tab';
  closeBtn.setAttribute('aria-label', `Close ${titleText}`);

  // One indicator, in priority order: audible, pinned, copies, discarded, native membership, recency.
  if (tab.audible) {
    activate.appendChild(createMediaIcon());
  } else {
    const indicator = document.createElement('span');
    indicator.className = 'tab-indicator';
    if (tab.pinned) indicator.textContent = 'Pinned';
    else if (duplicateCount > 1) { indicator.textContent = `×${duplicateCount}`; indicator.className = 'duplicate-badge'; }
    else if (tab.discarded) indicator.textContent = 'Sleeping';
    else if (tab.groupId != null && tab.groupId !== -1) indicator.textContent = 'Grouped';
    else if (showRecency) indicator.textContent = formatTimeAgo(tab.lastAccessed);
    if (indicator.textContent) activate.appendChild(indicator);
  }

  item.appendChild(activate);
  item.appendChild(closeBtn);

  return item;
}

export function createDomainSection(domain, tabs, urlCounts, {
  isExpanded,
  matchMode,
  onToggleDomain,
  onMoveDomain,
  onCloseDomain,
  selectedIds = new Set()
}) {
  const section = document.createElement('div');
  section.className = 'domain-section';

  const header = document.createElement('button');
  header.className = 'section-header';
  header.setAttribute('data-domain', domain);
  header.setAttribute('aria-expanded', isExpanded);
  header.onclick = () => onToggleDomain(domain);

  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrow.setAttribute('class', 'fold-arrow');
  arrow.setAttribute('width', '12');
  arrow.setAttribute('height', '12');
  arrow.setAttribute('viewBox', '0 0 12 12');
  arrow.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 2l4 4-4 4V2z');
  arrow.appendChild(path);

  const domainName = document.createElement('h2');
  domainName.className = 'section-title';
  domainName.textContent = domain;

  const count = document.createElement('span');
  count.className = 'section-count';
  count.textContent = tabs.length;

  header.appendChild(arrow);
  header.appendChild(domainName);
  header.appendChild(count);

  const content = document.createElement('div');
  content.className = 'section-content';
  content.id = `domain-content-${domain}`;
  if (!isExpanded) content.classList.add('collapsed');

  const contentInner = document.createElement('div');
  contentInner.className = 'section-content-inner';

  const actionBar = document.createElement('div');
  actionBar.className = 'domain-action-bar';

  const moveBtn = document.createElement('button');
  moveBtn.className = 'btn-action btn-accent btn-small';
  moveBtn.dataset.action = 'move-domain';
  moveBtn.dataset.domain = domain;
  moveBtn.title = `Move all tabs from ${domain} to a new window`;
  moveBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      <span>Move to window</span>
    `;
  moveBtn.onclick = (e) => {
    e.stopPropagation();
    onMoveDomain(domain);
  };
  actionBar.appendChild(moveBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-action btn-danger btn-small';
  closeBtn.dataset.action = 'close-domain';
  closeBtn.dataset.domain = domain;
  closeBtn.title = `Close all tabs from ${domain}`;
  closeBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
    <span>Close all</span>
  `;
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    onCloseDomain(domain);
  };

  actionBar.appendChild(closeBtn);

  const tabList = document.createElement('div');
  tabList.className = 'domain-tabs-list';

  sortAudibleFirst(tabs).forEach((tab, index) => {
    const dupCount = urlCounts.get(normalizeUrl(tab.url, matchMode)) || 0;
    const item = createTabItem(tab, dupCount, index, null, makeTabItemId('domain', tab.id, domain), { selected: selectedIds.has(tab.id) });
    tabList.appendChild(item);
  });

  contentInner.appendChild(actionBar);
  contentInner.appendChild(tabList);
  content.appendChild(contentInner);
  section.appendChild(header);
  section.appendChild(content);

  return section;
}

/** Keep unchanged rows and their DOM focus while updating the visible list by stable identity. */
export function reconcileList(list, items) {
  const existing = new Map([...list.children].map(node => [node.dataset.navId || node.dataset.url || node.dataset.domain, node]));
  let position = list.firstElementChild;
  for (const item of items) {
    const key = item.dataset.navId || item.dataset.url || item.dataset.domain;
    const previous = existing.get(key);
    const node = previous?.isEqualNode(item) ? previous : item;
    existing.delete(key);
    if (node === position) position = position.nextElementSibling;
    else list.insertBefore(node, position);
    if (previous && previous !== node) {
      if (previous.contains(document.activeElement)) {
        const selector = document.activeElement.classList.contains('row-checkbox') ? '.row-checkbox' : '.tab-main';
        node.querySelector(selector)?.focus({ preventScroll: true });
      }
      previous.remove();
      if (position === previous) position = node.nextElementSibling;
    }
  }
  for (const node of existing.values()) node.remove();
}
