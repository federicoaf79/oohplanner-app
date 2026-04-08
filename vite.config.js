import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA deshabilitado temporalmente (Fase 2)
// El SW causaba pantalla blanca en producción al servir index.html
// cacheado que referenciaba assets hasheados ya no disponibles.
// Reactivar con vite-plugin-pwa cuando el producto esté estable.

export default defineConfig({
  base: '/',
  optimizeDeps: {
    include: ['leaflet'],
  },
  plugins: [
    react(),
  ],
})
