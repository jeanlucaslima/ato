/**
 * The options page: renders settings and saves each change as it happens.
 * Rendering is a pure function of `SettingsView`; `mountSettings` owns the
 * state and re-renders with `morph` so focus survives a change.
 */
import { CHOICES, readSettings, type ChoiceKey, type Settings, type ToggleKey } from '../core/settings';
import { cls, h } from './dom';
import { attachSpin, icosahedron } from './icosahedron';
import { morph } from './morph';
import type { SettingsStore } from './settings-store';

export interface SettingsView {
  settings: Settings;
  version: string;
  /** A change has been saved since the page opened. */
  saved: boolean;
}

function text(id: string, title: string, note?: string): HTMLElement {
  return h('div', { class: 'setting-text' }, h('span', { class: 'setting-title', id }, title), note && h('p', { class: 'setting-note' }, note));
}

function choice<K extends ChoiceKey>(s: Settings, key: K, title: string, labels: Record<Settings[K], string>, note?: string): HTMLElement {
  const id = `setting-${key}`;
  return h(
    'div',
    { class: 'setting' },
    text(id, title, note),
    h(
      'div',
      { class: 'choice', role: 'radiogroup', 'aria-labelledby': id },
      CHOICES[key].map((value) =>
        h('label', { class: 'choice-opt' }, h('input', { type: 'radio', name: key, value, checked: s[key] === value }), h('span', null, labels[value])),
      ),
    ),
  );
}

function toggle(s: Settings, key: ToggleKey, title: string, note: string): HTMLElement {
  const id = `setting-${key}`;
  return h(
    'label',
    { class: 'setting setting--toggle' },
    text(id, title, note),
    h('input', { class: 'switch', type: 'checkbox', role: 'switch', name: key, checked: s[key], 'aria-labelledby': id }),
  );
}

function info(title: string, note: string, ...keys: string[]): HTMLElement {
  return h('div', { class: 'setting' }, text('', title, note), h('span', { class: 'keys' }, keys.map((k) => h('kbd', null, k))));
}

function section(title: string, note: string | null, ...rows: HTMLElement[]): HTMLElement {
  return h('section', null, h('h2', null, title), note && h('p', { class: 'section-note' }, note), h('div', { class: 'group' }, rows));
}

/** Render the whole settings page. Pure: same view, same DOM. */
export function renderSettings({ settings: s, version, saved }: SettingsView): HTMLElement {
  return h(
    'div',
    { class: 'settings' },
    h(
      'header',
      { class: 'settings-head' },
      icosahedron(72),
      h('h1', null, 'ATO'),
      h('p', null, 'Advanced Tab Organizer · Settings'),
      h('span', { class: cls('saved', saved && 'is-saved'), role: 'status' }, saved ? 'Saved' : 'Changes save automatically'),
    ),
    section(
      'Closing duplicates',
      'The tab you’re on in each window is always kept.',
      choice(s, 'keep', 'Keep', { oldest: 'Oldest copy', newest: 'Newest copy' }, 'When no copy is protected, this one stays and the rest close.'),
      toggle(s, 'protectPinned', 'Protect pinned tabs', 'Pinned copies are never closed.'),
      toggle(s, 'protectGroups', 'Protect tab groups', 'Copies inside a tab group are never closed.'),
    ),
    section(
      'When the popup opens',
      null,
      choice(s, 'view', 'Show', { tabs: 'Tabs', sites: 'Sites' }),
      choice(s, 'scope', 'From', { all: 'All windows', current: 'This window' }, 'Search always covers every window.'),
    ),
    section('Appearance', null, choice(s, 'theme', 'Theme', { system: 'System', dark: 'Dark', light: 'Light' })),
    section(
      'Keyboard',
      null,
      info('Open ATO', 'Change it in chrome://extensions/shortcuts.', '⌘U', 'Ctrl+U'),
      info('Every shortcut', 'Press ? in the popup to see them all.', '?'),
    ),
    h(
      'footer',
      { class: 'settings-foot' },
      h('span', null, `ATO ${version}`),
      h('a', { href: 'https://github.com/jeanlucaslima/ato', target: '_blank', rel: 'noopener' }, 'Source on GitHub ↗'),
    ),
  );
}

export interface SettingsPage {
  destroy(): void;
}

export interface SettingsOptions {
  version: string;
  /** Runs after load and after every change, e.g. to apply the theme. */
  onChange?: (settings: Settings) => void;
}

export async function mountSettings(container: HTMLElement, store: SettingsStore, options: SettingsOptions): Promise<SettingsPage> {
  let settings = await store.load();
  let saved = false;
  let root: HTMLElement | null = null;

  function render(): void {
    const next = renderSettings({ settings, version: options.version, saved });
    if (root) morph(root, next);
    else container.replaceChildren((root = next));
  }

  function set(next: Settings): void {
    settings = next;
    render();
    options.onChange?.(settings);
  }

  const onChange = (event: Event) => {
    const el = event.target as HTMLInputElement;
    if (!el.name) return;
    saved = true;
    set(readSettings({ ...settings, [el.name]: el.type === 'checkbox' ? el.checked : el.value }));
    void store.save(settings);
  };

  container.addEventListener('change', onChange);
  const unsubscribe = store.subscribe(set);
  set(settings);
  const logo = container.querySelector<HTMLElement>('.ico');
  const stopSpin = logo ? attachSpin(logo) : () => {};

  return {
    destroy() {
      stopSpin();
      unsubscribe();
      container.removeEventListener('change', onChange);
    },
  };
}
