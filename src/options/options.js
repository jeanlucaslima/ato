/**
 * ATO Options Page
 * Handles loading and saving extension settings
 */

import { applyFont } from '../shared/font-config.js';

// Default settings
const DEFAULT_SETTINGS = {
  // Appearance
  theme: 'dark',
  fontFamily: 'titillium',

  // Duplicate Detection
  matchMode: 'exact',
  keepTab: 'oldest',

  // Tab Protection
  protectPinned: true,
  protectGroups: false,

  // Badge
  showBadge: true,
  badgeMode: 'duplicates',
  badgeColor: '#DC2626',

  // Advanced
  advancedMode: false,
  currentWindowOnly: false,
  showMergeButton: false
};

// Setting element IDs mapped to their types
const SETTING_TYPES = {
  theme: 'select',
  fontFamily: 'select',
  matchMode: 'select',
  keepTab: 'select',
  protectPinned: 'checkbox',
  protectGroups: 'checkbox',
  showBadge: 'checkbox',
  badgeMode: 'select',
  badgeColor: 'color',
  advancedMode: 'checkbox',
  currentWindowOnly: 'checkbox',
  showMergeButton: 'checkbox'
};

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Load settings from chrome.storage and populate form
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  for (const [key, type] of Object.entries(SETTING_TYPES)) {
    const element = document.getElementById(key);
    if (!element) continue;

    if (type === 'checkbox') {
      element.checked = settings[key];
    } else {
      element.value = settings[key];
    }
  }

  // Apply theme and font
  applyTheme(settings.theme);
  applyFont(settings.fontFamily);

  // Load version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = manifest.version;

  // Set initial visibility of advanced settings
  updateAdvancedVisibility(settings.advancedMode);
}

/**
 * Save a single setting to chrome.storage
 */
async function saveSetting(key, value) {
  await chrome.storage.sync.set({ [key]: value });

  // Notify background script of settings change
  chrome.runtime.sendMessage({
    type: 'SETTINGS_CHANGED',
    key,
    value
  });

  showSaveStatus();
}

/**
 * Show save confirmation
 */
function showSaveStatus() {
  const status = document.getElementById('saveStatus');
  status.classList.add('visible');

  clearTimeout(window.saveStatusTimeout);
  window.saveStatusTimeout = setTimeout(() => {
    status.classList.remove('visible');
  }, 2000);
}

/**
 * Update visibility of advanced settings section
 */
function updateAdvancedVisibility(show) {
  const advancedSettings = document.getElementById('advancedSettings');
  if (show) {
    advancedSettings.classList.remove('hidden');
  } else {
    advancedSettings.classList.add('hidden');
  }
}

/**
 * Initialize event listeners for all settings
 */
function initEventListeners() {
  for (const [key, type] of Object.entries(SETTING_TYPES)) {
    const element = document.getElementById(key);
    if (!element) continue;

    const eventType = type === 'checkbox' ? 'change' : 'input';

    element.addEventListener(eventType, (e) => {
      const value = type === 'checkbox' ? e.target.checked : e.target.value;
      saveSetting(key, value);

      // Special handling for advancedMode toggle
      if (key === 'advancedMode') {
        updateAdvancedVisibility(value);
      }

      // Special handling for theme change
      if (key === 'theme') {
        applyTheme(value);
      }

      // Special handling for font change
      if (key === 'fontFamily') {
        applyFont(value);
      }
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initEventListeners();
});
