import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Paris-le-jeu/' : '/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [],
    manifest: {
      name: 'PARIS - Le jeu de la ville',
      short_name: 'PARIS',
      lang: 'fr',
      description: 'Prototype 3D du 4e arrondissement.',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#0c1723', theme_color: '#0c1723'
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,svg,webmanifest}'],
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      cleanupOutdatedCaches: true
    }
  })]
});
