echo "Install and run Playwright"
java --version

cd freeciv-web
npm install @playwright/test --save-dev
npx playwright install

# Run main freeciv-web test
npx playwright test tests/playwright/freeciv-web.test.js

# Run standalone client test
echo "Starting standalone client test server..."
cd target/freeciv-web
python3 -m http.server 8080 > /tmp/standalone-server.log 2>&1 &
SERVER_PID=$!
echo "Test server started with PID $SERVER_PID"

# Wait for server to be ready
sleep 5

# Run standalone test
cd ../..
echo "Running standalone client Playwright test..."
npx playwright test tests/playwright/standalone.test.js

# Stop test server
echo "Stopping test server (PID $SERVER_PID)..."
kill $SERVER_PID 2>/dev/null || true
echo "Standalone client tests completed"
