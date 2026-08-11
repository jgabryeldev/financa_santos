'use client'

import { useEffect } from 'react'

/** Registra o service worker (PWA). Versão nova limpa caches antigos que quebravam o login. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        await registration.update()
      } catch (err) {
        console.warn('[sw] falha ao registrar', err)
      }
    }

    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', () => void register(), { once: true })
    }
  }, [])

  return null
}
