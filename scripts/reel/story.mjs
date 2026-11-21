/**
 * The popup in use, recorded in real time from /dev/reel.html via a CDP screencast.
 * Args: theme, frames dir, viewport W, H, output W, H, layout ("top": popup in the lower 2/3, cut off at the bottom; a number: centred, lifted by that many px).
 * Writes frames plus list.txt (an ffmpeg concat list with each frame's real duration).
 * Needs the dev server on port 5199 (npx vite --port 5199) and playwright-core
 * (npm i --no-save playwright-core); drives the installed Google Chrome. See README.md.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const [theme, dir, W = '520', H = '650', OW = '1080', OH = '1350', lift = '0'] = process.argv.slice(2);
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +OW / +W });
await page.goto('http://localhost:5199/dev/reel.html?theme=' + theme, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: lift === 'top' ? 'body { display: block; } .reel-stage { position: fixed; top: 33.4vh; left: 50%; transform: translateX(-50%); }' : 'body { padding-bottom: ' + lift + 'px; box-sizing: border-box; }' });
await page.focus('input');
await page.waitForTimeout(800);
const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const f = dir + '/f' + String(frames.length).padStart(5, '0') + '.png';
  writeFileSync(f, Buffer.from(data, 'base64'));
  frames.push({ f, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'png', maxWidth: +OW, maxHeight: +OH, everyNthFrame: 1 });
const w = (ms) => page.waitForTimeout(ms);
const k = async (key, n = 1, gap = 260) => { for (let i = 0; i < n; i++) { await page.keyboard.press(key); await w(gap); } };
const t0 = Date.now() / 1000;
await w(1300);
await page.keyboard.type('chrome', { delay: 140 });
await w(900);
await k('ArrowDown', 2, 350);
await w(500);
await k('Escape'); await w(600);
await k('Meta+d'); await w(1400);
await k('ArrowDown', 4, 330); await w(600);
await k('Meta+d'); await w(1300);
await k('Escape'); await w(1300);
await k('ArrowDown'); await k('s'); await w(900);
await k('ArrowDown', 2, 330); await k('ArrowRight'); await w(1400);
await k('s'); await w(800);
await k('ArrowDown', 2, 330); await k('ArrowRight'); await w(1800);
await k('s'); await w(1500);
const tEnd = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await w(200);
// concat list: each frame lasts until the next; the first starts at t0, the last holds to the end
const lines = [];
frames.forEach((fr, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : tEnd;
  lines.push("file '" + fr.f + "'", 'duration ' + Math.max(0.001, next - fr.t).toFixed(4));
});
lines.push("file '" + frames.at(-1).f + "'");
writeFileSync(dir + '/list.txt', lines.join('\n'));
console.log(frames.length, 'frames', (tEnd - frames[0].t).toFixed(2) + 's');
await browser.close();
