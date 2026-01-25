echo "Install and run Playwright"
java --version

cd freeciv-web
npm install @playwright/test --save-dev
npx playwright install

# Run main freeciv-web test
npx playwright test tests/playwright/freeciv-web.test.js