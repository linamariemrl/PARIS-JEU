import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.CAPACITOR_BUILD === 'true' ? './' :
    process.env.GITHUB_ACTIONS === 'true' ? '/Paris-le-jeu/' : '/',
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
    manifest: {
      id: './',
      name: 'PARIS SKYLINES - Le jeu de la ville',
      short_name: 'PARIS',
      lang: 'fr',
      description: 'PARIS SKYLINES, rendu stable, gestion municipale et atlas des lieux',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#e3e0d9', theme_color: '#273543',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,svg,webmanifest}',
        'data/metropole/coverage/*.{bin,json}',
        'data/metropole/terrain/elevation.bin'],
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      globIgnores: [
        '**/data/4e/aerial/**',
        '**/data/metropole/buildings/tiles/**',
        '**/data/metropole/overview/**',
        '**/data/metropole/surfaces/**',
        // Grille altimétrique IGN de petite taille préchargée.
        '**/data/metropole/trees/**',
        '**/data/metropole/places/**'
      ],
      runtimeCaching: [{
        urlPattern: new RegExp('data/metropole/(?:coverage|terrain)/.*'),
        handler: 'CacheFirst',
        options: {cacheName:'paris-socle-geographique-025',
          expiration:{maxEntries:100,maxAgeSeconds:60*60*24*60}}
      }, {
        urlPattern: new RegExp('data/metropole/surfaces/(?:water|green)[.]json'),
        handler: 'StaleWhileRevalidate',
        options: {cacheName:'paris-nature-officielle-025',
          expiration:{maxEntries:6,maxAgeSeconds:60*60*24*30}}
      }, {
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
