// Real Chromium rendering with deterministic browser snapshots. Mutations are covered separately
// by test-popup.mjs; injected partial/error responses here test presentation, not Chrome failures.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const session = `ato-ui-${process.pid}`;
const args = ['--session', session, '--args', `--disable-extensions-except=${resolve('dist')},--load-extension=${resolve('dist')}`];
function run(...command) {
  const response = JSON.parse(execFileSync('agent-browser', [...args, ...command, '--json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  assert.equal(response.success, true, response.error);
  return response.data;
}
const evaluate = code => {
  const response = JSON.parse(execFileSync('agent-browser', [...args, 'eval', '--stdin', '--json'], {
    input: code, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024
  }));
  assert.equal(response.success, true, response.error);
  return response.data.result;
};
const wait = code => run('wait', '--fn', code);
function capture(name, full = false) {
  if (!process.env.ATO_SCREENSHOT_DIR) return;
  mkdirSync(process.env.ATO_SCREENSHOT_DIR, { recursive: true });
  run('screenshot', ...(full ? ['--full'] : []), resolve(process.env.ATO_SCREENSHOT_DIR, `${name}.png`));
}
const sample = [
  ['Inbox — Product updates', 'https://mail.google.test/inbox', { active: true }],
  ['Inbox — Product updates', 'https://mail.google.test/inbox', { pinned: true }],
  ['Inbox — Product updates', 'https://mail.google.test/inbox'],
  ['Pull requests · ATO', 'https://github.test/ato/pulls'],
  ['Pull requests · ATO', 'https://github.test/ato/pulls'],
  ['Design principles — a considered interface', 'https://design.test/principles'],
  ['Music for focused work', 'https://music.test/listen', { audible: true }],
  ['Weekly notes', 'https://docs.test/notes', { discarded: true }],
  ['Research: an exceptionally long title that must truncate without covering controls', 'https://research.test/article']
].map(([title, url, extra], index) => ({ id: 10000 + index, windowId: 77, index, title, url, groupId: -1, ...extra }));

async function snapshot(tabs) {
  evaluate(`window.__uiTabs = ${JSON.stringify(tabs)}; document.querySelector('#working-surface').scrollTop = 0;`);
  // Switching to current-window scope invokes the real popup's snapshot refresh path.
  if (evaluate(`document.querySelector('#scope-label').textContent`) === 'This window') run('click', '#scope-btn');
  run('click', '#scope-btn');
  wait(`document.querySelector('#total-tabs').textContent === '${tabs.length}'`);
  evaluate(`document.querySelector('#working-surface').scrollTop = 0`);
}

try {
  run('open', 'chrome://extensions');
  const id = evaluate(`document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id`);
  const popupUrl = `chrome-extension://${id}/popup/popup.html`;
  run('open', popupUrl);
  run('set', 'viewport', '420', '620', '2');
  wait(`document.querySelector('#total-tabs').textContent !== '—'`);
  evaluate(`(async () => {
    await chrome.storage.sync.set({ theme: 'paper', fontFamily: 'system', currentWindowOnly: false });
    window.__originalMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.windows.getAll = async () => [{ id: 77, focused: true, tabs: window.__uiTabs || [] }];
    chrome.windows.getLastFocused = async () => ({ id: 77 });
  })()`);
  await snapshot(sample);
  wait(`document.querySelector('#all-tabs-list .tab-item') !== null`);
  assert.equal(evaluate(`document.querySelector('#review-duplicates-btn').disabled`), false);
  assert.equal(evaluate(`document.querySelector('#all-tabs-list .tab-item').getBoundingClientRect().height`), 64);
  assert.equal(evaluate(`document.querySelector('.search-input-wrapper').getBoundingClientRect().height`), 46);
  capture('light-default');
  run('click', '#duplicates-header');
  assert.equal(evaluate(`document.querySelector('#duplicates-header').getAttribute('aria-expanded')`), 'true');
  capture('duplicates-expanded');
  run('click', '#duplicates-header');
  evaluate(`chrome.storage.sync.set({ theme: 'graphite' })`);
  wait(`document.documentElement.dataset.theme === 'graphite'`);
  capture('dark-default');
  run('click', '#review-duplicates-btn');
  assert.ok(evaluate(`document.querySelector('#review-context').textContent`).includes('2 protected'));
  run('click', '#duplicate-list .duplicate-inspect');
  assert.ok(evaluate(`document.querySelector('.duplicate-copies').textContent`).includes('Protected: current'));
  capture('duplicate-inspection');
  run('click', '#exit-duplicates-review-btn');
  run('click', '[data-view="domains"]');
  assert.equal(evaluate(`document.querySelectorAll('#domain-sections-container .domain-section').length`), 6, 'Sites includes single-tab sites');
  capture('sites');
  run('fill', '#global-search-input', 'title:Inbox');
  wait(`document.querySelectorAll('#search-results-list .tab-item').length === 3`);
  assert.equal(evaluate(`document.querySelector('#search-mode-chip-label').textContent`), 'title');
  assert.ok(evaluate(`document.querySelector('.duplicates-container').getBoundingClientRect().height > 0`));
  capture('search-matches');
  run('press', 'ArrowDown');
  assert.equal(evaluate(`document.activeElement.closest('.tab-item').dataset.tabId`), '10000');
  capture('keyboard-result');
  run('press', 'Escape');
  run('press', 'Escape');
  assert.equal(evaluate(`document.querySelector('[data-view="domains"]').getAttribute('aria-pressed')`), 'true');
  run('fill', '#global-search-input', 'nothing matches this');
  wait(`document.querySelector('#search-results-section-count').textContent === '0'`);
  capture('search-empty');
  run('press', 'Backspace');
  run('press', 'Escape');
  run('click', '[data-view="tabs"]');
  run('click', '#select-mode-btn');
  assert.equal(evaluate(`document.querySelector('#close-selection-btn').disabled`), true);
  assert.ok(evaluate(`document.querySelector('#all-tabs-list .tab-main').getAttribute('aria-label')`).startsWith('Select '));
  run('click', '#all-tabs-list .row-checkbox');
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '1 selected');
  evaluate(`document.querySelector('#all-tabs-list .row-checkbox').focus()`);
  run('press', 'Space');
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '0 selected', 'native checkbox keyboard selection works');
  capture('select-empty');
  evaluate(`document.querySelector('#all-tabs-list [data-tab-id="10003"]').scrollIntoView({ block: 'center' })`);
  run('click', '#all-tabs-list [data-tab-id="10003"] .tab-main');
  evaluate(`document.querySelector('#all-tabs-list [data-tab-id="10005"] .tab-main').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '3 selected');
  capture('select-multiple');
  await snapshot(sample.filter(tab => tab.id !== 10004));
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '0 selected', 'scope changes clear selection');
  run('click', '#select-mode-btn');

  await snapshot(sample.slice(0, 3).map(tab => ({ ...tab, pinned: true })));
  run('click', '#review-duplicates-btn');
  assert.equal(evaluate(`document.querySelector('#close-all-btn').disabled`), true);
  capture('duplicates-protected');
  run('click', '#exit-duplicates-review-btn');
  await snapshot(sample);
  run('click', '#review-duplicates-btn');
  evaluate(`chrome.runtime.sendMessage = async message => message.command?.type === 'close-duplicates'
    ? new Promise(resolve => { window.__finishCleanup = resolve })
    : window.__originalMessage(message)`);
  run('click', '#close-all-btn');
  wait(`document.querySelector('#undo-message').textContent === 'Closing tabs…'`);
  assert.equal(evaluate(`document.querySelector('#close-all-btn').disabled`), true);
  assert.equal(evaluate(`document.querySelector('#undo-duplicates-btn').disabled`), true);
  capture('cleanup-pending');
  evaluate(`window.__finishCleanup({ result: { succeeded: [10002], skipped: [{ id: 10004, reason: 'changed' }], failed: [{ id: 10005, error: 'fixture failure' }], operationId: 'ui-fixture' } })`);
  wait(`document.querySelector('#undo-message').textContent.includes('1 closed · 1 skipped · 1 failed')`);
  assert.equal(evaluate(`document.querySelector('#undo-duplicates-btn').disabled`), false);
  capture('partial-cleanup');
  evaluate(`chrome.runtime.sendMessage = async () => ({ error: 'Fixture browser operation unavailable' })`);
  run('click', '#close-all-btn');
  wait(`document.querySelector('#undo-message').textContent.includes('Action failed')`);
  capture('cleanup-failed');
  evaluate(`chrome.runtime.sendMessage = async message => message.command?.type === 'undo'
    ? { result: { restored: [10002], recreated: [10004], failed: [{ id: 10005 }] } } : window.__originalMessage(message)`);
  run('click', '#undo-duplicates-btn');
  wait(`document.querySelector('#undo-message').textContent === '1 restored · 1 reopened by URL · 1 failed'`);
  assert.equal(evaluate(`document.querySelector('#undo-duplicates-btn').disabled`), false, 'partial undo remains retryable');
  capture('undo-partial');
  evaluate(`chrome.runtime.sendMessage = window.__originalMessage`);
  run('click', '#exit-duplicates-review-btn');
  await snapshot(sample.filter((tab, index) => ![1, 2, 4].includes(index)));
  assert.equal(evaluate(`document.querySelector('#review-duplicates-btn').disabled`), true);
  capture('no-duplicates');
  await snapshot([]);
  capture('no-tabs');

  const timings = [];
  for (const count of [5, 50, 500, 1200]) {
    const tabs = Array.from({ length: count }, (_, index) => ({ id: 20000 + index, windowId: 77, index,
      title: `Research note ${index + 1}`, url: `https://site${index % 20}.test/note/${index}`, groupId: -1 }));
    const start = Date.now();
    await snapshot(tabs);
    wait(`document.querySelectorAll('#all-tabs-list .tab-item').length === ${count}`);
    const renderMs = evaluate(`(() => { const start = performance.now(); document.querySelector('#sort-buttons [data-sort="title"]').click(); return Math.round(performance.now() - start); })()`);
    assert.equal(evaluate(`document.querySelectorAll('#all-tabs-list .tab-item').length`), count);
    timings.push({ count, sortRenderMs: renderMs, automationRefreshMs: Date.now() - start });
    run('fill', '#global-search-input', 'title:Research note');
    wait(`document.querySelectorAll('#search-results-list .tab-item').length === ${count}`);
    run('press', 'ArrowDown');
    assert.ok(evaluate(`document.activeElement.closest('.tab-item')?.dataset.tabId`));
    run('press', 'Escape'); run('press', 'Escape');
  }
  capture('large-collection');
  run('set', 'viewport', '420', '440', '2');
  assert.ok(evaluate(`document.querySelector('.action-rail').getBoundingClientRect().bottom <= 440`));
  assert.ok(evaluate(`document.querySelector('#working-surface').clientHeight > 80`));
  capture('constrained-height');
  run('press', '/');
  assert.equal(evaluate(`document.activeElement.id`), 'global-search-input');
  run('press', 'Control+f');
  assert.equal(evaluate(`document.activeElement.id`), 'global-search-input');
  run('set', 'viewport', '420', '620', '2');
  run('click', '#scope-btn');
  evaluate(`window.__readSnapshot = chrome.windows.getAll; chrome.windows.getAll = async () => { throw new Error('Fixture snapshot unavailable') }`);
  run('click', '#scope-btn');
  wait(`document.querySelector('#duplicates-summary-primary').textContent === 'Unable to check tabs'`);
  assert.equal(evaluate(`document.querySelector('#review-duplicates-btn').disabled`), true);
  assert.equal(evaluate(`document.querySelector('#duplicates-summary-secondary').textContent`), 'Browser data unavailable');
  assert.equal(evaluate(`getComputedStyle(document.querySelector('#search-results-container')).display`), 'none', 'stale results are withheld');
  capture('browser-error');
  evaluate(`chrome.windows.getAll = window.__readSnapshot`);
  await snapshot(sample);
  wait(`!document.body.classList.contains('browser-unavailable')`);
  console.log('Synthetic UI render timings:', JSON.stringify(timings));

  run('open', `chrome-extension://${id}/options/options.html`);
  run('set', 'viewport', '960', '900', '2');
  wait(`document.querySelector('#version').textContent !== '1.0.0'`);
  run('select', '#theme', 'paper');
  wait(`document.documentElement.dataset.theme === 'paper'`);
  assert.equal(evaluate(`chrome.storage.sync.get('theme').then(value => value.theme)`), 'paper');
  assert.equal(evaluate(`document.querySelector('.header-icon').getAttribute('src')`), '../assets/icons/ato-logo.svg');
  wait(`!document.querySelector('#saveStatus').classList.contains('visible')`);
  capture('settings-light', true);
  run('select', '#theme', 'graphite');
  wait(`!document.querySelector('#saveStatus').classList.contains('visible')`);
  capture('settings-dark', true);
  run('set', 'viewport', '420', '720', '2');
  assert.ok(evaluate(`document.documentElement.scrollWidth <= 420`));
  capture('settings-narrow', true);
  assert.deepEqual(run('errors').errors || [], []);
  console.log('PASS: Chromium UI states, restored browsing, selection, review, themes, 5–1200-tab fixtures and Settings');
} finally {
  execFileSync('agent-browser', ['--session', session, 'close'], { stdio: 'ignore' });
}
