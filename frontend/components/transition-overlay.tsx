'use client'

import { useEffect, useState } from 'react'

export function triggerTransition() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('section-transition'))
  }
}

export function TransitionOverlay() {
  const [phase, setPhase] = useState<'idle' | 'in' | 'out'>('idle')

  useEffect(() => {
    const handler = () => {
      setPhase('in')
      setTimeout(() => setPhase('out'), 320)
      setTimeout(() => setPhase('idle'), 700)
    }
    window.addEventListener('section-transition', handler)
    return () => window.removeEventListener('section-transition', handler)
  }, [])

  if (phase === 'idle') return null

  return (
    <>
      {/* Barra naranja que barre de izquierda a derecha */}
      <div
        className="fixed inset-x-0 top-0 z-[200] h-[3px] bg-orange-500"
        style={{
          transformOrigin: 'left center',
          animation: phase === 'in'
            ? 'sweep-in 0.32s cubic-bezier(0.4,0,0.2,1) forwards'
            : 'sweep-out 0.35s cubic-bezier(0.4,0,0.2,1) forwards',
        }}
      />
      {/* Flash de ambiente negro semitransparente */}
      <div
        className="fixed inset-0 z-[199] bg-black pointer-events-none"
        style={{
          animation: phase === 'in'
            ? 'flash-in 0.32s ease forwards'
            : 'flash-out 0.35s ease forwards',
        }}
      />
      <style>{`
        @keyframes sweep-in {
          from { transform: scaleX(0); opacity: 1; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        @keyframes sweep-out {
          from { transform: scaleX(1); opacity: 1; }
          to   { transform: scaleX(1); opacity: 0; }
        }
        @keyframes flash-in {
          from { opacity: 0; }
          to   { opacity: 0.25; }
        }
        @keyframes flash-out {
          from { opacity: 0.25; }
          to   { opacity: 0; }
        }
      `}</style>
    </>
  )
}
