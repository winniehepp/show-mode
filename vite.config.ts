import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths, so the build works at any URL, including a GitHub Pages project site.
  base: './',
  plugins: [react()],
});
