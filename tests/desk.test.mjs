import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';

let server, browser;
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4187/';
// Allow a slower first shader compile under software WebGL. Interaction
// assertions retain Playwright's normal timeout.
const startupTimeout = 90000;
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

async function bookPoint(page, action) {
  const box = await page.locator(`[data-book-action="${action}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('the leather book opens by its geometry, turns ornamented pages both ways, and closes from the keyboard', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  const closed = await bookPoint(page, 'toggle');
  await page.mouse.move(closed.x, closed.y); await page.mouse.down();
  await page.mouse.move(closed.x + 30, closed.y + 12, { steps: 3 }); await page.mouse.up();
  assert.equal(await page.locator('#room').getAttribute('data-book-phase'), 'closed', 'A drag must inspect the desk without opening the book');
  const cover = await bookPoint(page, 'toggle'); await page.mouse.click(cover.x, cover.y);
  await page.locator('#room[data-book-phase="open"]').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Close The Tenant of Wildfell Hall' }).getAttribute('aria-expanded'), 'true');
  assert.equal((await page.locator('#book-controls').innerText()).trim(), '', 'Book controls must not add visible labels');
  await page.screenshot({ path: 'test-results/book-open-desktop.png' });
  const right = await bookPoint(page, 'next'); await page.mouse.click(right.x, right.y);
  await page.locator('#room[data-book-page="1"]').waitFor();
  const left = await bookPoint(page, 'previous'); await page.mouse.click(left.x, left.y);
  await page.locator('#room[data-book-page="0"]').waitFor();
  await page.getByRole('button', { name: 'Next page', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.locator('#room[data-book-page="1"]').waitFor();
  await page.keyboard.press('ArrowRight'); await page.locator('#room[data-book-page="2"]').waitFor();
  await page.screenshot({ path: 'test-results/book-pages-desktop.png' });
  await page.keyboard.press('Escape'); await page.locator('#room[data-book-phase="closed"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '0');
  await page.getByRole('button', { name: 'Open The Tenant of Wildfell Hall' }).focus(); await page.keyboard.press('Enter');
  await page.locator('#room[data-book-phase="open"]').waitFor();
  assert.deepEqual(await page.locator('.drawer-hotspot').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-expanded'))), ['false', 'false', 'false']);
  assert.deepEqual(errors, []); await page.close();
});

test('touch opens the book and turns pages while pinching remains a zoom gesture', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  const cover = await bookPoint(page, 'toggle'); await page.touchscreen.tap(cover.x, cover.y);
  await page.locator('#room[data-book-phase="open"]').waitFor();
  await page.screenshot({ path: 'test-results/book-open-mobile.png' });
  const right = await bookPoint(page, 'next'); await page.touchscreen.tap(right.x, right.y);
  await page.locator('#room[data-book-page="1"]').waitFor();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: right.y, id: 0 }, { x: 250, y: right.y, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 95, y: right.y, id: 0 }, { x: 295, y: right.y, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await nextFrame(page);
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isEnabled(), true);
  await page.getByRole('button', { name: 'Close book', exact: true }).tap();
  await page.locator('#room[data-book-phase="closed"]').waitFor();
  await page.getByRole('button', { name: 'Reset view' }).tap(); await nextFrame(page);
  const reopened = await bookPoint(page, 'toggle'); await page.touchscreen.tap(reopened.x, reopened.y);
  await page.locator('#room[data-book-phase="open"]').waitFor();
  const next = await bookPoint(page, 'next'); await page.touchscreen.tap(next.x, next.y);
  await page.locator('#room[data-book-page="1"]').waitFor();
  const left = await bookPoint(page, 'previous'); await page.touchscreen.tap(left.x, left.y);
  await page.locator('#room[data-book-page="0"]').waitFor();
  await page.touchscreen.tap(left.x, left.y); await page.locator('#room[data-book-phase="closed"]').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.close();
});

test('double-click reads the book full screen without turning a page and restores the desk view', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const passages = [
    'A quiet light rested upon the ivory desk. Beyond the window, the last roses stirred in the autumn air. The room held the warmth of an afternoon spent among books, and every turning leaf carried the soft trace of time.',
    'The garden path curved beneath the branches, where fallen petals gathered in the shade. A letter lay unwritten, its thoughts still wandering through the long, unhurried day.',
    'Evening brought a gentler light. The gilt upon the binding caught its final glow, while the open pages waited for another story to begin. Éléonore’s words remained clear upon the paper.',
  ];
  await page.route('**/book.txt', route => route.fulfill({ contentType: 'text/plain; charset=utf-8', body: `# Not printed\n${passages.join('\n---\n')}` }));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  await page.screenshot({ path: 'test-results/book-corner-desktop.png' });
  const start = await drawerPoint(page, 0), cover = await bookPoint(page, 'toggle');
  assert.ok(cover.x > 1000 && cover.y < 400, 'The smaller book should sit toward the upper-right desk corner');
  await page.mouse.dblclick(cover.x, cover.y, { delay: 60 });
  await page.locator('#room[data-book-reading="true"][data-book-phase="open"]').waitFor(); await nextFrame(page);
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'room');
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '0');
  assert.equal(await page.locator('#book-transcript section').textContent(), passages[0]);
  assert.equal(await page.evaluate(() => [...document.fonts].some(face =>
    face.family.replaceAll('"', '') === 'Wildfell Typewriter' && face.status === 'loaded')), true);
  assert.ok(await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '34px "Wildfell Typewriter"';
    return Math.abs(ctx.measureText('iiiii').width - ctx.measureText('WWWWW').width) < .01;
  }), 'The loaded typewriter face must retain a fixed character pitch');
  assert.ok(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 160;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.font = '100px "Wildfell Typewriter"'; ctx.fontKerning = 'none'; ctx.fillText('eeeeee', 10, 120);
    const shaped = ctx.getImageData(0, 0, 800, 160).data; ctx.clearRect(0, 0, 800, 160);
    let x = 10; for (const glyph of 'eeeeee') { ctx.fillText(glyph, x, 120); x += ctx.measureText(glyph).width; }
    const repeated = ctx.getImageData(0, 0, 800, 160).data;
    let differences = 0; for (let i = 3; i < shaped.length; i += 4) if (Math.abs(shaped[i] - repeated[i]) > 20) differences++;
    return differences > 400;
  }), 'Whole text runs must use the alternate impressions, not six identical glyphs');
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  const reader = await page.screenshot({ path: 'test-results/book-reader-desktop.png' });
  const wood = await sharp(reader).extract({ left: 12, top: 180, width: 40, height: 140 }).stats();
  assert.ok(wood.channels.slice(0, 3).every(channel => channel.mean > 170), 'Fullscreen must retain the ivory wood behind the book');
  assert.ok(wood.channels[0].stdev > .25, 'The wood backdrop must retain its rendered grain and shading');
  await page.keyboard.press('ArrowRight'); await page.locator('#room[data-book-page="1"]').waitFor();
  assert.deepEqual(await page.locator('#book-transcript section').allTextContents(), passages.slice(1));
  await page.screenshot({ path: 'test-results/book-reader-turned.png' });
  await page.getByRole('button', { name: 'Return to desk', exact: true }).click();
  await page.locator('#room[data-book-reading="false"]').waitFor();
  await page.waitForFunction(() => !document.fullscreenElement); await nextFrame(page);
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  assert.deepEqual(await drawerPoint(page, 0), start, 'Leaving reading view restores the camera');
  const right = await bookPoint(page, 'next'); await page.mouse.dblclick(right.x, right.y, { delay: 60 });
  await page.locator('#room[data-book-reading="true"]').waitFor(); await nextFrame(page);
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1', 'Double-clicking an open page must not turn it');
  // Simulate the browser's own fullscreen exit, which may consume Escape.
  await page.evaluate(() => document.exitFullscreen());
  await page.locator('#room[data-book-reading="false"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  await page.getByRole('button', { name: 'Read book full screen' }).focus(); await page.keyboard.press('Enter');
  await page.locator('#room[data-book-reading="true"]').waitFor();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isEnabled(), true);
  await page.getByRole('button', { name: 'Fit book to screen' }).click();
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Close book', exact: true }).click();
  await page.locator('#room[data-book-reading="false"][data-book-phase="closed"]').waitFor();
  assert.deepEqual(errors, []); await page.close();
});

