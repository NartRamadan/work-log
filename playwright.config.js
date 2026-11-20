// Playwright settings for the work-log app tests.
// Run all tests: npm test
// Requirements on this computer: Python (for the web server) and Google Chrome.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Start a local web server before the tests. Stop it after the tests.
  // --bind 127.0.0.1: only this computer can open the server, not the local network.
  webServer: {
    command: 'python -m http.server 8766 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8766/index.html',
    // If a server from an earlier run is still open, use it. Do not fail.
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://127.0.0.1:8766/',
  },
  projects: [
    // The user works on an Android phone, so test with a phone screen size.
    // channel 'chrome': use the Google Chrome that is installed on this computer.
    // This removes the need to download a separate Chromium.
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
});
