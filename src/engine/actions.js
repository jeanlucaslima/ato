import { normalizeUrl, extractDomain } from './queries.js';
import { currentTab, scopedTabs, duplicateTargets, protectionReason } from './policy.js';
import { createUndo } from './undo.js';

function sameIdentity(tab, target) {
  return tab && tab.id === target.id && tab.url === target.url && tab.windowId === target.windowId && !tab.pendingUrl;
}

/** Engine commands run serially in the worker, including undo and activation. */
export function createActions(browser) {
  const undo = createUndo(browser);
  let queue = Promise.resolve();
  const serialize = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };

  async function plan(command, settings = {}) {
    const snapshot = await browser.readSnapshot();
    const scope = command.scope || { type: 'all' };
    const tabs = scopedTabs(snapshot.tabs, scope);
    const currentId = currentTab(snapshot.tabs, snapshot.focusedWindowId)?.id;
    let candidates;
    if (command.type === 'close-duplicates') {
      candidates = duplicateTargets(tabs, settings, snapshot.focusedWindowId);
      if (command.url) candidates = candidates.filter(tab =>
        normalizeUrl(tab.url, settings.matchMode) === normalizeUrl(command.url, settings.matchMode));
    } else if (command.domain) {
      candidates = tabs.filter(tab => extractDomain(tab.url) === command.domain);
    } else {
      const requested = new Map((command.targets || []).map(tab => [tab.id, tab]));
      candidates = tabs.filter(tab => sameIdentity(tab, requested.get(tab.id) || {}));
    }
    const skipped = [];
    const targets = candidates.filter(tab => {
      const reason = command.type === 'move' ? null : protectionReason(tab,
        command.single ? {} : settings, command.single ? null : currentId);
      if (reason) skipped.push({ id: tab.id, reason });
      return !reason;
    });
    return { command: { ...command, scope }, settings: { ...settings }, targets,
      // Group witnesses are limited to identities that existed at planning time.
      witnesses: tabs, skipped };
  }

  async function executePlan(plan) {
    const { command, settings, targets } = plan;
    const result = { succeeded: [], skipped: [...plan.skipped], failed: [], operationId: null };
    const record = { id: crypto.randomUUID(), entries: [] };
    let destination = null;
    const live = await browser.readSnapshot();
    const eligible = new Set(duplicateTargets(scopedTabs(live.tabs, command.scope), settings,
      live.focusedWindowId).map(tab => tab.id));
    for (const target of targets) {
      try {
        const tab = await browser.getTab(target.id);
        if (!sameIdentity(tab, target)) {
          result.skipped.push({ id: target.id, reason: 'changed' });
          continue;
        }
        if (command.type === 'move') {
          if (destination == null) destination = (await browser.createWindow(tab.id)).id;
          else await browser.moveTab(tab.id, destination);
        } else {
          const [active] = await browser.api.tabs.query({ active: true, lastFocusedWindow: true });
          const reason = protectionReason(tab, command.single ? {} : settings,
            command.single ? null : active?.id);
          if (reason) {
            result.skipped.push({ id: tab.id, reason });
            continue;
          }
          if (command.type === 'close-duplicates') {
            if (!eligible.has(tab.id)) {
              result.skipped.push({ id: tab.id, reason: 'survivor' });
              continue;
            }
            const key = normalizeUrl(tab.url, settings.matchMode);
            const witnesses = plan.witnesses.filter(other => other.id !== tab.id &&
              !result.succeeded.includes(other.id) && normalizeUrl(other.url, settings.matchMode) === key);
            let survivor = false;
            for (const witness of witnesses) {
              const other = await browser.getTab(witness.id).catch(() => null);
              if (sameIdentity(other, witness)) { survivor = true; break; }
            }
            if (!survivor) {
              result.skipped.push({ id: tab.id, reason: 'no-survivor' });
              continue;
            }
          }
          const before = await undo.recentlyClosed();
          // Check again after witness/session reads; Chrome provides no atomic compare-and-remove API.
          const latest = await browser.getTab(tab.id);
          const [nowActive] = await browser.api.tabs.query({ active: true, lastFocusedWindow: true });
          const latestReason = protectionReason(latest, command.single ? {} : settings,
            command.single ? null : nowActive?.id);
          if (!sameIdentity(latest, target) || latestReason) {
            result.skipped.push({ id: tab.id, reason: latestReason || 'changed' });
            continue;
          }
          await browser.removeTab(tab.id);
          result.succeeded.push(tab.id);
          record.entries.push(await undo.capture(latest, before));
          try { await undo.save(record); } catch (error) {
            result.failed.push({ id: tab.id, error: `Undo record: ${error.message}` });
          }
          continue;
        }
        result.succeeded.push(tab.id);
      } catch (error) {
        result.failed.push({ id: target.id, error: error.message });
      }
    }
    if (record.entries.length) result.operationId = record.id;
    return result;
  }

  return {
    plan,
    execute: plan => serialize(() => executePlan(plan)),
    run: (command, settings) => serialize(async () => {
      if (command.type === 'undo') return undo.restore(command.operationId);
      if (command.type === 'activate') return browser.activateTab(command.tabId);
      return executePlan(await plan(command, settings));
    })
  };
}