test('double-tap opens a responsive reader when native fullscreen is unavailable', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen unavailable')); });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  await page.screenshot({ path: 'test-results/book-corner-mobile.png' });
  const cover = await bookPoint(page, 'toggle'); await page.touchscreen.tap(cover.x, cover.y);
  await page.locator('#room[data-book-phase="open"]').waitFor();
  const right = await bookPoint(page, 'next');
  const touch = await page.context().newCDPSession(page);
  // Queue the four input events in wire order with human-speed timestamps.
  // synthesizeTapGesture waits for a rendered frame between taps, which can
  // be several seconds with software WebGL and is not a double tap.
  const now = Date.now() / 1000;
  await Promise.all([0, .06, .14, .20].map((offset, i) => touch.send('Input.dispatchTouchEvent', {
    type: i % 2 ? 'touchEnd' : 'touchStart', timestamp: now + offset,
    touchPoints: i % 2 ? [] : [{ x: right.x, y: right.y, id: 0 }],
  })));
  await page.locator('#room[data-book-reading="true"]').waitFor(); await nextFrame(page);
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '0');
  await page.screenshot({ path: 'test-results/book-reader-mobile.png' });
  const next = await bookPoint(page, 'next'); await page.touchscreen.tap(next.x, next.y);
  await page.locator('#room[data-book-page="1"]').waitFor();
  await page.setViewportSize({ width: 844, height: 390 }); await nextFrame(page);
  await page.screenshot({ path: 'test-results/book-reader-mobile-landscape.png' });
  for (const action of ['previous', 'next']) {
    const point = await bookPoint(page, action);
    assert.ok(point.x > 30 && point.x < 814 && point.y > 30 && point.y < 285, 'The spread must fit above the controls after rotation');
  }
  await page.getByRole('button', { name: 'Return to desk', exact: true }).tap();
  await page.locator('#room[data-book-reading="false"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Read book full screen' }).tap();
  await page.locator('#room[data-book-reading="true"]').waitFor();
  await page.keyboard.press('Escape'); await page.locator('#room[data-book-reading="false"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  await page.close();
});

