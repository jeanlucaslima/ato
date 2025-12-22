/**
 * Font configuration for ATO extension
 * Shared between popup and options pages
 */

export const FONT_FAMILIES = {
  'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'archivo': '"Archivo", sans-serif',
  'geist': '"Geist", sans-serif',
  'google-sans': '"Google Sans", sans-serif',
  'inter': '"Inter", sans-serif',
  'mulish': '"Mulish", sans-serif',
  'outfit': '"Outfit", sans-serif',
  'titillium': '"Titillium Web", sans-serif'
};

/**
 * Apply the selected font to the document
 * @param {string} fontKey - The font key from FONT_FAMILIES
 */
export function applyFont(fontKey) {
  const fontFamily = FONT_FAMILIES[fontKey] || FONT_FAMILIES['system'];
  document.documentElement.style.setProperty('--font-family', fontFamily);
}
