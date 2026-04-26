import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: './', 
  server: {
    cors: {
      // the origin you will be accessing via browser
      origin: 'http://localhost:5173',
    },
  },
  build: {
    // generate .vite/manifest.json in outDir
    manifest: true,
    rollupOptions: {
      // overwrite default .html entry
      input: '../server/index.js',
    },
  },
});
