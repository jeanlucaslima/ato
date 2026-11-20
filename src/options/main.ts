import '../ui/tokens.css';
import '../ui/settings.css';
import { ChromeSettings } from '../ui/chrome-settings';
import { mountSettings } from '../ui/settings-page';
import { applyTheme } from '../ui/theme';

const root = document.getElementById('app') ?? document.body;
void mountSettings(root, new ChromeSettings(), {
  version: chrome.runtime.getManifest().version,
  onChange: (settings) => applyTheme(settings.theme),
});
