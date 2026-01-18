const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('Loading page...');
  await page.goto('http://localhost:8080/freeciv-web-standalone.html');
  
  console.log('Waiting for scene...');
  await page.waitForFunction(() => window.scene && window.maprenderer, { timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('Extracting WebGL canvas data...');
  const base64 = await page.evaluate(() => {
    try {
      const dataURL = capture_screenshot();
      return dataURL ? dataURL.split(',')[1] : null;
    } catch (e) {
      console.error('Error:', e);
      return null;
    }
  });
  
  if (base64) {
    const buffer = Buffer.from(base64, 'base64');
    const outPath = './proof-images/freeciv-3d-map.png';
    fs.mkdirSync('./proof-images', { recursive: true });
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ Saved to ${outPath} (${buffer.length} bytes)`);
  } else {
    console.error('✗ Failed to capture screenshot');
  }
  
  await browser.close();
})();
