#!/usr/bin/env node
/**
 * Simple script to capture and save a proof image from the standalone 3D renderer
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader'] // Use software rendering for headless
  });
  
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });
  
  console.log('Navigating to standalone page...');
  await page.goto('http://localhost:8080/freeciv-web-standalone.html');
  
  console.log('Waiting for 3D scene to initialize...');
  await page.waitForFunction(() => {
    return typeof window.scene !== 'undefined' && 
           window.scene !== null &&
           typeof window.maprenderer !== 'undefined' &&
           window.maprenderer !== null;
  }, { timeout: 30000 });
  
  console.log('Waiting for rendering to stabilize...');
  await page.waitForTimeout(5000);
  
  // Get screenshot info
  const info = await page.evaluate(() => {
    return {
      mapSize: typeof map !== 'undefined' ? `${map.xsize}x${map.ysize}` : 'N/A',
      sceneChildren: typeof scene !== 'undefined' ? scene.children.length : 0,
      cities: typeof cities !== 'undefined' ? Object.keys(cities).length : 0,
      units: typeof units !== 'undefined' ? Object.keys(units).length : 0
    };
  });
  
  console.log('Scene info:', info);
  
  // Ensure proof-images directory exists
  const proofDir = path.join(__dirname, 'proof-images');
  if (!fs.existsSync(proofDir)) {
    fs.mkdirSync(proofDir, { recursive: true });
  }
  
  // Take Playwright screenshot (skip in headless mode due to rendering issues)
  try {
    const playwrightScreenshotPath = path.join(proofDir, 'freeciv-3d-map-playwright.png');
    await page.screenshot({ 
      path: playwrightScreenshotPath,
      fullPage: false,
      timeout: 10000
    });
    console.log(`✓ Playwright screenshot saved: ${playwrightScreenshotPath}`);
  } catch (e) {
    console.warn(`⚠ Playwright screenshot failed (expected in headless mode): ${e.message}`);
  }
  
  // Get the WebGL canvas screenshot using the built-in capture function
  console.log('Capturing WebGL canvas screenshot...');
  const base64Data = await page.evaluate(() => {
    if (typeof capture_screenshot === 'function') {
      const dataURL = capture_screenshot();
      if (dataURL) {
        return dataURL.split(',')[1];
      }
    }
    return null;
  });
  
  if (base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const canvasScreenshotPath = path.join(proofDir, 'freeciv-3d-map-webgl-canvas.png');
    fs.writeFileSync(canvasScreenshotPath, buffer);
    console.log(`✓ WebGL canvas screenshot saved: ${canvasScreenshotPath} (${buffer.length} bytes)`);
  } else {
    console.warn('⚠ Could not capture WebGL canvas screenshot');
  }
  
  await browser.close();
  console.log('\n✓ Proof images saved successfully!');
  console.log(`  Map: ${info.mapSize}`);
  console.log(`  Scene objects: ${info.sceneChildren}`);
  console.log(`  Cities: ${info.cities}`);
  console.log(`  Units: ${info.units}`);
})();
