import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    colorScheme: 'light',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(executablePath === undefined ? {} : { launchOptions: { executablePath } }),
  },
  projects: [
    {
      name: 'fixture-desktop',
      grep: /@fixture/,
      grepInvert: /@mobile/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'fixture-mobile',
      grep: /@mobile/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'real-http',
      grep: /@real-http/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4175',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command:
        'bun ./node_modules/vite/bin/vite.js build --mode a11y --outDir dist-playwright-fixture && bun ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist-playwright-fixture',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'bun e2e/assessment-weight-server.ts',
      url: 'http://127.0.0.1:4176/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        'VITE_API_URL=http://127.0.0.1:4176 VITE_USE_FIXTURE=false bun ./node_modules/vite/bin/vite.js build --outDir dist-playwright-http && bun ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort --outDir dist-playwright-http',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
