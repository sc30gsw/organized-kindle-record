import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
