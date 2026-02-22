const { test, expect } = require('@playwright/test');

test('OverlayScrollbars are initialized correctly', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log('Browser console:', msg.text()));
  page.on('pageerror', err => console.error('Browser error:', err));

  // Go to the standalone page
  await page.goto('http://localhost:8080/freeciv-web-standalone.html', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });

  // Wait for OverlayScrollbarsGlobal to be defined
  await page.waitForFunction(() => typeof window.OverlayScrollbarsGlobal !== 'undefined', {
    timeout: 10000
  });

  // Check if OverlayScrollbarsGlobal is defined
  const overlayScrollbarsGlobalDefined = await page.evaluate(() => {
    return typeof window.OverlayScrollbarsGlobal !== 'undefined';
  });
  console.log('OverlayScrollbarsGlobal defined:', overlayScrollbarsGlobalDefined);
  expect(overlayScrollbarsGlobalDefined).toBe(true);

  // Check if scrollbar instances were created
  const scrollbarInstances = await page.evaluate(() => {
    return Object.keys(window.scrollbar_instances || {});
  });
  console.log('Scrollbar instances:', scrollbarInstances);

  // Check if the scrollbar elements have the OverlayScrollbars data attributes
  const pregameHasOverlay = await page.evaluate(() => {
    const elem = document.querySelector('#pregame_custom_scrollbar_div');
    return elem && elem.hasAttribute('data-overlayscrollbars');
  });
  console.log('Pregame scrollbar initialized:', pregameHasOverlay);

  const gameHasOverlay = await page.evaluate(() => {
    const elem = document.querySelector('#freeciv_custom_scrollbar_div');
    return elem && elem.hasAttribute('data-overlayscrollbars');
  });
  console.log('Game scrollbar initialized:', gameHasOverlay);

  // At least one scrollbar should be initialized (depending on which page is visible)
  expect(pregameHasOverlay || gameHasOverlay).toBe(true);

  // Take a screenshot to verify visual appearance
  await page.screenshot({ path: '/tmp/scrollbar-test.png', fullPage: true });
  console.log('Screenshot saved to /tmp/scrollbar-test.png');
});
