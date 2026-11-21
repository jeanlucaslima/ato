/**
 * Every theme as a live popup on a tilted sheet (/dev/reel.html?scene=themes), panned frame by frame.
 * Args: frames dir, seconds, fps, extra CSS (the published one used ".reel-sheet { --zoom: 0.52; --travel: 1500px; }").
 * Needs the dev server on port 5199 (npx vite --port 5199) and playwright-core
 * (npm i --no-save playwright-core); drives the installed Google Chrome. See README.md.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
const [dir, seconds = '10', fps = '30', css = ''] = process.argv.slice(2);
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 476, height: 846 }, deviceScaleFactor: 1080 / 476 });
await page.goto('http://localhost:5199/dev/reel.html?theme=onyx&scene=themes', { waitUntil: 'networkidle' });
if (css) await page.addStyleTag({ content: css });
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(1200);
const n = Math.max(1, Math.round(+seconds * +fps));
for (let i = 0; i < n; i++) {
  // ease in and out, so the pan starts and ends gently
  const x = n === 1 ? 0.5 : i / (n - 1);
  const t = 0.5 - Math.cos(Math.PI * x) / 2;
  await page.evaluate((t) => window.panTo(t), t);
  await page.screenshot({ path: dir + '/f' + String(i).padStart(4, '0') + '.png' });
}
console.log(n, 'frames');
await browser.close();
