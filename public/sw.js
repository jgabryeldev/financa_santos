/* Service worker mínimo (installabilidade PWA).
   NÃO intercepta navegações nem rotas do Next — isso quebrava cookies do Supabase
   e forçava login a cada abertura. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Deixa o browser lidar com páginas/RSC/auth (preserva Set-Cookie).
  if (event.request.mode === 'navigate') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return
  if (url.pathname.startsWith('/login')) return

  // Handler "não vazio" só para assets estáticos (critério do Chrome).
  if (
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|svg|jpe?g|webp|ico|gif)$/i.test(url.pathname)
  ) {
    event.respondWith(fetch(event.request))
  }
})
