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
      description: 'Prototype 3D du 4e arrondissement.',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#0c1723', theme_color: '#0c1723',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,svg,webmanifest}'],
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      runtimeCaching: [{
        urlPattern: new RegExp('data/metropole/buildings/tiles/.*[.]json
        handler: 'CacheFirst',
        options:{cacheName:'metro-tiles-recentes',
          expiration:{maxEntries:28,maxAgeSeconds:60*60*24*14}}
      }],
      cleanupOutdatedCaches: true,
      globIgnores: ['**/data/4e/aerial/**','**/data/metropole/buildings/tiles/**']
    }
  })]
});
),
        handler: 'CacheFirst',
        options:{cacheName:'metro-tiles-recentes',
          expiration:{maxEntries:28,maxAgeSeconds:60*60*24*14}}
      }],
      cleanupOutdatedCaches: true,
      globIgnores: ['**/data/4e/aerial/**','**/data/metropole/buildings/tiles/**']
    }
  })]
});
