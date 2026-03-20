import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression guard: workbox runtimeCaching must NOT intercept external image
// URLs. A CacheFirst/StaleWhileRevalidate route for images causes "no-response"
// service worker errors when fetches fail (e.g. channel avatars from external
// servers), breaking the Avatar component's onError fallback.
//
// Context: channel avatars are set via IRCv3 METADATA and point to arbitrary
// external URLs (e.g. https://simpleircclient.com/assets/test-image.webp). When the
// service worker intercepted these with respondWith() and the fetch failed, it
// rejected the promise — producing a hard error instead of letting the browser
// handle the failure natively (which would fire <img> onError and show the
// Avatar fallback letter).
test('vite config has no runtimeCaching for image URLs', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(currentDir, '../../vite.config.ts');
  const config = readFileSync(configPath, 'utf8');

  // runtimeCaching with image URL patterns must not exist — it causes the
  // service worker to intercept and reject external image fetches instead of
  // letting the browser handle them natively.
  expect(config).not.toMatch(/runtimeCaching[\s\S]*?\.(png|jpg|jpeg|gif|webp|svg)/);
});