test('drawers open independently by clicking their geometry, retain their carvings, and close from the keyboard', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(baseURL);
  await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout });
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
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout });
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
  await page.addInitScript(() => { Element.prototype.requestFullscreen = undefined; });
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout });
  const drawer = page.locator('.drawer-hotspot').nth(1), start = await drawerPoint(page, 1);
  await page.mouse.click(start.x, start.y);
  await page.waitForFunction(y => document.querySelectorAll('.drawer-hotspot')[1].getBoundingClientRect().top + 22 > y + 8, start.y);
  await drawer.focus(); await page.keyboard.press('Space');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await nextFrame(page);
  assert.equal(await drawer.getAttribute('aria-expanded'), 'false');
  assert.ok(Math.abs((await drawerPoint(page, 1)).y - start.y) < 1, 'Reduced motion must settle a reversing drawer');
  await page.keyboard.press('Enter'); await nextFrame(page);
  const open = await drawerPoint(page, 1);
  await page.locator('[data-book-action="toggle"]').evaluate(button => button.click()); await nextFrame(page);
  await page.locator('[data-book-action="next"]').evaluate(button => button.click()); await nextFrame(page);
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1');
  await page.getByRole('button', { name: 'Read book full screen' }).click();
  await page.locator('#room[data-book-reading="true"]').waitFor();
  await page.evaluate(() => {
    window.recoveryExtension = document.querySelector('#desk').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.recoveryExtension.loseContext();
  });
  await page.waitForFunction(() => !document.querySelector('#room').classList.contains('is-ready'));
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  assert.equal(await page.locator('#book-controls').isVisible(), false);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  await page.evaluate(() => { window.recoveryExtension.restoreContext(); delete window.recoveryExtension; });
  await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  assert.equal(await page.locator('#room').getAttribute('data-book-phase'), 'open');
  assert.equal(await page.locator('#room').getAttribute('data-book-page'), '1', 'Graphics recovery must preserve the open book and its current leaf');
  assert.equal(await page.locator('#room').getAttribute('data-book-reading'), 'true');
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  await page.getByRole('button', { name: 'Return to desk', exact: true }).click(); await nextFrame(page);
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
  await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout });
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
  await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout });
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
  await page.route('**/book.txt', route => route.fulfill({ contentType: 'text/plain', body: '# Editor note\nThis book text remains accessible without WebGL.\n\n<script>Literal words, never executable markup.</script>' }));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto(baseURL);
  await page.locator('#room.is-fallback').waitFor();
  await page.waitForFunction(() => document.querySelector('#book-transcript').textContent.includes('accessible without WebGL'));
  assert.equal(await page.locator('#book-transcript').getAttribute('hidden'), null);
  assert.equal(await page.locator('#book-transcript script').count(), 0);
  assert.equal(await page.locator('#book-transcript p').count(), 2);
  const still = await page.locator('#desk-fallback img').evaluate(async image => {
    await image.decode();
    return { width: image.naturalWidth, source: image.currentSrc };
  });
  assert.ok(still.width > 0);
  assert.match(still.source, /desk-still-portrait\.webp\?v=gazette-3$/);
  assert.equal(await page.locator('.desk-controls').isVisible(), false);
  assert.equal(await page.locator('#drawer-controls').isVisible(), false);
  assert.equal(await page.locator('#book-controls').isVisible(), false);
  assert.equal(await page.locator('#desk').evaluate(canvas => getComputedStyle(canvas).pointerEvents), 'none', 'The inactive canvas must not intercept fallback touch gestures');
  await page.screenshot({ path: 'test-results/fallback.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => document.querySelector('#desk-fallback img').currentSrc.includes('desk-still-wide.webp'));
  assert.match(await page.locator('#desk-fallback img').evaluate(async image => {
    await image.decode(); return image.currentSrc;
  }), /desk-still-wide\.webp\?v=gazette-3$/);
  await page.screenshot({ path: 'test-results/fallback-wide.png' });
  await page.close();
});


