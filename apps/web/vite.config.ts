import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // pnpm can resolve three separately for drei/fiber and for us; two copies break `instanceof`
  // checks and materials, so force one.
  resolve: { dedupe: ['three'] },
  test: { environment: 'jsdom' },
});
