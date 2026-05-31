'use client'

import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
      style={{ background: '#FF5500', color: '#fff' }}
      aria-label="Volver al inicio"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}
