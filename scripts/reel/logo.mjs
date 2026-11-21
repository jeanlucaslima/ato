/**
 * The 3D logo on the Cyber backdrop (/dev/reel.html?scene=logo), one full turn, frame by frame so it loops.
 * Args: frames dir, seconds, fps.
 * Needs the dev server on port 5199 (npx vite --port 5199) and playwright-core
 * (npm i --no-save playwright-core); drives the installed Google Chrome. See README.md.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
const [dir, seconds = '12', fps = '30'] = process.argv.slice(2);
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 476, height: 846 }, deviceScaleFactor: 1080 / 476 });
await page.goto('http://localhost:5199/dev/reel.html?theme=cyber&scene=logo', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const n = Math.round(+seconds * +fps);
for (let i = 0; i < n; i++) {
  // one full turn over the clip, so it loops seamlessly
  await page.evaluate((deg) => window.drawLogo(deg), 18 + (360 * i) / n);
  await page.screenshot({ path: dir + '/f' + String(i).padStart(4, '0') + '.png' });
}
console.log(n, 'frames');
await browser.close();
