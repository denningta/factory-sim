import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**', 'packages/*/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts'],
      reporter: ['text-summary', 'lcov'],
      // ADR-0012: engine coverage >= 90%.
      thresholds: {
        'packages/sim-engine/src/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
