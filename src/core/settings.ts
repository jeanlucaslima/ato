/**
 * User settings: what they are, their defaults, and how stored data is read
 * back. Storage can hold anything (older versions, hand edits, sync from another
 * machine), so every field is checked and falls back to its default.
 */
import type { DuplicatePolicy } from './duplicates';

export interface Settings {
  /** Which copy survives cleanup when no copy is protected. */
  keep: 'oldest' | 'newest';
  protectPinned: boolean;
  protectGroups: boolean;
  /** View the popup opens on. */
  view: 'tabs' | 'sites';
  /** Windows the popup shows when it opens. Search always covers every window. */
  scope: 'all' | 'current';
  theme: 'system' | 'dark' | 'light';
}

export const DEFAULT_SETTINGS: Settings = {
  keep: 'oldest',
  protectPinned: true,
  protectGroups: true,
  view: 'tabs',
  scope: 'all',
  theme: 'dark',
};

export type ChoiceKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
export type ToggleKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** Allowed values of every multiple-choice setting. */
export const CHOICES: { readonly [K in ChoiceKey]: readonly Settings[K][] } = {
  keep: ['oldest', 'newest'],
  view: ['tabs', 'sites'],
  scope: ['all', 'current'],
  theme: ['system', 'dark', 'light'],
};

const TOGGLES: readonly ToggleKey[] = ['protectPinned', 'protectGroups'];

/** Settings from untrusted stored data: valid fields are kept, the rest are defaults. */
export function readSettings(raw: unknown): Settings {
  const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if ((allowed as readonly unknown[]).includes(data[key])) out[key] = data[key];
  }
  for (const key of TOGGLES) {
    if (typeof data[key] === 'boolean') out[key] = data[key];
  }
  return out as unknown as Settings;
}

/** The duplicate cleanup rules these settings ask for. */
export function policyOf(settings: Settings): DuplicatePolicy {
  return { keep: settings.keep, protectPinned: settings.protectPinned, protectGroups: settings.protectGroups };
}
