import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    setupFiles: ['./scripts/vitest-setup.ts'],
    passWithNoTests: false,
  },
});
