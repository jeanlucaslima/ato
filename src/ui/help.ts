import { h } from './dom';
import { icon } from './icons';
import { KEY_HELP } from './keys';

/**
 * The `?` panel: every shortcut, generated from the same table the keymap documents.
 * It takes focus when open, so the arrows and Page keys scroll it; Esc, ?, its close
 * button or a click outside it closes it.
 */
export function helpPanel(): HTMLElement {
  return h(
    'div',
    { class: 'help', 'data-key': 'help' },
    h(
      'section',
      { class: 'help-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title', tabindex: '-1' },
      h(
        'header',
        { class: 'help-head' },
        h('h2', { id: 'help-title' }, 'Keyboard shortcuts'),
        h('button', { class: 'btn btn--ghost help-close', type: 'button', 'aria-label': 'Close shortcuts', title: 'Close (Esc)', 'data-action': 'toggle-help' }, h('kbd', { class: 'k k--box' }, 'Esc'), icon('close', 12)),
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
