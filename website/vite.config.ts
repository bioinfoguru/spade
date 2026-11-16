import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const websiteRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: websiteRoot,
  base: '/',
  plugins: [vue()],
  publicDir: resolve(websiteRoot, 'public'),
  build: {
    outDir: resolve(websiteRoot, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
});
