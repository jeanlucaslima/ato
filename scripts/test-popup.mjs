// Optional real-Chromium DOM/extension regression checks. Requires agent-browser on PATH.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const session = `ato-test-${process.pid}`;
const args = ['--session', session, '--args',
  `--disable-extensions-except=${resolve('dist')},--load-extension=${resolve('dist')}`];
function run(...command) {
  const response = JSON.parse(execFileSync('agent-browser', [...args, ...command, '--json'], { encoding: 'utf8' }));
  assert.equal(response.success, true, response.error);
  return response.data;
}
const evaluate = code => run('eval', code).result;
const wait = code => run('wait', '--fn', code);
function capture(name) {
  if (!process.env.ATO_SCREENSHOT_DIR) return;
  mkdirSync(process.env.ATO_SCREENSHOT_DIR, { recursive: true });
  run('screenshot', resolve(process.env.ATO_SCREENSHOT_DIR, `${name}.png`));
}

try {
  run('open', 'chrome://extensions');
  const id = evaluate(`document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id`);
  run('open', `chrome-extension://${id}/popup/popup.html`);
  run('set', 'viewport', '440', '780', '2');
  wait(`document.querySelector('#total-tabs').textContent !== '—'`);
  const fixture = evaluate(`(async () => {
    await chrome.storage.sync.set({ currentWindowOnly: false, protectPinned: true, keepTab: 'oldest' });
    const url = 'data:text/html,<title>Engine Duplicate</title>Tab Engine fixture';
    const window = await chrome.windows.create({ focused: false, url: [url, url, url, 'data:text/html,<title>Engine Other</title>Other fixture'] });
    const tabs = await chrome.tabs.query({ windowId: window.id });
    await chrome.tabs.update(tabs[0].id, { pinned: true });
    await chrome.tabs.update(tabs[1].id, { active: true });
    return { windowId: window.id, ids: tabs.map(tab => tab.id) };
  })()`);
  // Chrome-created pages become agent-browser's selected target; return to the extension document.
  run('tab', 't1');
  wait(`document.querySelector('#duplicate-count').textContent === '2'`);
  capture('engine-default');

  // Keyboard events deliberately run in one turn, before the render debounce fires.
  const selected = evaluate(`(() => {
    const input = document.querySelector('#global-search-input');
    input.focus(); input.value = 'Engine'; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    return document.querySelector('#search-results-list .highlighted')?.dataset.tabId;
  })()`);
  assert.ok(selected, 'ArrowDown must select a rendered result immediately');
  run('press', 'j');
  const next = evaluate(`document.querySelector('#search-results-list .highlighted')?.dataset.tabId`);
  assert.notEqual(next, selected, 'j must advance within search results');
  run('press', 'k');
  assert.equal(evaluate(`document.querySelector('#search-results-list .highlighted')?.dataset.tabId`), selected);
  capture('engine-search');

  run('press', 'Escape');
  assert.equal(evaluate('document.activeElement.id'), 'global-search-input');
  run('press', 'Escape');
  wait(`!document.body.classList.contains('search-active')`);
  run('click', '#review-duplicates-btn');
  wait(`document.querySelector('#duplicate-list .tab-item') !== null`);
  capture('engine-review');
  run('click', '#close-all-btn');
  wait(`document.querySelector('#duplicate-count').textContent === '0'`);
  const remaining = evaluate(`chrome.tabs.query({ windowId: ${fixture.windowId} }).then(tabs => tabs.map(tab => tab.id))`);
  assert.ok(remaining.includes(fixture.ids[0]), 'pinned duplicate survives');
  assert.ok(!remaining.includes(fixture.ids[1]), 'background-window active tab is not the current tab');
  assert.ok(!remaining.includes(fixture.ids[2]), 'eligible duplicate closes');
  wait(`document.querySelector('#undo-message').textContent.includes('Closed 2')`);
  capture('engine-cleanup');
  run('click', '#undo-duplicates-btn');
  run('tab', 't1');
  wait(`document.querySelector('#undo-message').textContent.includes('restored')`);
  assert.equal(evaluate(`chrome.tabs.query({ windowId: ${fixture.windowId} }).then(tabs => tabs.length)`), 4);

  // A standalone popup document is itself a tab. Focus the fixture window and invoke
  // the worker in the same evaluation to exercise the real currently-focused-tab case.
  const currentCleanup = evaluate(`(async () => {
    const tabs = await chrome.tabs.query({ windowId: ${fixture.windowId} });
    const current = tabs.find(tab => !tab.pinned && tab.title === 'Engine Duplicate');
    await chrome.tabs.update(current.id, { active: true });
    await chrome.windows.update(${fixture.windowId}, { focused: true });
    const response = await chrome.runtime.sendMessage({ action: 'tabEngine', command: { type: 'close-duplicates' } });
    const remaining = await chrome.tabs.query({ windowId: ${fixture.windowId} });
    return { result: response.result, currentId: current.id, remaining: remaining.map(tab => tab.id) };
  })()`);
  assert.equal(currentCleanup.result.succeeded.length, 1);
  assert.ok(currentCleanup.remaining.includes(currentCleanup.currentId), 'real Chrome current duplicate survives');
  run('tab', 't1');

  // Clearing input before the debounce must not resurrect its old query.
  evaluate(`(() => {
    const input = document.querySelector('#global-search-input');
    input.value = 'not-found'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#global-search-clear').click();
  })()`);
  run('wait', '200');
  assert.equal(evaluate(`document.body.classList.contains('search-active')`), false);
  run('fill', '#global-search-input', 'not-found');
  run('press', 'ArrowDown');
  assert.equal(evaluate('document.activeElement.id'), 'global-search-input');
  assert.equal(evaluate(`document.querySelectorAll('.tab-item.highlighted').length`), 0);
  console.log('PASS: real Chrome cleanup, operation undo, keyboard navigation, DOM cursor sync and debounce boundaries');
} catch (error) {
  console.error(run('errors'));
  console.error(evaluate(`(async () => ({ stats: document.querySelector('#stats-summary')?.textContent,
    tabs: await chrome.tabs.query({}).then(tabs => tabs.map(({id, windowId, url, active}) => ({id, windowId, url, active}))) }))()`));
  throw error;
} finally {
  execFileSync('agent-browser', ['--session', session, 'close'], { stdio: 'ignore' });
}
