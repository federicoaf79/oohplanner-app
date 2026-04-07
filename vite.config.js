import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  optimizeDeps: {
    include: ['leaflet'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      // skipWaiting + clientsClaim: el SW nuevo se activa de inmediato
      // en lugar de esperar a que el usuario cierre todas las pestañas.
      // Esto evita que el SW viejo siga sirviendo un index.html cacheado
      // que referencia assets hasheados que ya no existen en el deploy nuevo.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'OOH Planner',
        short_name: 'OOHPlanner',
        description: 'Plataforma profesional para planificación de publicidad exterior',
        theme_color: '#2563EB',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
