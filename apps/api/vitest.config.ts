import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Each route test boots PGlite (WASM Postgres) and runs migrations; the first one in a
  // file is slow when the whole workspace's tests run in parallel.
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
