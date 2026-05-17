import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vite-plugin-pwa injects:
//   - <link rel="manifest"> into index.html
//   - service worker registration script
//   - precaches build assets so the app boots offline
//
// The generated manifest replaces public/manifest.webmanifest — we delete that file.
// PWABuilder.com and Bubblewrap read this manifest at the deployed URL to build the APK.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Files in public/ that should also be precached.
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'privacy.html'],
      manifest: {
        name: '헬프버튼',
        short_name: '헬프버튼',
        description: '시니어를 위한 음성 도우미. 누르고 말씀하시면 도와드려요.',
        lang: 'ko-KR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F8FA',
        theme_color: '#0BA5B7',
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        // Never cache the API — always network. Avoids stale Claude responses.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
