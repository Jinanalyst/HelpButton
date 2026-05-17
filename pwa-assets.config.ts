import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates PNG icons from public/icon.svg.
// Run: npx pwa-assets-generator --preset minimal-2023 public/icon.svg
// Or:  npm run generate-pwa-assets
//
// Outputs to public/ (precached by vite-plugin-pwa):
//   - favicon.ico, apple-touch-icon-180x180.png
//   - pwa-64x64.png, pwa-192x192.png, pwa-512x512.png
//   - maskable-icon-512x512.png

export default defineConfig({
  preset,
  images: ['public/icon.svg'],
});
