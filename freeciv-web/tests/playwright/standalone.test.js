const { test, expect } = require('@playwright/test');

test('Freeciv-web standalone client loads successfully', async ({ page }) => {
  // Set a longer timeout since 3D loading takes time
  test.setTimeout(60000);

  // Collect console messages for debugging
  const consoleMessages = [];
  const consoleErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text: text });
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  // Navigate to standalone page
  console.log('Navigating to standalone page...');
  const response = await page.goto('http://localhost:8080/freeciv-web-standalone.html');

  // Check if the page loaded successfully
  expect(response).toBeTruthy();
  expect(response.status()).toBeLessThan(400);
  console.log(`Page loaded with status: ${response.status()}`);

  // Check if the page title is correct
  const title = await page.title();
  console.log(`Page title: ${title}`);
  expect(title).toContain('FreecivWorld.net');
  expect(title).toContain('Standalone');

  // Wait for main game page div to be present
  const gamePage = page.locator('#game_page');
  await expect(gamePage).toBeAttached({ timeout: 5000 });
  console.log('Game page element is present');

  // Wait for canvas container to be present
  const mapcanvas = page.locator('#mapcanvas');
  await expect(mapcanvas).toBeAttached({ timeout: 10000 });
  console.log('Map canvas container is present');

  // Wait for jQuery to load
  await page.waitForFunction(() => {
    return typeof window.$ !== 'undefined' && typeof window.jQuery !== 'undefined';
  }, { timeout: 10000 });
  console.log('jQuery loaded');

  // Wait for Three.js to load
  await page.waitForFunction(() => {
    return typeof window.THREE !== 'undefined';
  }, { timeout: 15000 });
  console.log('Three.js loaded');

  // Wait for standalone mode to be initialized
  await page.waitForFunction(() => {
    return window.standalone_mode === true || window.is_standalone === true;
  }, { timeout: 5000 });
  console.log('Standalone mode is active');

  // Wait for mock data to initialize (check for map object)
  await page.waitForFunction(() => {
    return typeof window.map !== 'undefined' && window.map.xsize > 0;
  }, { timeout: 20000 });
  console.log('Mock data initialized');

  // Verify map dimensions
  const mapDimensions = await page.evaluate(() => {
    return { xsize: window.map.xsize, ysize: window.map.ysize };
  });
  console.log(`Map dimensions: ${mapDimensions.xsize}x${mapDimensions.ysize}`);
  expect(mapDimensions.xsize).toBeGreaterThan(0);
  expect(mapDimensions.ysize).toBeGreaterThan(0);

  // Wait for tiles to be created
  await page.waitForFunction(() => {
    return typeof window.tiles !== 'undefined' && Object.keys(window.tiles).length > 0;
  }, { timeout: 10000 });
  console.log('Tiles created');

  // Verify number of tiles
  const tileCount = await page.evaluate(() => {
    return Object.keys(window.tiles).length;
  });
  console.log(`Number of tiles: ${tileCount}`);
  expect(tileCount).toBe(mapDimensions.xsize * mapDimensions.ysize);

  // Wait for client state to be set to running
  await page.waitForFunction(() => {
    return typeof window.client !== 'undefined' && 
           typeof window.C_S_RUNNING !== 'undefined' &&
           window.client.conn.playing !== null;
  }, { timeout: 25000 });
  console.log('Client state is running');

  // Wait a bit for rendering to complete
  await page.waitForTimeout(5000);

  // Take a screenshot for visual validation
  await page.screenshot({ 
    path: 'test-results/standalone-client.png',
    fullPage: true 
  });
  console.log('Screenshot saved to test-results/standalone-client.png');

  // Log standalone-specific console messages
  const standaloneMessages = consoleMessages.filter(m => 
    m.text.includes('[Standalone]')
  );
  if (standaloneMessages.length > 0) {
    console.log('\nStandalone initialization messages:');
    standaloneMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });
  }

  // Report critical errors (ignore expected warnings)
  const criticalErrors = consoleErrors.filter(err => 
    !err.includes('404') && // Ignore 404s for missing assets
    !err.includes('THREE.BufferGeometry.computeBoundingSphere') && // Known non-critical warning
    !err.includes('Failed to load resource') // Ignore resource loading errors
  );
  
  if (criticalErrors.length > 0) {
    console.log('\nCritical console errors detected:');
    criticalErrors.forEach(err => console.log('  -', err));
  }

  console.log('\nStandalone client test completed successfully');
});

test('Standalone client UI elements are present', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:8080/freeciv-web-standalone.html');
  console.log('Testing UI elements...');

  // Wait for page to initialize
  await page.waitForTimeout(5000);

  // Check for tabs menu
  const tabsMenu = page.locator('#tabs_menu');
  await expect(tabsMenu).toBeAttached({ timeout: 5000 });
  console.log('Tabs menu is present');

  // Check for map tab
  const mapTab = page.locator('#map_tab');
  await expect(mapTab).toBeAttached();
  console.log('Map tab is present');

  // Check for tech tab
  const techTab = page.locator('#tech_tab');
  await expect(techTab).toBeAttached();
  console.log('Tech tab is present');

  // Check for cities tab
  const citiesTab = page.locator('#cities_tab');
  await expect(citiesTab).toBeAttached();
  console.log('Cities tab is present');

  // Check for game status panel
  const gameStatusPanel = page.locator('#game_status_panel_top');
  await expect(gameStatusPanel).toBeAttached();
  console.log('Game status panel is present');

  console.log('All UI elements test completed successfully');
});

test('Standalone client creates mock game data', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:8080/freeciv-web-standalone.html');
  console.log('Testing mock game data...');

  // Wait for mock data to be created
  await page.waitForFunction(() => {
    return typeof window.map !== 'undefined' && 
           typeof window.tiles !== 'undefined' &&
           typeof window.players !== 'undefined' &&
           typeof window.units !== 'undefined' &&
           typeof window.cities !== 'undefined';
  }, { timeout: 20000 });
  console.log('Mock data structures initialized');

  // Verify players were created
  const playerCount = await page.evaluate(() => {
    return Object.keys(window.players).length;
  });
  console.log(`Number of players: ${playerCount}`);
  expect(playerCount).toBeGreaterThan(0);

  // Verify cities were created
  const cityCount = await page.evaluate(() => {
    return Object.keys(window.cities).length;
  });
  console.log(`Number of cities: ${cityCount}`);
  expect(cityCount).toBeGreaterThan(0);

  // Verify units were created
  const unitCount = await page.evaluate(() => {
    return Object.keys(window.units).length;
  });
  console.log(`Number of units: ${unitCount}`);
  expect(unitCount).toBeGreaterThan(0);

  // Verify terrains were created
  const terrainCount = await page.evaluate(() => {
    return typeof window.terrains !== 'undefined' ? Object.keys(window.terrains).length : 0;
  });
  console.log(`Number of terrain types: ${terrainCount}`);
  expect(terrainCount).toBeGreaterThan(0);

  console.log('Mock game data test completed successfully');
});
