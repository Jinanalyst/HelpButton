import { readdirSync, mkdirSync, renameSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const appDir = join(distDir, 'app');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run vite build first');
  process.exit(1);
}

const publicNames = new Set(readdirSync('public'));
mkdirSync(appDir, { recursive: true });

for (const entry of readdirSync(distDir)) {
  if (entry === 'app' || publicNames.has(entry)) continue;
  renameSync(join(distDir, entry), join(appDir, entry));
}

// Vite's `base: '/app/'` rewrites every `/foo.png` reference in index.html and
// the PWA manifest to `/app/foo.png`. Mirror the assets those references need
// into dist/app/ so they resolve when the app is served from /app/.
const appAssets = [
  'icon.svg',
  'favicon.ico',
  'favicon.svg',
  'apple-touch-icon-180x180.png',
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
];
for (const name of appAssets) {
  const src = join(distDir, name);
  if (existsSync(src)) copyFileSync(src, join(appDir, name));
}

console.log('Moved Vite build output and mirrored PWA assets into dist/app/');
