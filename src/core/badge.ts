/**
 * What the toolbar badge shows. Pure, so the service worker and tests share it.
 * The duplicate count comes from the same planner as the popup: it is exactly
 * how many tabs "Close N" would close right now.
 */
import { planDuplicates, tabsToClose } from './duplicates';
import { policyOf, type Settings } from './settings';
import type { Tab } from './types';

export interface Badge {
  /** `''` hides the badge. */
  text: string;
  color: string;
}

/** The badge fits about four characters. */
export const BADGE_MAX = 999;

export function badgeText(n: number): string {
  return n > BADGE_MAX ? `${BADGE_MAX}+` : String(n);
}

export function badgeFor(tabs: readonly Tab[], settings: Settings): Badge {
  const color = settings.badgeColor;
  switch (settings.badge) {
    case 'off':
      return { text: '', color };
    case 'all':
      return { text: badgeText(tabs.length), color };
    case 'duplicates': {
      const extra = tabsToClose(planDuplicates(tabs, policyOf(settings))).length;
      return { text: extra === 0 ? '' : badgeText(extra), color };
    }
  }
}
