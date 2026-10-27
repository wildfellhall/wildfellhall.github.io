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

async function drawerPoint(page, index) {
  const box = await page.locator('.drawer-hotspot').nth(index).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function nextFrame(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('drawers open independently by clicking their geometry, retain their carvings, and close from the keyboard', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor();
  const drawers = page.locator('.drawer-hotspot');
  const left = await drawerPoint(page, 0), right = await drawerPoint(page, 2);
  assert.ok(Math.abs(left.y - right.y) < .1, 'Knobs on opposite sides should be level');
  await page.mouse.click(720, 350);
  assert.deepEqual(await drawers.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-expanded'))), ['false', 'false', 'false'], 'The desktop must occlude the closed drawers');
  for (const index of [1, 0, 2]) {
    const before = await drawerPoint(page, index);
    await page.mouse.click(before.x, before.y);
    await nextFrame(page);
    assert.equal(await drawers.nth(index).getAttribute('aria-expanded'), 'true');
    assert.ok((await drawerPoint(page, index)).y > before.y + 100, 'The knob must travel out with its drawer');
  }
  await page.screenshot({ path: 'test-results/drawers-open.png' });
  const centre = await drawerPoint(page, 1);
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  await page.mouse.move(centre.x + 80, centre.y, { steps: 4 }); await page.mouse.up();
  assert.equal(await drawers.nth(1).getAttribute('aria-expanded'), 'true', 'Dragging must not toggle a drawer');
  const openedLeft = await drawerPoint(page, 0);
  await page.mouse.click(openedLeft.x, openedLeft.y);
  await nextFrame(page);
  assert.equal(await drawers.nth(0).getAttribute('aria-expanded'), 'false', 'Clicking an open drawer must close it');
  assert.equal(await drawers.nth(1).getAttribute('aria-expanded'), 'true');
  for (const index of [1, 2]) {
    await drawers.nth(index).focus();
    await page.keyboard.press(index === 1 ? 'Space' : 'Enter');
  }
  await nextFrame(page);
  assert.deepEqual(await drawers.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-expanded'))), ['false', 'false', 'false']);
  await page.close();
});

test('wheel, buttons and keyboard zoom are bounded and Reset view restores the composition', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor();
  const start = await drawerPoint(page, 0);
  await page.mouse.move(720, 450); await page.mouse.wheel(0, -250); await nextFrame(page);
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isEnabled(), true);
  assert.ok((await drawerPoint(page, 0)).x < start.x - 100, 'Wheel zoom must enlarge the desk');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.locator('#desk').focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('+');
  assert.equal(await page.getByRole('button', { name: 'Zoom in', exact: true }).isDisabled(), true);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp');
  await page.locator('.drawer-hotspot').nth(2).focus(); await nextFrame(page);
  const revealed = await drawerPoint(page, 2);
  assert.ok(revealed.x > 100 && revealed.x < 1340 && revealed.y > 100 && revealed.y < 900, 'Focusing an offscreen drawer must bring its knob into view');
  assert.equal(await page.locator('#room').evaluate(room => room.scrollLeft + room.scrollTop), 0, 'Keyboard focus must move the camera without scrolling the room');
  await page.screenshot({ path: 'test-results/zoom-carving.png' });
  await page.getByRole('button', { name: 'Reset view' }).click(); await nextFrame(page);
  assert.deepEqual(await drawerPoint(page, 0), start);
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isDisabled(), true);
  await page.locator('#desk').focus();
  await page.keyboard.press('-'); await nextFrame(page);
  assert.deepEqual(await drawerPoint(page, 0), start, 'Zoom cannot go below the original framing');
  await page.close();
});

test('drawer motion can reverse, reduced motion settles it, and graphics recovery preserves state', async () => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'no-preference' });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor();
  const drawer = page.locator('.drawer-hotspot').nth(1), start = await drawerPoint(page, 1);
  await page.mouse.click(start.x, start.y);
  await page.waitForFunction(y => document.querySelectorAll('.drawer-hotspot')[1].getBoundingClientRect().top + 22 > y + 8, start.y);
  await drawer.focus(); await page.keyboard.press('Space');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await nextFrame(page);
  assert.equal(await drawer.getAttribute('aria-expanded'), 'false');
  assert.ok(Math.abs((await drawerPoint(page, 1)).y - start.y) < 1, 'Reduced motion must settle a reversing drawer');
  await page.keyboard.press('Enter'); await nextFrame(page);
  const open = await drawerPoint(page, 1);
  await page.evaluate(() => {
    window.recoveryExtension = document.querySelector('#desk').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.recoveryExtension.loseContext();
  });
  await page.waitForFunction(() => !document.querySelector('#room').classList.contains('is-ready'));
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  await page.evaluate(() => { window.recoveryExtension.restoreContext(); delete window.recoveryExtension; });
  await page.locator('#room.is-ready').waitFor(); await nextFrame(page);
  assert.equal(await drawer.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await drawerPoint(page, 1), open);
  await drawer.focus(); await page.keyboard.press('Enter'); await nextFrame(page);
  assert.equal(await drawer.getAttribute('aria-expanded'), 'false');
  // Losing the small frame context must leave the desk and its controls usable.
  await page.locator('.desk-controls.has-metal-frame').waitFor();
  await nextFrame(page);
  const frameBefore = await page.locator('#control-frame').evaluate(canvas => canvas.toDataURL());
  await page.evaluate(() => {
    window.frameRecoveryExtension = document.querySelector('#control-frame').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.frameRecoveryExtension.loseContext();
  });
  await page.waitForFunction(() => !document.querySelector('.desk-controls').classList.contains('has-metal-frame'));
  assert.equal(await page.locator('#room.is-ready').count(), 1);
  assert.equal(await page.locator('.desk-controls').isVisible(), true);
  assert.equal(await page.locator('.desk-controls').evaluate(async element => {
    const url = getComputedStyle(element, '::before').backgroundImage.match(/url\("?(.*?)"?\)/)[1];
    const image = new Image(); image.src = url; await image.decode(); return image.naturalWidth;
  }), 616, 'The fallback is a matching 2x render of the actual frame');
  await page.evaluate(() => { window.frameRecoveryExtension.restoreContext(); delete window.frameRecoveryExtension; });
  await page.locator('.desk-controls.has-metal-frame').waitFor();
  assert.equal(await page.locator('#control-frame').evaluate(canvas => canvas.toDataURL()), frameBefore,
    'Context recovery must restore the metal reflections as well as the geometry');
  await page.close();
});

