const { test, expect } = require('@playwright/test');

test('Freeciv-web standalone 3D environment loads', async ({ page }) => {
  // Set a longer timeout since 3D loading takes time
  test.setTimeout(60000);

  // Navigate to standalone page
  const response = await page.goto('http://localhost:8080/freeciv-web-standalone.html');

  // Check if the page loaded successfully
  if (!response || response.status() >= 400) {
    console.log(`Error: Server responded with status ${response ? response.status() : 'no response'}`);
    throw new Error(`Failed to load page: ${response ? response.status() : 'unknown error'}`);
  }

  // Check if the page title is correct
  const title = await page.title();
  console.log(`Page title: ${title}`);
  expect(title).toContain('Freeciv-web Standalone');

  // Wait for canvas element to be present
  const canvas = await page.locator('#mapcanvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });
  console.log('Canvas element is visible');

  // Wait for loading overlay to appear
  const loadingOverlay = await page.locator('#loading-overlay');
  await expect(loadingOverlay).toBeVisible({ timeout: 5000 });
  console.log('Loading overlay is visible');

  // Wait for Three.js to load
  await page.waitForFunction(() => {
    return typeof window.THREE !== 'undefined';
  }, { timeout: 10000 });
  console.log('Three.js loaded');

  // Wait for STANDALONE_MODE to be set
  await page.waitForFunction(() => {
    return window.STANDALONE_MODE === true;
  }, { timeout: 5000 });
  console.log('Standalone mode is active');

  // Wait for mock data to initialize (check for map object)
  await page.waitForFunction(() => {
    return typeof window.map !== 'undefined' && window.map.xsize > 0;
  }, { timeout: 15000 });
  console.log('Mock data initialized');

  // Wait for scene to be created
  await page.waitForFunction(() => {
    return typeof window.scene !== 'undefined' && window.scene !== null;
  }, { timeout: 15000 });
  console.log('3D scene created');

  // Wait a bit for rendering to start
  await page.waitForTimeout(3000);

  // Check console for errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Take a screenshot for proof
  await page.screenshot({ 
    path: 'freeciv-web/src/main/webapp/standalone/result.png',
    fullPage: false 
  });
  console.log('Screenshot saved to standalone/result.png');

  // Log any errors
  if (errors.length > 0) {
    console.log('Console errors detected:');
    errors.forEach(err => console.log('  -', err));
  }

  console.log('Standalone test completed successfully');
});

test('Test runner controls appear', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:8080/freeciv-web-standalone.html');

  // Wait for initialization
  await page.waitForTimeout(10000);

  // Check if test runner controls appear
  const testRunner = await page.locator('#test-runner-controls');
  await expect(testRunner).toBeVisible({ timeout: 10000 });
  console.log('Test runner controls are visible');
});

test('Screenshot controls appear', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:8080/freeciv-web-standalone.html');

  // Wait for initialization
  await page.waitForTimeout(8000);

  // Check if screenshot controls appear
  const screenshotControls = await page.locator('#screenshot-controls');
  await expect(screenshotControls).toBeVisible({ timeout: 10000 });
  console.log('Screenshot controls are visible');
});