test('Gazette unfolds on the desk, reads separately, and switches dated issues without losing a failed load', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const original = await readFile('public/gazette/issues/2026-10-29.txt', 'utf8');
  const older = original.replaceAll('2026-10-29', '2026-10-28').replace(/\[article-1\]\ntitle:\n(?:subtitle:\n)?byline:[^\n]*\n/,
    '[article-1]\ntitle: An archived letter\nsubtitle: From the reading room\nbyline: A reader\n\n' + 'An entirely editable newspaper article. '.repeat(160) + '\n\n');
  await page.route('**/gazette/index.json', route => route.fulfill({json: [
    { date: '2026-10-29', label: '29 October 2026' }, { date: '2026-10-28', label: '28 October 2026' },
  ]}));
  let requests = 0;
  await page.route('**/gazette/issues/2026-10-28.txt', route => ++requests === 1
    ? route.fulfill({status: 503, body: 'Unavailable'}) : route.fulfill({body: older, contentType: 'text/plain'}));
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({ timeout: startupTimeout }); await nextFrame(page);
  const box = await page.locator('#gazette-hotspot').boundingBox(); await page.mouse.click(box.x + 22, box.y + 22);
  await page.locator('#room[data-gazette-phase="open"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-gazette-reading'), 'false');
  assert.equal(await page.locator('#gazette-transcript h3').count(), 6);
  const suppliedBylines = [...original.matchAll(/^byline: *(.+)$/gm)].map(match => match[1]);
  assert.deepEqual(await page.locator('#gazette-transcript p').allTextContents(), suppliedBylines, 'Preserve supplied bylines without inventing article prose');
  await page.screenshot({path: 'test-results/gazette-unfolded-desktop.png'});
  await page.getByRole('button', {name: 'Read Gazette full screen', exact: true}).click();
  await page.locator('#room[data-gazette-reading="true"]').waitFor();
  assert.equal(await page.evaluate(() => [...document.fonts].filter(face => face.status === 'loaded' && face.family.includes('Gazette')).length), 4);
  await page.screenshot({path: 'test-results/gazette-reader-desktop.png'});
  assert.equal(await page.locator('#room').getAttribute('data-gazette-pages'), '4');
  for (let number = 1; number < 4; number++) {
    await page.getByRole('button', {name: 'Next Gazette sheet'}).click();
    await page.locator(`#room[data-gazette-page="${number}"]`).waitFor();
  }
  assert.equal(await page.getByRole('button', {name: 'Next Gazette sheet'}).isDisabled(), true);
  await page.screenshot({path: 'test-results/gazette-fourth-page.png'});
  await page.getByRole('button', {name: 'Browse Gazette by date'}).click();
  await page.locator('#gazette-archive.has-metal-frame').waitFor();
  await page.screenshot({path: 'test-results/gazette-archive-desktop.png'});
  await page.getByRole('button', {name: '28 October 2026', exact: true}).click();
  await page.getByText('This issue could not be loaded. Please try again.', {exact: true}).waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-gazette-date'), '2026-10-29');
  await page.getByRole('button', {name: '28 October 2026', exact: true}).click();
  await page.locator('#gazette-archive').waitFor({state: 'hidden'});
  await page.locator('#room[data-gazette-date="2026-10-28"]').waitFor();
  assert.ok(Number(await page.locator('#room').getAttribute('data-gazette-pages')) > 1);
  assert.match(await page.locator('#gazette-transcript').textContent(), /An archived letter/);
  assert.match(await page.locator('#gazette-transcript').textContent(), /From the reading room/);
  await page.getByRole('button', {name: 'Next Gazette sheet'}).click();
  await page.locator('#room[data-gazette-page="1"]').waitFor();
  await page.locator('#desk').focus(); await page.keyboard.press('ArrowLeft');
  await page.locator('#room[data-gazette-page="0"]').waitFor();
  await page.screenshot({path: 'test-results/gazette-populated-fixture.png'});
  await page.getByRole('button', {name: 'Browse Gazette by date'}).click();
  await page.getByRole('button', {name: '29 October 2026', exact: true}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#room').getAttribute('data-gazette-reading'), 'true', 'Escape dismisses the date list before leaving reading');
  await page.keyboard.press('Escape'); await page.locator('#room[data-gazette-reading="false"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-gazette-date'), '2026-10-28');
  await page.getByRole('button', {name: 'Fold Gazette', exact: true}).click();
  await page.locator('#room[data-gazette-phase="closed"]').waitFor();
  assert.deepEqual(errors, []); await page.close();
});

