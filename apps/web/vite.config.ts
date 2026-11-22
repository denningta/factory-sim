import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // pnpm can resolve three separately for drei/fiber and for us; two copies break `instanceof`
  // checks and materials, so force one.
  resolve: { dedupe: ['three'] },
  // Dev only: the API listens on 8080 (PORT default); same-origin cookies then just work.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'jsdom' },
});
