// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { MemorySettings } from '../dev/memory-settings';
import { mountSettings, renderSettings } from './settings-page';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('settings page', () => {
  it('shows the stored choices as checked', () => {
    const page = renderSettings({ settings: { ...DEFAULT_SETTINGS, keep: 'newest', protectGroups: false }, version: '3', saved: false });
    expect(page.querySelector<HTMLInputElement>('input[name="keep"][value="newest"]')!.checked).toBe(true);
    expect(page.querySelector<HTMLInputElement>('input[name="keep"][value="oldest"]')!.checked).toBe(false);
    expect(page.querySelector<HTMLInputElement>('input[name="protectGroups"]')!.checked).toBe(false);
  });

  it('saves each change as it happens', async () => {
    const store = new MemorySettings();
    const container = document.createElement('div');
    const seen: string[] = [];
    await mountSettings(container, store, { version: '3', onChange: (s) => seen.push(s.theme) });

    const light = container.querySelector<HTMLInputElement>('input[name="theme"][value="light"]')!;
    light.checked = true;
    light.dispatchEvent(new Event('change', { bubbles: true }));
    const pinned = container.querySelector<HTMLInputElement>('input[name="protectPinned"]')!;
    pinned.checked = false;
    pinned.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(await store.load()).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', protectPinned: false });
    expect(seen.at(-1)).toBe('light');
    expect(container.querySelector('.saved')!.textContent).toBe('Saved');
  });

  it('follows changes saved elsewhere', async () => {
    const store = new MemorySettings();
    const container = document.createElement('div');
    await mountSettings(container, store, { version: '3' });
    await store.save({ ...DEFAULT_SETTINGS, view: 'sites' });
    expect(container.querySelector<HTMLInputElement>('input[name="view"][value="sites"]')!.checked).toBe(true);
  });
});
