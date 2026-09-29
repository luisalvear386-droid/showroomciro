import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /*
     * PWA offline-first del mostrador (Módulo 11, design.md → "Modo Offline-First").
     *
     * El Service Worker solo guarda la app (JS, CSS, HTML, íconos) y las fotos/fuentes que se
     * van viendo. Los datos NO: ninguna llamada a la API de Supabase (REST, RPC, Auth) pasa por
     * su caché; lo que hace falta sin conexión lo guarda la app en IndexedDB (src/lib/db-local.ts).
     * Qué pantallas funcionan sin conexión lo decide la app, no el Service Worker: todas las
     * rutas son el mismo index.html.
     */
    VitePWA({
      // Una versión nueva se activa sola, pero la página recién se recarga en el login (fin del
      // turno), nunca a mitad de una venta: ver src/lib/actualizacion-pwa.ts
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ShowroomCiro',
        short_name: 'ShowroomCiro',
        description: 'Sistema de gestión de Ciro Rey Showroom',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Fondo de la pantalla de carga: el negro del ícono
        background_color: '#000000',
        theme_color: '#fffcf7',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // El logo ya viene dentro del 80% central (zona segura): sirve también como maskable
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA: cualquier ruta (/, /ventas, /caja…) sin conexión se sirve con index.html
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Una versión nueva se activa apenas se instala, sin esperar mensajes de la página
        // (vite-plugin-pwa 1.3 no lo agrega solo en modo autoUpdate).
        skipWaiting: true,
        // Toma el control de las páginas abiertas apenas se activa: la primera visita ya queda
        // controlada (guarda fuentes y fotos) y una versión nueva empieza a servir sus archivos.
        // La página sigue con el código con el que cargó hasta la recarga en el login.
        clientsClaim: true,
        runtimeCaching: [
          {
            // Fotos de producto (bucket público `fotos-productos`). Llevan ?v=<timestamp>, así que
            // una foto nueva es otra URL: se pueden servir de la caché sin revalidar.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fotos-productos',
              // Las <img> sin CORS vuelven "opacas" (status 0): se aceptan, pero cada una ocupa
              // más cuota del navegador, por eso el tope es moderado
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          // Todo lo demás de Supabase (/rest, /rpc, /auth) no tiene regla: va siempre a la red.
        ],
      },
    }),
  ],
})
