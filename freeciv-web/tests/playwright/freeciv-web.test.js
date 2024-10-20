const { test, expect } = require('@playwright/test');

test('Freeciv web homepage loads and has the correct title', async ({ page }) => {
  // Go to the Freeciv-web homepage (replace with your local or deployed URL)
  await page.goto('http://localhost:8080');
  
  // Check if the page title contains "Freeciv"
  const title = await page.title();
  console.log(`Page title: ${title}`);
  expect(title).toContain('FREECIVX');

  // Check if a key element is present on the page 
  const logo = await page.locator('img[alt="Freeciv-web"]');
  await expect(logo).toBeVisible();
});

