const { test, expect } = require('@playwright/test');

test('Freeciv web homepage loads and has the correct title', async ({ page }) => {
  // Go to the Freeciv-web homepage
  const response = await page.goto('http://localhost/');

  // Check if the page has loaded successfully
  if (!response || response.status() >= 400) {
    console.log(`Error: Server responded with status ${response ? response.status() : 'no response'}`);

    const htmlContent = await page.content();
    console.log('Page HTML content:', htmlContent);

    throw new Error(`Failed to load page: ${response ? response.status() : 'unknown error'}`);
  }

  const htmlContent = await page.content();
  console.log('Page HTML content:', htmlContent);

  // Check if the page title contains "FreecivWorld.net"
  const title = await page.title();
  console.log(`Page title: ${title}`);
  expect(title).toContain('FreecivWorld.net');

  // Check if a key element (the Freeciv-web logo) is visible on the page
  const logo = await page.locator('img[alt="FreecivWorld"]');
  await expect(logo).toBeVisible();
});
