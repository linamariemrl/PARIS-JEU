import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Paris-le-jeu/' : '/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
    manifest: {
      name: 'PARIS - Le jeu de la ville',
      short_name: 'PARIS',
      lang: 'fr',
      description: 'Maquette 3D monochrome de Paris et gestion municipale',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#f0f0f0', theme_color: '#273543',
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
        '**/data/metropole/overview/**'
      ],
      runtimeCaching: [{
        urlPattern: new RegExp('data/metropole/buildings/tiles/.*[.]json$'),
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
        urlPattern: new RegExp('data/metropole/trees/.*[.]bin
    }
  })]
});
),
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
