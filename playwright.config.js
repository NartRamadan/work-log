// Playwright settings for the work-log app tests.
// Run all tests: npm test
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Start a local web server before the tests. Stop it after the tests.
  webServer: {
    command: 'python -m http.server 8766',
    url: 'http://localhost:8766/index.html',
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:8766/',
    // Use the Google Chrome that is installed on this computer.
    // This removes the need to download a separate Chromium.
    channel: 'chrome',
  },
  projects: [
    // The user works on an Android phone, so test with a phone screen size.
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
});
