// Optional real-Chromium DOM/extension regression checks. Requires agent-browser on PATH.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

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

// Inspect the toolbar bubble without imposing a viewport: a fixed-size tab masks autosizing bugs.
async function checkActionPopup() {
  const socket = new WebSocket(run('get', 'cdp-url').cdpUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 5000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params, sessionId }));
  });
  let popupSession;
  try {
    const previous = new Set((await call('Target.getTargets')).targetInfos.map(target => target.targetId));
    evaluate('chrome.action.openPopup()');
    const popup = (await call('Target.getTargets')).targetInfos.find(target => !previous.has(target.targetId) && target.url.endsWith('/popup/popup.html'));
    assert.ok(popup, 'Chrome action must create an actual toolbar popup');
    popupSession = (await call('Target.attachToTarget', { targetId: popup.targetId, flatten: true })).sessionId;
    const measured = await call('Runtime.evaluate', {
      expression: `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        width: innerWidth, height: innerHeight, focus: document.activeElement.id,
        contentWidth: document.documentElement.getBoundingClientRect().width,
        railBottom: document.querySelector('.action-rail').getBoundingClientRect().bottom,
        workingHeight: document.querySelector('.working-surface').clientHeight
      }))))`, awaitPromise: true, returnByValue: true
    }, popupSession);
    const size = measured.result.value;
    if (process.env.ATO_SCREENSHOT_DIR) {
      // Toolbar targets do not support DPR/viewport overrides; capture their native surface.
      const image = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, popupSession);
      mkdirSync(process.env.ATO_SCREENSHOT_DIR, { recursive: true });
      writeFileSync(resolve(process.env.ATO_SCREENSHOT_DIR, 'toolbar-popup.png'), Buffer.from(image.data, 'base64'));
    }
    console.log('Actual toolbar popup:', size);
    assert.equal(size.contentWidth, 420);
    assert.ok(size.width >= size.contentWidth, 'Chrome must not clip the popup horizontally');
    assert.ok(size.height >= 350 && size.height <= 620, 'toolbar popup must not collapse during Chrome autosizing');
    assert.ok(size.railBottom <= size.height, 'action rail must fit the actual popup viewport');
    assert.ok(size.workingHeight >= 100, 'toolbar popup must retain a usable list');
    assert.equal(size.focus, 'global-search-input');
  } finally {
    if (popupSession) await call('Runtime.evaluate', { expression: 'window.close()' }, popupSession);
    socket.close();
    run('tab', 't1');
  }
}

try {
  run('open', 'chrome://extensions');
  const id = evaluate(`document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id`);
  run('open', `chrome-extension://${id}/popup/popup.html`);
  await checkActionPopup();
  run('set', 'viewport', '420', '620', '2');
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

  assert.equal(evaluate('document.activeElement.id'), 'global-search-input', 'popup autofocuses search');
  run('click', '#select-mode-btn');
  capture('select-empty');
  run('click', `#all-tabs-list [data-tab-id="${fixture.ids[1]}"] .tab-main`);
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '1 selected');
  evaluate(`document.querySelector('#all-tabs-list [data-tab-id="${fixture.ids[3]}"] .tab-main').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '3 selected', 'Shift follows displayed order');
  capture('select-multiple');
  run('click', '#close-selection-btn');
  assert.equal(evaluate(`document.querySelector('#close-review').open`), true);
  assert.equal(evaluate('document.activeElement.textContent'), 'Cancel', 'destructive review focuses cancel');
  capture('close-review');
  run('press', 'Escape');
  run('click', '#select-mode-btn');
  assert.equal(evaluate(`document.body.classList.contains('selection-mode')`), false);
  evaluate(`document.querySelector('#all-tabs-list [data-tab-id="${fixture.ids[3]}"] .tab-main').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))`);
  assert.equal(evaluate(`document.querySelector('#selection-count').textContent`), '1 selected', 'modifier click selects without activation');
  run('click', '#select-mode-btn');

  run('click', '[data-view="domains"]');
  run('click', '#domain-sort-buttons [data-sort="recent"]');
  run('reload');
  wait(`document.querySelector('[data-view="domains"]').getAttribute('aria-pressed') === 'true'`);
  assert.equal(evaluate(`document.querySelector('#domain-sort-buttons [data-sort="recent"]').classList.contains('active')`), true);
  assert.equal(evaluate('document.activeElement.id'), 'global-search-input');
  assert.equal(evaluate(`document.body.classList.contains('selection-mode')`), false);
  capture('sites');
  run('click', '[data-view="tabs"]');

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
  run('reload');
  wait(`document.querySelector('#undo-message').textContent.includes('Closed 2')`);
  run('click', '#undo-duplicates-btn');
  run('tab', 't1');
  wait(`document.querySelector('#undo-message').textContent.includes('restored')`);
  assert.equal(evaluate(`chrome.tabs.query({ windowId: ${fixture.windowId} }).then(tabs => tabs.length)`), 4);
  capture('engine-undo');

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
  capture('engine-empty-search');

  const deletionId = evaluate(`chrome.tabs.create({ active: false,
    url: 'data:text/html,<title>Delete Fixture</title>Keyboard target' }).then(tab => tab.id)`);
  run('tab', 't1');
  run('fill', '#global-search-input', 'Delete Fixture');
  run('press', 'ArrowDown');
  wait(`document.querySelector('#search-results-list .highlighted')?.dataset.tabId === '${deletionId}'`);
  run('press', 'Delete');
  wait(`document.querySelector('#search-results-section-count').textContent === '0'`);
  wait(`document.activeElement.id === 'global-search-input'`);
  assert.equal(evaluate(`chrome.tabs.query({}).then(tabs => tabs.some(tab => tab.id === ${deletionId}))`), false);
  const beforeTyping = evaluate('chrome.tabs.query({}).then(tabs => tabs.length)');
  run('press', 'Backspace');
  assert.equal(evaluate('chrome.tabs.query({}).then(tabs => tabs.length)'), beforeTyping, 'Backspace in input must never close a tab');

  run('fill', '#global-search-input', 'Engine Other');
  run('press', 'ArrowDown');
  const activated = evaluate(`new Promise(resolve => {
    const listener = info => { chrome.tabs.onActivated.removeListener(listener); resolve(info.tabId); };
    chrome.tabs.onActivated.addListener(listener);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })`);
  assert.equal(activated, fixture.ids[3], 'Enter must activate the stable selected tab identity');
  run('tab', 't1');
  run('fill', '#global-search-input', 'Engine');
  evaluate(`chrome.storage.sync.set({ matchMode: 'ignoreQuery', currentWindowOnly: true })`);
  wait(`document.querySelector('#scope-label').textContent === 'This window'`);
  assert.equal(evaluate(`document.body.classList.contains('search-active')`), true, 'policy changes preserve search interaction');
  console.log('PASS: real Chrome cleanup, operation undo, keyboard navigation, DOM cursor sync and debounce boundaries');
} catch (error) {
  console.error(run('errors'));
  console.error(evaluate(`(async () => ({ page: location.href, stats: document.querySelector('#stats-summary')?.textContent,
    tabs: globalThis.chrome?.tabs ? await chrome.tabs.query({}).then(tabs => tabs.map(({id, windowId, url, active}) => ({id, windowId, url, active}))) : [] }))()`));
  throw error;
} finally {
  execFileSync('agent-browser', ['--session', session, 'close'], { stdio: 'ignore' });
}
