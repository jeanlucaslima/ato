/**
 * User settings: what they are, their defaults, and how stored data is read
 * back. Storage can hold anything (older versions, hand edits, sync from another
 * machine), so every field is checked and falls back to its default.
 */
import type { DuplicatePolicy } from './duplicates';
import type { MatchMode } from './tabs';

/** Named colour themes. `system` (a setting, not a theme) follows the OS: Daylight or Graphite. */
export const THEMES = ['graphite', 'daylight', 'paper', 'onyx', 'cyber', 'neon', 'poster', 'riso', 'nebula', 'ember', 'lagoon', 'sakura', 'dune', 'missing-link'] as const;
export type ThemeId = (typeof THEMES)[number];

export const BADGE_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#475569'] as const;
export type BadgeColor = (typeof BADGE_COLORS)[number];

export interface Settings {
  /** Which copy survives cleanup when no copy is protected. */
  keep: 'oldest' | 'newest';
  /** What counts as the same page. */
  match: MatchMode;
  protectPinned: boolean;
  protectGroups: boolean;
  /** View the popup opens on. */
  view: 'tabs' | 'sites' | 'windows';
  /** Windows the popup shows when it opens. Search always covers every window. */
  scope: 'all' | 'current';
  theme: 'system' | ThemeId;
  /** What the number on the toolbar icon counts. */
  badge: 'duplicates' | 'all' | 'off';
  badgeColor: BadgeColor;
}

export const DEFAULT_SETTINGS: Settings = {
  keep: 'oldest',
  match: 'exact',
  protectPinned: true,
  protectGroups: true,
  view: 'tabs',
  scope: 'all',
  theme: 'system',
  badge: 'duplicates',
  badgeColor: '#dc2626',
};

export type ChoiceKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
export type ToggleKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** Allowed values of every multiple-choice setting. */
export const CHOICES: { readonly [K in ChoiceKey]: readonly Settings[K][] } = {
  keep: ['oldest', 'newest'],
  match: ['exact', 'ignoreHash', 'ignoreQuery', 'ignoreBoth'],
  view: ['tabs', 'sites', 'windows'],
  scope: ['all', 'current'],
  theme: ['system', ...THEMES],
  badge: ['duplicates', 'all', 'off'],
  badgeColor: BADGE_COLORS,
};

/** Earlier names still found in storage. */
const THEME_ALIASES: Record<string, ThemeId> = { dark: 'graphite', light: 'paper' };

const TOGGLES: readonly ToggleKey[] = ['protectPinned', 'protectGroups'];

/** Settings from untrusted stored data: valid fields are kept, the rest are defaults. */
export function readSettings(raw: unknown): Settings {
  const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  // Own keys only: a stored "constructor" or "toString" must not reach Object.prototype.
  if (typeof data.theme === 'string' && Object.hasOwn(THEME_ALIASES, data.theme)) out.theme = THEME_ALIASES[data.theme];
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if ((allowed as readonly unknown[]).includes(data[key])) out[key] = data[key];
  }
  for (const key of TOGGLES) {
    if (typeof data[key] === 'boolean') out[key] = data[key];
  }
  return out as unknown as Settings;
}

/** Flat keys ATO 2.x stored in `chrome.storage.sync` (v3 keeps everything under `settings`). */
export const LEGACY_KEYS = ['theme', 'matchMode', 'keepTab', 'protectPinned', 'protectGroups', 'showBadge', 'badgeMode', 'badgeColor', 'currentWindowOnly', 'defaultBrowseView'] as const;

const LEGACY_THEME: Record<string, ThemeId> = { paper: 'paper', ivory: 'paper', graphite: 'graphite', obsidian: 'graphite', dark: 'graphite', light: 'paper' };
const LEGACY_MATCH: Record<string, Settings['match']> = { exact: 'exact', ignoreHash: 'ignoreHash', ignoreQuery: 'ignoreQuery', ignoreQueryAndHash: 'ignoreBoth' };
const LEGACY_VIEW: Record<string, Settings['view']> = { tabs: 'tabs', domains: 'sites' };

export function hasLegacy(raw: Record<string, unknown>): boolean {
  return LEGACY_KEYS.some((k) => raw[k] !== undefined);
}

/**
 * Settings carried over from 2.x's flat keys. Anything 2.x had no equivalent
 * for (fonts, search mode, debug logging) is dropped; unknown values fall back
 * to v3's defaults.
 */
export function fromLegacy(raw: Record<string, unknown>): Settings {
  const pick = <T,>(table: Record<string, T>, value: unknown): T | undefined => (typeof value === 'string' && Object.hasOwn(table, value) ? table[value] : undefined);
  const badge = raw.showBadge === false || raw.badgeMode === 'off' ? 'off' : raw.badgeMode === 'allTabs' ? 'all' : raw.badgeMode === 'duplicates' ? 'duplicates' : undefined;
  return readSettings({
    keep: raw.keepTab,
    match: pick(LEGACY_MATCH, raw.matchMode),
    protectPinned: raw.protectPinned,
    protectGroups: raw.protectGroups,
    theme: pick(LEGACY_THEME, raw.theme),
    badge,
    badgeColor: typeof raw.badgeColor === 'string' ? raw.badgeColor.toLowerCase() : undefined,
    scope: raw.currentWindowOnly === true ? 'current' : raw.currentWindowOnly === false ? 'all' : undefined,
    view: pick(LEGACY_VIEW, raw.defaultBrowseView),
  });
}

/** The duplicate cleanup rules these settings ask for. */
export function policyOf(settings: Settings): DuplicatePolicy {
  return { keep: settings.keep, protectPinned: settings.protectPinned, protectGroups: settings.protectGroups, match: settings.match };
}
