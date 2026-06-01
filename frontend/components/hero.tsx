'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { triggerTransition } from '@/components/transition-overlay'

const BRANDS = ['MITSUBISHI', 'LEXUS', 'BMW']

export function Hero() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  const goTo = (id: string) => {
    triggerTransition()
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 180)
  }

  return (
    <section
      className="relative flex min-h-[94vh] flex-col items-center justify-center overflow-hidden bg-black"
      aria-label="Hero"
    >
      {/* Grid perspectiva — solo CSS */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hero-grid" />
      </div>

      {/* Línea scan */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #FF5500 50%, transparent)', animation: 'scan 5s linear infinite' }}
        aria-hidden
      />

      {/* Orbe naranja difuso */}
      <div
        className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 h-[380px] w-[380px] rounded-full"
        style={{ background: 'radial-gradient(circle, #FF550033 0%, transparent 70%)' }}
        aria-hidden
      />

      {/* ─── CONTENIDO ─── */}
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center">

        {/* Línea naranja superior — aparece primero */}
        <div
          className="hero-line mb-10 h-px w-16 bg-orange-500"
          style={{ '--d': '0ms' } as React.CSSProperties}
          data-v={visible}
        />

        {/* Título principal — dos líneas enormes */}
        <h1
          className="hero-item font-black uppercase leading-none tracking-tighter text-white"
          style={{ '--d': '100ms', fontSize: 'clamp(3rem, 10vw, 8rem)' } as React.CSSProperties}
          data-v={visible}
        >
          HUMBERTO
        </h1>
        <h1
          className="hero-item font-black uppercase leading-none tracking-tighter"
          style={{ '--d': '180ms', fontSize: 'clamp(3rem, 10vw, 8rem)', color: '#FF5500' } as React.CSSProperties}
          data-v={visible}
        >
          AUTO IMPORT
        </h1>

        {/* Línea naranja divisora — crece desde el centro */}
        <div
          className="hero-line my-8 h-px bg-orange-500"
          style={{ '--d': '300ms', width: '100%', maxWidth: '480px' } as React.CSSProperties}
          data-v={visible}
        />

        {/* Marcas */}
        <p
          className="hero-item text-sm font-bold uppercase tracking-[0.5em] text-white/50"
          style={{ '--d': '380ms' } as React.CSSProperties}
          data-v={visible}
        >
          {BRANDS.join(' · ')}
        </p>

        {/* Subtítulo */}
        <p
          className="hero-item mt-4 max-w-md text-base text-white/35"
          style={{ '--d': '460ms' } as React.CSSProperties}
          data-v={visible}
        >
          Importación directa · Garantía total · Financiamiento disponible
        </p>

        {/* CTAs */}
        <div
          className="hero-item mt-10 flex flex-wrap justify-center gap-4"
          style={{ '--d': '560ms' } as React.CSSProperties}
          data-v={visible}
        >
          <Button
            size="lg"
            onClick={() => goTo('catalogo-section')}
            className="rounded-none px-10 font-bold tracking-widest uppercase text-sm"
            style={{ background: '#FF5500', color: '#fff', border: 'none' }}
          >
            Ver Catálogo
          </Button>
          <button
            onClick={() => goTo('marcas')}
            className="hero-btn-outline px-10 py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors duration-200"
            style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'transparent' }}
          >
            Nuestras Marcas
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => goTo('catalogo-section')}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/25 transition-colors hover:text-orange-500"
        aria-label="Scroll al catálogo"
      >
        <span className="text-xs font-bold tracking-[0.4em] uppercase">Explorar</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </button>

      <style>{`
        .hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,85,0,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,85,0,0.05) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 75% 55% at 50% 50%, black 20%, transparent 100%);
        }

        @keyframes scan {
          0%   { transform: translateY(0vh);   opacity: 0; }
          4%   { opacity: 1; }
          96%  { opacity: 1; }
          100% { transform: translateY(94vh);  opacity: 0; }
        }

        /* Cascade fade-up */
        .hero-item {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
          transition-delay: var(--d, 0ms);
        }
        .hero-item[data-v='true'] {
          opacity: 1;
          transform: translateY(0);
        }

        /* Botón outline del hero — siempre blanco sobre negro */
        .hero-btn-outline:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: #FF5500 !important;
          color: #FF5500;
        }

        /* Línea que crece desde el centro */
        .hero-line {
          opacity: 0;
          transform: scaleX(0);
          transform-origin: center;
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.4,0,0.2,1);
          transition-delay: var(--d, 0ms);
        }
        .hero-line[data-v='true'] {
          opacity: 1;
          transform: scaleX(1);
        }
      `}</style>
    </section>
  )
}
