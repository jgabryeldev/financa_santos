/* Service worker mínimo para instalação PWA (WebAPK) no Chrome Android.
   Sem um fetch handler, o Chrome costuma criar só um atalho que abre na aba do browser. */
const VERSION = 'financas-sw-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Network-first: não intercepta de forma agressiva; só garante o handler exigido pelo Chrome.
  event.respondWith(
    fetch(event.request).catch(async () => {
      if (event.request.mode === 'navigate') {
        return new Response(
          '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finanças</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;padding:24px;text-align:center}p{opacity:.7}</style></head><body><div><h1>Sem conexão</h1><p>Abra de novo quando estiver online.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
      return Response.error()
    })
  )
})
