import { defineConfig } from '@playwright/test';

import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'assessment-weight.browser.ts',
  workers: 1,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4175' },
  projects: base.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      ...(project.name === 'mobile-chromium' ? { viewport: { width: 375, height: 844 } } : {}),
    },
  })),
  webServer: [
    {
      command: 'bun e2e/assessment-weight-server.ts',
      url: 'http://127.0.0.1:4176/health',
      reuseExistingServer: false,
    },
    {
      command:
        'VITE_API_URL=http://127.0.0.1:4176 VITE_USE_FIXTURE=false bun run build && bun run preview --port 4175',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
