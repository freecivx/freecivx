echo "Install and run Playwright"
cd freeciv-web
npm install @playwright/test --save-dev
npx playwright install
npx playwright test tests/playwright/freeciv-web.test.js
