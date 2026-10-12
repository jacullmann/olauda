import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import Components from 'unplugin-vue-components/vite';

// The theme must be known before first paint, so this stays a classic blocking
// script; the CSP forbids inline scripts, and nginx serves .js as immutable,
// hence the content hash in the URL.
function themeInitScript(): Plugin {
  const fileName = 'theme-init.js';
  let base = '/';
  let publicDir = '';

  return {
    name: 'theme-init-script',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    transformIndexHtml() {
      const source = readFileSync(path.join(publicDir, fileName));
      const hash = createHash('sha256')
        .update(source)
        .digest('hex')
        .slice(0, 8);
      return [
        {
          tag: 'script',
          attrs: { src: `${base}${fileName}?v=${hash}` },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    themeInitScript(),
    vue(),
    tailwindcss(),
    Components({
      dirs: ['src/common/components'],
      extensions: ['vue'],
      dts: true,
    }),
  ],
  // Lets vue-i18n tree-shake its legacy (Options) API, which the app never uses.
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // With VITE_API_URL=/api the browser only talks to this origin, so the app
    // also works from other devices on the network. The server rate-limits by
    // X-Forwarded-For, which nginx sets in production and xfwd sets here.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        xfwd: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
