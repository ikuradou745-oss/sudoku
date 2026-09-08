import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Automatically handle GitHub Pages repository subpath /sudoku/
const base = process.env.BASE_PATH || (process.env.GITHUB_ACTIONS ? '/sudoku/' : './');

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