test('touch unfolds the loose Gazette, enters reading only with its control, and restores the desk', async () => {
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce'});
  await page.goto(baseURL); await page.locator('#room.is-ready').waitFor({timeout: startupTimeout}); await nextFrame(page);
  await page.screenshot({path: 'test-results/gazette-folded-mobile.png'});
  const box = await page.locator('#gazette-hotspot').boundingBox(); await page.touchscreen.tap(box.x + 22, box.y + 22);
  await page.locator('#room[data-gazette-phase="open"]').waitFor();
  assert.equal(await page.locator('#room').getAttribute('data-gazette-reading'), 'false');
  await page.getByRole('button', {name: 'Read Gazette full screen', exact: true}).tap();
  await page.locator('#room[data-gazette-reading="true"]').waitFor();
  await page.screenshot({path: 'test-results/gazette-reader-mobile.png'});
  await page.getByRole('button', {name: 'Zoom in', exact: true}).tap();
  await page.getByRole('button', {name: 'Browse Gazette by date'}).tap();
  await page.locator('#gazette-archive.has-metal-frame').waitFor();
  await page.screenshot({path: 'test-results/gazette-archive-mobile.png'});
  assert.equal(await page.locator('#gazette-archive').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
  await page.getByRole('button', {name: '29 October 2026', exact: true}).tap();
  await page.getByRole('button', {name: 'Return to desk', exact: true}).tap();
  await page.locator('#room[data-gazette-reading="false"]').waitFor();
  await page.getByRole('button', {name: 'Fold Gazette', exact: true}).tap();
  await page.locator('#room[data-gazette-phase="closed"]').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.close();
});

test('the Gazette date archive and readable sections work without WebGL', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  await page.goto(baseURL); await page.locator('#room.is-fallback').waitFor();
  await page.getByRole('button', {name: 'Browse Gazette by date'}).click();
  await page.getByRole('button', {name: '29 October 2026', exact: true}).click();
  await page.locator('#gazette-fallback-text h3').first().waitFor();
  assert.equal(await page.locator('#gazette-fallback-text h3').count(), 6);
  assert.equal(await page.locator('#gazette-archive').evaluate(dialog => dialog.classList.contains('has-metal-frame')), false);
  await page.screenshot({path: 'test-results/gazette-archive-fallback.png'});
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#gazette-archive').isVisible(), false);
  await page.close();
});

test('turning printed leaves retain the ink-compressed paper surface on both faces', async () => {
  const page = await browser.newPage();
  await page.route(baseURL, route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Paper material proof</title>'}));
  await page.goto(baseURL);
  const proof = await page.evaluate(async () => {
    const { createBook } = await import('/src/book.js');
    const book = await createBook(0, 'A printed recto.\n---\nA printed verso.');
    book.motion.open(); book.animate(0, true); book.activate('next'); book.animate(.15, false);
    const front = book.group.getObjectByName('curling-paper-leaf'), back = book.group.getObjectByName('curling-paper-verso');
    const printed = [front, back].every(face => face.material.normalMap === null && face.material.bumpMap.isCanvasTexture && face.material.map.isCanvasTexture);
    book.animate(0, true); book.activate('next'); book.animate(.15, false);
    const blank = [front, back].every(face => Boolean(face.material.normalMap));
    return { printed, blank };
  });
  assert.deepEqual(proof, {printed: true, blank: true}); await page.close();
});
