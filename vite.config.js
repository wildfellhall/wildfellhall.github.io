import { defineConfig } from 'vite';
import { gazettePlugin } from './scripts/gazette-catalog.mjs';

export default defineConfig({
  base: './',
  plugins: [gazettePlugin()],
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
