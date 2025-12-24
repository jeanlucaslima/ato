/**
 * ATO Logger Utility
 * Conditionally logs based on debugLogging setting.
 * Errors are always logged for debugging user issues.
 */

let debugEnabled = false;

/**
 * Initialize logger by loading setting and listening for changes
 */
export async function initLogger() {
  const { debugLogging } = await chrome.storage.sync.get({ debugLogging: false });
  debugEnabled = debugLogging;

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.debugLogging) {
      debugEnabled = changes.debugLogging.newValue;
    }
  });
}

/**
 * Log message (only when debug logging is enabled)
 */
export function log(...args) {
  if (debugEnabled) console.log(...args);
}

/**
 * Log error (always logged)
 */
export function error(...args) {
  console.error(...args);
}
