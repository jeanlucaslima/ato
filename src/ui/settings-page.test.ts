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

    const light = container.querySelector<HTMLInputElement>('input[name="theme"][value="nebula"]')!;
    light.checked = true;
    light.dispatchEvent(new Event('change', { bubbles: true }));
    const pinned = container.querySelector<HTMLInputElement>('input[name="protectPinned"]')!;
    pinned.checked = false;
    pinned.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(await store.load()).toEqual({ ...DEFAULT_SETTINGS, theme: 'nebula', protectPinned: false });
    expect(seen.at(-1)).toBe('nebula');
    expect(container.querySelector('.saved')!.textContent).toBe('Saved');
  });

  it('shows what the chosen match rule does to an example pair of URLs', async () => {
    const container = document.createElement('div');
    await mountSettings(container, new MemorySettings(), { version: '3' });
    const example = () => container.querySelector('.match-example')!;
    expect(example().querySelector('.match-ignored')).toBeNull();
    expect(example().querySelector('.match-verdict')!.textContent).toContain('Different pages');
    const query = container.querySelector<HTMLInputElement>('input[name="match"][value="ignoreQuery"]')!;
    query.checked = true;
    query.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect([...example().querySelectorAll('.match-ignored')].map((e) => e.textContent)).toEqual(['?lang=en', '?lang=pt']);
    expect(example().querySelector('.match-verdict')!.textContent).toContain('Same page');
  });

  it('shows the installed version beside the name', () => {
    const page = renderSettings({ settings: DEFAULT_SETTINGS, version: '3.1.0', saved: false });
    expect(page.querySelector('.settings-title .version')!.textContent).toBe('v3.1.0');
  });

  it('offers every theme, each card previewed in its own colours', () => {
    const page = renderSettings({ settings: DEFAULT_SETTINGS, version: '3', saved: false });
    const cards = page.querySelectorAll('.theme-card');
    expect(cards).toHaveLength(14);
    expect(page.querySelector('.theme-card input[value="ember"]')!.closest('.theme-card')!.querySelector('[data-theme="ember"]')).not.toBeNull();
  });

  it('previews the badge as set, and turns colours off with it', () => {
    const on = renderSettings({ settings: { ...DEFAULT_SETTINGS, badge: 'all', badgeColor: '#7c3aed' }, version: '3', saved: false });
    expect(on.querySelector<HTMLElement>('.tb-badge')!.textContent).toBe('128');
    expect(on.querySelector<HTMLElement>('.tb-badge')!.getAttribute('style')).toContain('#7c3aed');
    const off = renderSettings({ settings: { ...DEFAULT_SETTINGS, badge: 'off' }, version: '3', saved: false });
    expect(off.querySelector('.tb-badge')).toBeNull();
    expect(off.querySelector<HTMLInputElement>('input[name="badgeColor"]')!.disabled).toBe(true);
  });

  it('shows whether ATO is pinned, and hides the badge preview when it is not', () => {
    const on = renderSettings({ settings: DEFAULT_SETTINGS, version: '3', saved: false, pinned: true });
    expect(on.querySelector('.pin-status')!.textContent).toBe('Pinned');
    expect(on.querySelector('.tb-badge')).not.toBeNull();
    const off = renderSettings({ settings: DEFAULT_SETTINGS, version: '3', saved: false, pinned: false });
    expect(off.querySelector('.pin-status')!.textContent).toBe('Not pinned');
    expect(off.querySelector('.tb-badge')).toBeNull();
  });

  it('folds the theme grid to a row and a half until opened', async () => {
    const container = document.createElement('div');
    await mountSettings(container, new MemorySettings({ ...DEFAULT_SETTINGS, theme: 'dune' }), { version: '3' });
    const more = () => container.querySelector<HTMLButtonElement>('.theme-more')!;
    expect(more().getAttribute('aria-expanded')).toBe('false');
    expect(more().textContent).toContain('using Dune');
    expect(container.querySelector('.theme-card input[value="dune"]')!.closest('.theme-card')!.hasAttribute('inert')).toBe(true);
    more().click();
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.theme-card[inert]')).toHaveLength(0);
  });

  it('follows changes saved elsewhere', async () => {
    const store = new MemorySettings();
    const container = document.createElement('div');
    await mountSettings(container, store, { version: '3' });
    await store.save({ ...DEFAULT_SETTINGS, view: 'sites' });
    expect(container.querySelector<HTMLInputElement>('input[name="view"][value="sites"]')!.checked).toBe(true);
  });
});