test('desk renders, atmosphere and close view work, and keyboard controls remain accessible', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor();
  await page.locator('.desk-controls.has-metal-frame').waitFor();
  const dayFrame = await page.locator('#control-frame').evaluate(canvas => canvas.toDataURL());
  assert.equal((await page.locator('.desk-controls').innerText()).trim(), '', 'Controls must not add visible text over the desk');
  await page.screenshot({ path: 'test-results/desktop.png' });
  await page.getByRole('button', { name: 'Change to evening light' }).click();
  assert.equal(await page.getByRole('button', { name: 'Change to afternoon light' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'test-results/evening.png' });
  assert.notEqual(await page.locator('#control-frame').evaluate(canvas => canvas.toDataURL()), dayFrame,
    'The metal frame must respond to the room lighting');
  await page.getByRole('button', { name: 'Look closer at the desk' }).click();
  assert.equal(await page.getByRole('button', { name: 'Return to the whole desk' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'test-results/close.png' });
  await page.getByRole('button', { name: 'Return to the whole desk' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Look closer at the desk' }).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
  await page.close();
});

test('portrait layout supports touch inspection, keyboard recentering, and both controls', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: 'test-results/mobile.png' });
  const centered = await page.locator('#desk').screenshot();
  const touch = await page.context().newCDPSession(page);
  for (let i = 0; i < 2; i++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y: 430 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 50, y: 430 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  assert.notDeepEqual(await page.locator('#desk').screenshot(), centered, 'Dragging must reveal a different part of the furniture');
  await page.screenshot({ path: 'test-results/mobile-carving.png' });
  await page.locator('#desk').focus();
  await page.keyboard.press('Home');
  await page.locator('#desk').evaluate(canvas => canvas.blur());
  assert.deepEqual(await page.locator('#desk').screenshot(), centered, 'Home must restore the original composition');
  const centreKnob = await drawerPoint(page, 1);
  await page.touchscreen.tap(centreKnob.x, centreKnob.y); await nextFrame(page);
  assert.equal(await page.locator('.drawer-hotspot').nth(1).getAttribute('aria-expanded'), 'true', 'A tap must open the drawer');
  await page.screenshot({ path: 'test-results/mobile-drawer.png' });
  const openKnob = await drawerPoint(page, 1);
  await page.touchscreen.tap(openKnob.x, openKnob.y); await nextFrame(page);
  assert.equal(await page.locator('.drawer-hotspot').nth(1).getAttribute('aria-expanded'), 'false');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 135, y: 420, id: 0 }, { x: 255, y: 420, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 55, y: 420, id: 0 }, { x: 335, y: 420, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await nextFrame(page);
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isEnabled(), true, 'Pinching apart must zoom into the desk');
  assert.deepEqual(await page.locator('.drawer-hotspot').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-expanded'))), ['false', 'false', 'false'], 'Pinching must not open drawers');
  await page.getByRole('button', { name: 'Reset view' }).tap(); await nextFrame(page);
  assert.deepEqual(await drawerPoint(page, 1), centreKnob);
  await page.getByRole('button', { name: 'Change to evening light' }).tap();
  await page.getByRole('button', { name: 'Look closer at the desk' }).tap();
  assert.equal(await page.getByRole('button', { name: 'Return to the whole desk' }).getAttribute('aria-pressed'), 'true');
  await page.close();
});

test('a texture loading failure keeps the fallback visible and removes inactive controls', async () => {
  const page = await browser.newPage();
  await page.route('**/materials/ivory-color.webp?v=*', route => route.abort());
  await page.goto(baseURL);
  await page.locator('#room.is-fallback').waitFor();
  assert.equal(await page.locator('#desk-fallback').isVisible(), true);
  assert.equal(await page.locator('#desk-fallback img').evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }), true);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
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
  assert.match(still.source, /desk-still-portrait\.webp\?v=crest-5$/);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  assert.equal(await page.locator('#desk').evaluate(canvas => getComputedStyle(canvas).pointerEvents), 'none', 'The inactive canvas must not intercept fallback touch gestures');
  await page.screenshot({ path: 'test-results/fallback.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => document.querySelector('#desk-fallback img').currentSrc.includes('desk-still-wide.webp'));
  assert.match(await page.locator('#desk-fallback img').evaluate(async image => {
    await image.decode(); return image.currentSrc;
  }), /desk-still-wide\.webp\?v=crest-5$/);
  await page.screenshot({ path: 'test-results/fallback-wide.png' });
  await page.close();
});
