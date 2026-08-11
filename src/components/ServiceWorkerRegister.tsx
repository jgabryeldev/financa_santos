'use client'

import { useEffect } from 'react'

/** Registra o service worker necessário para o Chrome Android instalar como WebAPK (tela cheia). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
      } catch (err) {
        console.warn('[sw] falha ao registrar', err)
      }
    }

    // Evita competir com o carregamento inicial
    if (document.readyState === 'complete') {
      void register()
    } else {
      window.addEventListener('load', () => void register(), { once: true })
    }
  }, [])

  return null
}
