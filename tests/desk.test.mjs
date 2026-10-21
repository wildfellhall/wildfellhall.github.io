import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

let server, browser;
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4187/';
before(async () => {
  if (!process.env.TEST_URL) {
    server = await createServer({ server: { host: '127.0.0.1', port: 4187, strictPort: true } });
    await server.listen();
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  await mkdir('test-results', { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

test('desk renders, atmosphere and close view work, and keyboard controls remain accessible', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor();
  assert.equal((await page.locator('.desk-controls').innerText()).trim(), '', 'Controls must not add visible text over the desk');
  await page.screenshot({ path: 'test-results/desktop.png' });
  await page.getByRole('button', { name: 'Change to evening light' }).click();
  assert.equal(await page.getByRole('button', { name: 'Change to afternoon light' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'test-results/evening.png' });
  await page.getByRole('button', { name: 'Look closer at the desk' }).click();
  assert.equal(await page.getByRole('button', { name: 'Return to the whole desk' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'test-results/close.png' });
  await page.getByRole('button', { name: 'Return to the whole desk' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Look closer at the desk' }).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
  await page.close();
});

test('portrait layout fills the viewport and both controls work by touch', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: 'test-results/mobile.png' });
  await page.getByRole('button', { name: 'Change to evening light' }).tap();
  await page.getByRole('button', { name: 'Look closer at the desk' }).tap();
  assert.equal(await page.getByRole('button', { name: 'Return to the whole desk' }).getAttribute('aria-pressed'), 'true');
  await page.close();
});

test('a texture loading failure keeps the fallback visible and removes inactive controls', async () => {
  const page = await browser.newPage();
  await page.route('**/materials/ivory-color.webp', route => route.abort());
  await page.goto(baseURL);
  await page.locator('#room.is-fallback').waitFor();
  assert.equal(await page.locator('#desk-fallback').isVisible(), true);
  assert.equal(await page.locator('#desk-fallback img').evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }), true);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  await page.close();
});

test('browsers without WebGL show the matching still desk', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto(baseURL);
  await page.locator('#room.is-fallback').waitFor();
  const still = await page.locator('#desk-fallback img').evaluate(async image => {
    await image.decode();
    return { width: image.naturalWidth, source: image.currentSrc };
  });
  assert.ok(still.width > 0);
  assert.match(still.source, /desk-still-portrait\.webp\?v=overhead-1$/);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  await page.screenshot({ path: 'test-results/fallback.png' });
  await page.close();
});
