import { h } from './dom';
import { icon } from './icons';
import { KEY_HELP } from './keys';

/** The `?` panel: every shortcut, generated from the same table the keymap documents. */
export function helpPanel(): HTMLElement {
  return h(
    'div',
    { class: 'help', 'data-key': 'help' },
    h(
      'section',
      { class: 'help-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title' },
      h(
        'header',
        { class: 'help-head' },
        h('h2', { id: 'help-title' }, 'Keyboard shortcuts'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close shortcuts', 'data-action': 'toggle-help' }, icon('close', 12)),
      ),
      KEY_HELP.map((section) =>
        h(
          'div',
          { class: 'help-section' },
          h('h3', null, section.title),
          h(
            'dl',
            null,
            section.entries.map((entry) => [
              h('dt', null, entry.keys.map((k) => h('kbd', { class: 'k k--box' }, k))),
              h('dd', null, entry.label),
            ]),
          ),
        ),
      ),
    ),
  );
}
