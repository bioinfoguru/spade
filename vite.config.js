import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
        },
    },
    // Prevent vite from obscuring rust errors
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        watch: {
            // tell vite to ignore watching `src-tauri`
            ignored: ['**/src-tauri/**'],
        },
    },
});
