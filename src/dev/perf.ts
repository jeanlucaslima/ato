/**
 * Timing harness for the pure paths at 500–5,000 tabs: planner, derive per view,
 * the update steps that run on every keystroke / pointer move, the badge, and
 * (where a DOM exists) render + morph. Runs in Node (`npm run perf`) and in
 * Chrome through the dev server: `(await import('/dev/perf.ts')).runPerf()`.
 */
import { badgeFor } from '../core/badge';
import { DEFAULT_POLICY, planDuplicates } from '../core/duplicates';
import { DEFAULT_SETTINGS } from '../core/settings';
import type { GroupColor, Snapshot, Tab, TabGroup } from '../core/types';
import type { Action } from '../ui/actions';
import { deriveModel } from '../ui/derive';
import { initialUi, type AppState, type UiState } from '../ui/state';
import { navOrder, update } from '../ui/update';

/** Deterministic PRNG so every run sees the same browser. */
function rng(seed: number): () => number {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const COLORS: GroupColor[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

/** `n` tabs: ~40 per window, 80 sites (a few big), ~25% extra copies, groups, pins, audio. */
export function makeSnapshot(n: number, seed = 1): Snapshot {
  const r = rng(seed);
  const now = Date.UTC(2026, 10, 19);
  const windows = Math.max(3, Math.round(n / 40));
  const sites = Array.from({ length: 80 }, (_, i) => `site${i}.example${i % 7 === 0 ? '.co.uk' : '.com'}`);
  const site = () => sites[Math.floor(sites.length * r() ** 2.2)]!;
  const urls: string[] = [];
  const tabs: Tab[] = [];
  const groups: TabGroup[] = [];
  const perWindow = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const windowId = 1 + Math.floor(r() * windows);
    const index = perWindow.get(windowId) ?? 0;
    perWindow.set(windowId, index + 1);
    const url = urls.length > 0 && r() < 0.25 ? urls[Math.floor(r() * urls.length)]! : `https://${site()}/p/${i}?q=${Math.floor(r() * 1e6)}`;
    urls.push(url);
    tabs.push({
      id: 1000 + i,
      windowId,
      index,
      title: `Page ${i} about ${url.slice(8, 30)} and other things`,
      url,
      favIconUrl: undefined,
      active: index === 0,
      pinned: index < 2 && r() < 0.3,
      audible: r() < 0.004,
      muted: false,
      discarded: r() < 0.3,
      groupId: -1,
      lastAccessed: now - Math.floor(r() * 30 * 864e5),
    });
  }
  // Contiguous groups: in each window, a run of ~6 tabs every ~15.
  let gid = 1;
  for (const [windowId] of perWindow) {
    const strip = tabs.filter((t) => t.windowId === windowId);
    for (let start = 3; start + 6 < strip.length; start += 15) {
      const id = gid++;
      groups.push({ id, windowId, title: r() < 0.2 ? '' : `Group ${id}`, color: COLORS[id % COLORS.length]!, collapsed: r() < 0.3 });
      for (const t of strip.slice(start, start + 6)) t.groupId = id;
    }
  }
  return { tabs, groups, focusedWindowId: 1, now };
}

export interface PerfRow {
  n: number;
  name: string;
  /** Median ms over the runs. */
  ms: number;
  budget: number;
}

function time(fn: () => unknown, runs: number): number {
  fn(); // warm up
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

/** Interactions: one frame. One-off actions: a beat. */
const FRAME = 16;
const BEAT = 50;

export interface PerfOptions {
  sizes?: number[];
  runs?: number;
  /** Render + morph (needs a DOM). */
  render?: (state: AppState) => () => void;
}

export function runPerf({ sizes = [500, 1000, 2000, 5000], runs = 15, render }: PerfOptions = {}): PerfRow[] {
  const out: PerfRow[] = [];
  for (const n of sizes) {
    const snapshot = makeSnapshot(n);
    const at = (ui: Partial<UiState>): AppState => ({ snapshot, ui: initialUi({ searchFocused: false, ...ui }) });
    const step = (state: AppState, action: Action) => () => update(state, action);
    const firstTab = `tab:${snapshot.tabs[0]!.id}` as const;
    const bigSite = snapshot.tabs[0]!.url.split('/')[2]!;
    const allWindows = new Set(snapshot.tabs.map((t) => t.windowId));
    const add = (name: string, budget: number, fn: () => unknown) => out.push({ n, name, ms: time(fn, runs), budget });

    add('planDuplicates', FRAME, () => planDuplicates(snapshot.tabs, DEFAULT_POLICY));
    add('badgeFor (worker)', FRAME, () => badgeFor(snapshot.tabs, DEFAULT_SETTINGS));
    add('derive · tabs', FRAME, () => deriveModel(at({})));
    add('derive · sites (all open)', FRAME, () => deriveModel(at({ view: 'sites', expanded: new Set(snapshot.tabs.map((t) => t.url.split('/')[2]!)) })));
    add('derive · windows (all open)', FRAME, () => deriveModel(at({ view: 'windows', openWindows: allWindows })));
    add('derive · review', FRAME, () => deriveModel(at({ reviewOpen: true })));
    add('derive · search "page 1"', FRAME, () => deriveModel(at({ query: 'page 1' })));
    add('derive · search dupe:', FRAME, () => deriveModel(at({ query: 'dupe:' })));
    add('navOrder · sites (all open)', FRAME, () => navOrder(deriveModel(at({ view: 'sites', expanded: new Set(snapshot.tabs.map((t) => t.url.split('/')[2]!)) }))));
    add('update · type a key', FRAME, step(at({ query: 'page' }), { type: 'query', text: 'page 1' }));
    add('update · ↓ cursor', FRAME, step(at({ cursor: firstTab }), { type: 'moveCursor', delta: 1 }));
    add('update · pointer over row', FRAME, step(at({}), { type: 'setCursor', key: firstTab }));
    add('update · new snapshot', FRAME, step(at({ cursor: firstTab }), { type: 'snapshot', snapshot }));
    add('update · open a site', FRAME, step(at({ view: 'sites' }), { type: 'toggleSite', domain: bigSite }));
    add('update · open a window', FRAME, step(at({ view: 'windows' }), { type: 'toggleWindow', windowId: 1 }));
    add('update · close all duplicates', BEAT, step(at({}), { type: 'closeDuplicates' }));
    add('update · confirm review', BEAT, step(at({ reviewOpen: true }), { type: 'confirmReview' }));
    if (render) {
      add('render+morph · tabs', BEAT, render(at({})));
      add('render+morph · windows (all open)', BEAT, render(at({ view: 'windows', openWindows: allWindows })));
      add('render+morph · review', BEAT, render(at({ reviewOpen: true })));
    }
  }
  return out;
}

/** Plain-text table, slow rows flagged. */
export function formatPerf(rows: readonly PerfRow[]): string {
  const sizes = [...new Set(rows.map((r) => r.n))];
  const names = [...new Set(rows.map((r) => r.name))];
  const cell = (r?: PerfRow) => (r ? `${r.ms.toFixed(r.ms < 10 ? 2 : 1)}${r.ms > r.budget ? ' !' : ''}` : '').padStart(10);
  const head = 'ms (median)'.padEnd(34) + sizes.map((n) => `${n} tabs`.padStart(10)).join('') + '   budget';
  const body = names.map((name) => name.padEnd(34) + sizes.map((n) => cell(rows.find((r) => r.n === n && r.name === name))).join('') + `   ${rows.find((r) => r.name === name)!.budget}`);
  return [head, ...body, '', '! = over budget'].join('\n');
}
