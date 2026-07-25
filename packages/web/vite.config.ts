import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Daybook',
        short_name: 'Daybook',
        description:
          'Daily cashbook: cash and MoMo in, money out, close the day and reconcile.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F7F8F5',
        theme_color: '#F7F8F5',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // png/webmanifest are auto-added by the plugin (manifest icons);
        // listing them again creates conflicting precache entries that kill
        // the service worker install.
        globPatterns: ['**/*.{js,css,html,woff2,svg}'],
      },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:4000' },
    // Dev-only: lets a temporary cloudflared tunnel reach the preview server
    // for phone testing. Production is nginx serving static files.
    allowedHosts: ['.trycloudflare.com'],
  },
});
