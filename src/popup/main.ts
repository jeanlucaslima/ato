import '../ui/tokens.css';
import '../ui/popup.css';
import { DEFAULT_SETTINGS, policyOf } from '../core/settings';
import { mountApp } from '../ui/app';
import { ChromeBrowser } from '../ui/chrome-browser';
import { ChromeSettings } from '../ui/chrome-settings';
import { initialUi } from '../ui/state';
import { applyTheme } from '../ui/theme';

async function main(): Promise<void> {
  const settings = await new ChromeSettings().load().catch(() => DEFAULT_SETTINGS);
  applyTheme(settings.theme);
  const ui = initialUi({ view: settings.view, scope: settings.scope, policy: policyOf(settings) });
  const root = document.getElementById('app') ?? document.body;
  mountApp(root, new ChromeBrowser(), { snapshot: null, ui }, { autofocus: true });
}

void main();
