import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Dev builds ship source maps for easier DevTools debugging in the side
    // panel. Production builds (`NODE_ENV=production npm run build`) must not,
    // since the load-unpacked dist/ would otherwise expose the entire source.
    // No credentials live in this bundle, so a leak here is intel-only, but
    // shipping source by default is still a bad hackathon default.
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
