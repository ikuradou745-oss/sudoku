import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base path works universally across root domain and any GitHub Pages repo subpath
const base = process.env.BASE_PATH || './';

function htmlEntryPlugin(): Plugin {
  return {
    name: 'html-entry-plugin',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.server) {
          // Dev server: strip static bundle tags and inject live source entry
          return html
            .replace(
              /<link rel="stylesheet" crossorigin href="(\.\/assets\/index\.css[^"]*|\/assets\/index\.css[^"]*)">/,
              ''
            )
            .replace(
              /<script type="module" crossorigin src="(\.\/assets\/index\.js[^"]*|\/assets\/index\.js[^"]*)"><\/script>/,
              '<script type="module" src="/src/main.tsx"></script>'
            );
        }
        // Build mode: replace bundle script with source entry so Vite can compile it
        return html.replace(
          /<script type="module" crossorigin src="(\.\/assets\/index\.js[^"]*|\/assets\/index\.js[^"]*)"><\/script>/,
          '<script type="module" src="/src/main.tsx"></script>'
        );
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [htmlEntryPlugin(), react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});

