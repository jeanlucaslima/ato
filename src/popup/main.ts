import '../ui/tokens.css';
import '../ui/popup.css';
import { DEFAULT_SETTINGS, policyOf } from '../core/settings';
import { mountApp } from '../ui/app';
import { ChromeBrowser } from '../ui/chrome-browser';
import { ChromeSettings } from '../ui/chrome-settings';
import { initialUi } from '../ui/state';
import { applyTheme } from '../ui/theme';

async function main(): Promise<void> {
  const store = new ChromeSettings();
  const settings = await store.load().catch(() => DEFAULT_SETTINGS);
  applyTheme(settings.theme);
  const ui = initialUi({ view: settings.view, scope: settings.scope, policy: policyOf(settings) });
  const root = document.getElementById('app') ?? document.body;
  const app = mountApp(root, new ChromeBrowser(), { snapshot: null, ui }, { autofocus: true });
  // Changes made on the settings page while the popup is open apply at once.
  // View and scope are only where the popup starts, so they wait for the next open.
  store.subscribe((next) => {
    applyTheme(next.theme);
    app.dispatch({ type: 'policy', policy: policyOf(next) });
  });
}

void main();
