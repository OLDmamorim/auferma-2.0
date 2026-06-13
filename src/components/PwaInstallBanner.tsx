'use client'
import { useEffect, useState } from 'react'

type Platform = 'android' | 'ios' | 'desktop' | null

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)
  const [platform, setPlatform] = useState<Platform>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }
    if (sessionStorage.getItem('pwa-dismissed')) {
      setDismissed(true)
      return
    }

    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const isAndroid = /Android/.test(ua)

    if (isIOS) {
      setPlatform('ios')
    } else if (isAndroid) {
      // Will be set when beforeinstallprompt fires
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  // Don't show if installed, dismissed, or iOS without safari hint
  if (installed || dismissed) return null

  // iOS: show manual instructions (no beforeinstallprompt on Safari)
  if (platform === 'ios') {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
        <img src="/icon-96.png" alt="Auferma" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instalar Auferma</p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
            Toque em{' '}
            <span className="inline-flex items-center gap-0.5 bg-gray-700 px-1.5 py-0.5 rounded text-xs">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l-1.5 4.5H4l5.5 4-2 6 4.5-3 4.5 3-2-6 5.5-4h-6.5z" /></svg>
              Partilhar
            </span>{' '}
            e depois <strong>"Adicionar ao ecrã de início"</strong>
          </p>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-white p-1 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  // Android / Desktop: native prompt
  if (platform && prompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex gap-3 items-center">
        <img src="/icon-96.png" alt="Auferma" className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instalar Auferma</p>
          <p className="text-xs text-gray-300 mt-0.5">Instala a app para acesso rápido e uso offline</p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={install}
            className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-white text-xs px-3 py-1 rounded-lg transition text-center"
          >
            Agora não
          </button>
        </div>
      </div>
    )
  }

  return null
}
