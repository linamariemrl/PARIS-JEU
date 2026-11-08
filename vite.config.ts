import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Paris-le-jeu/' : '/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
    manifest: {
      name: 'PARIS SKYLINES - Le jeu de la ville',
      short_name: 'PARIS',
      lang: 'fr',
      description: 'Maquette 3D de Paris, arbres municipaux, espaces verts et gestion urbaine',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#e3e0d9', theme_color: '#273543',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,svg,webmanifest}'],
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      globIgnores: [
        '**/data/4e/aerial/**',
        '**/data/metropole/buildings/tiles/**',
        '**/data/metropole/overview/**',
        '**/data/metropole/surfaces/tiles/**'
      ],
      runtimeCaching: [{
        urlPattern: new RegExp('data/metropole/buildings/tiles/.*[.]json'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'metro-tiles-recentes',
          expiration: { maxEntries: 28, maxAgeSeconds: 60*60*24*14 }
        }
      }, {
        urlPattern: new RegExp('data/metropole/overview/.*'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'metro-overview-v1',
          expiration: { maxEntries: 95, maxAgeSeconds: 60*60*24*14 }
        }
      }, {
        urlPattern: new RegExp('data/metropole/surfaces/tiles/.*[.]json'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'paris-surfaces-geographiques-v1',
          expiration: { maxEntries: 22, maxAgeSeconds: 60*60*24*14 }
        }
      }, {
        urlPattern: new RegExp('data/metropole/trees/.*[.]bin'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'paris-arbres-municipaux-v1',
          expiration: { maxEntries: 45, maxAgeSeconds: 60*60*24*30 }
        }
      }],
      cleanupOutdatedCaches: true
    }
  })]
});
