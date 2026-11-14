import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// En GitHub Pages la app vive en /ADLab/; en local se sirve desde la raíz
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/ADLab/' : '/',
  plugins: [react(), tailwindcss()],
});
