'use client'

import { useEffect, useRef, useState } from 'react'
import { Shield, Truck, CreditCard, Headphones, Award, MapPin, Star, RefreshCw, ChevronDown } from 'lucide-react'

// ── Hook scroll-reveal ────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref  = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ── Datos ─────────────────────────────────────────────────────────────────────
const STATS = [
  { value: '15+',    label: 'Años en el mercado'      },
  { value: '110+',   label: 'Vehículos disponibles'   },
  { value: '1,200+', label: 'Clientes satisfechos'    },
  { value: '100%',   label: 'Documentación en regla'  },
]

const FEATURES = [
  { icon: Truck,       title: 'Importación Directa',         desc: 'Traemos los vehículos directamente sin intermediarios, garantizando el mejor precio del mercado dominicano.' },
  { icon: Shield,      title: 'Garantía Total',               desc: 'Cada vehículo pasa por una inspección exhaustiva de más de 150 puntos antes de ser publicado en nuestro catálogo.' },
  { icon: CreditCard,  title: 'Financiamiento Disponible',    desc: 'Te ayudamos a encontrar el plan de financiamiento que mejor se adapta a tu presupuesto y perfil crediticio.' },
  { icon: Headphones,  title: 'Atención Personalizada',       desc: 'Nuestro equipo de expertos está disponible para asesorarte en cada paso del proceso de compra o reserva.' },
  { icon: Award,       title: 'Más de 15 Años de Experiencia',desc: 'Desde 2010 somos referente en importación de vehículos en República Dominicana, con miles de clientes satisfechos.' },
  { icon: MapPin,      title: 'Ubicación Céntrica',           desc: `Nos encontramos en ${process.env.NEXT_PUBLIC_BUSINESS_ADDRESS} — fácil acceso desde cualquier punto de la ciudad.` },
  { icon: Star,        title: 'Vehículos Verificados',        desc: 'Todos nuestros vehículos tienen historial verificado, documentación en regla y están libres de gravámenes.' },
  { icon: RefreshCw,   title: 'Inventario Actualizado',       desc: 'Renovamos nuestro inventario constantemente para ofrecerte siempre las mejores opciones del mercado de importación.' },
]

// ─────────────────────────────────────────────────────────────────────────────
export function WhyUs() {
  // Hero — cascade al montar
  const [heroVisible, setHeroVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Secciones scroll-reveal
  const about  = useInView()
  const stats  = useInView()
  const why    = useInView()
  const cards  = useInView(0.05)

  const scrollToContent = () => {
    document.getElementById('nosotros-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative overflow-hidden bg-[#080c14]">

      {/* ══════════════════════════════════════════════════════════════
          HERO — mismo sistema que la página principal
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[48vh] flex-col items-center justify-center overflow-hidden">

        {/* Grid perspectiva */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="nos-grid" />
        </div>

        {/* Línea scan — viene de la izquierda */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-px"
          style={{ background: 'linear-gradient(180deg,transparent,#FF5500 50%,transparent)', animation: 'nos-scan 6s linear infinite' }}
          aria-hidden
        />

        {/* Orbe naranja */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[260px] w-[260px] rounded-full"
          style={{ background: 'radial-gradient(circle,#FF550028 0%,transparent 70%)' }}
          aria-hidden
        />

        {/* Contenido hero */}
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center">

          {/* Línea superior */}
          <div
            className="nos-line mb-5 h-px w-10 bg-orange-500"
            style={{ '--d': '0ms' } as React.CSSProperties}
            data-v={heroVisible}
          />

          {/* Etiqueta */}
          <p
            className="nos-item mb-3 text-xs font-bold uppercase tracking-[0.5em] text-orange-500"
            style={{ '--d': '80ms' } as React.CSSProperties}
            data-v={heroVisible}
          >
            Conócenos
          </p>

          {/* Título grande */}
          <h1
            className="nos-item font-black uppercase leading-none tracking-tighter text-white"
            style={{ '--d': '160ms', fontSize: 'clamp(2rem,6vw,4.5rem)' } as React.CSSProperties}
            data-v={heroVisible}
          >
            NOSOTROS
          </h1>

          {/* Línea divisora */}
          <div
            className="nos-line my-5 h-px bg-orange-500"
            style={{ '--d': '280ms', width: '100%', maxWidth: '300px' } as React.CSSProperties}
            data-v={heroVisible}
          />

          {/* Subtítulo */}
          <p
            className="nos-item text-xs font-bold uppercase tracking-[0.35em] text-white/50"
            style={{ '--d': '360ms' } as React.CSSProperties}
            data-v={heroVisible}
          >
            Humberto Auto Import SRL
          </p>

          <p
            className="nos-item mt-3 max-w-lg text-sm text-white/35 leading-relaxed"
            style={{ '--d': '440ms' } as React.CSSProperties}
            data-v={heroVisible}
          >
            Tu concesionaria de confianza desde 2010 — importación directa,
            garantía total y financiamiento disponible.
          </p>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={scrollToContent}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/25 transition-colors hover:text-orange-500"
          aria-label="Ver más"
        >
          <span className="text-xs font-bold tracking-[0.4em] uppercase">Explorar</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </button>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          QUIÉNES SOMOS
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="nosotros-content"
        className="pointer-events-none h-px w-full"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,85,0,0.3) 50%,transparent)' }}
      />

      <section className="container relative z-10 mx-auto px-6 py-20 md:px-16">

        {/* Texto quiénes somos */}
        <div
          ref={about.ref}
          className="mb-16 grid gap-10 lg:grid-cols-2 lg:items-center"
        >
          <div
            className="nos-reveal"
            style={{ '--rd': '0ms' } as React.CSSProperties}
            data-v={about.inView}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-orange-500">
              Quiénes somos
            </p>
            <h2 className="text-3xl font-black leading-tight text-white md:text-4xl">
              Humberto Auto Import SRL
            </h2>
            <div className="mt-4 h-px w-16 bg-orange-500" />
            <p className="mt-6 text-white/60 leading-relaxed">
              Somos una concesionaria dominicana especializada en la importación directa de
              vehículos de alta calidad. Desde 2010 operamos en Santo Domingo ofreciendo el
              mejor inventario de vehículos importados al mejor precio del mercado.
            </p>
            <p className="mt-4 text-white/60 leading-relaxed">
              Nuestro compromiso es brindarte una experiencia de compra transparente, segura
              y sin complicaciones. Cada vehículo en nuestro catálogo ha sido seleccionado
              cuidadosamente para garantizarte calidad y confianza.
            </p>
            <p className="mt-4 text-white/60 leading-relaxed">
              Contamos con un equipo de profesionales especializados en importación,
              financiamiento y atención al cliente, listos para acompañarte desde la primera
              consulta hasta la entrega de tu vehículo.
            </p>
          </div>

          {/* Stats */}
          <div
            ref={stats.ref}
            className="grid grid-cols-2 gap-4"
          >
            {STATS.map(({ value, label }, i) => (
              <div
                key={label}
                className="nos-reveal rounded-2xl border border-white/10 p-6 text-center"
                style={{
                  '--rd': `${i * 80}ms`,
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(12px)',
                } as React.CSSProperties}
                data-v={stats.inView}
              >
                <div className="text-3xl font-black" style={{ color: '#FF5500' }}>{value}</div>
                <div className="mt-1 text-xs text-white/50 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Separador */}
        <div className="mb-14 h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,85,0,0.25) 50%,transparent)' }} />

        {/* Título "Por qué elegirnos" */}
        <div
          ref={why.ref}
          className="nos-reveal mb-12 text-center"
          style={{ '--rd': '0ms' } as React.CSSProperties}
          data-v={why.inView}
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-orange-500">
            Nuestras ventajas
          </p>
          <h2 className="text-3xl font-black text-white md:text-4xl">¿Por qué elegirnos?</h2>
          <div className="mx-auto mt-4 h-px w-16 bg-orange-500" />
        </div>

        {/* Cards */}
        <div ref={cards.ref} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="nos-reveal group rounded-2xl border border-white/10 p-6 transition-all duration-300 hover:border-orange-500/40 hover:-translate-y-1"
              style={{
                '--rd': `${i * 55}ms`,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              } as React.CSSProperties}
              data-v={cards.inView}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 group-hover:bg-orange-500/25"
                style={{ background: 'rgba(255,85,0,0.15)', border: '1px solid rgba(255,85,0,0.3)' }}
              >
                <Icon className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Estilos ────────────────────────────────────────────────────────── */}
      <style>{`
        /* Grid de fondo */
        .nos-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,85,0,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,85,0,0.05) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%);
        }

        /* Línea scan — de izquierda a derecha */
        @keyframes nos-scan {
          0%   { transform: translateX(0vw);   opacity: 0; }
          4%   { opacity: 1; }
          96%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }

        /* Hero — fade-up en cascada (igual que hero principal) */
        .nos-item {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
          transition-delay: var(--d, 0ms);
        }
        .nos-item[data-v='true'] {
          opacity: 1;
          transform: translateY(0);
        }

        /* Hero — línea que crece desde el centro */
        .nos-line {
          opacity: 0;
          transform: scaleX(0);
          transform-origin: center;
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.4,0,0.2,1);
          transition-delay: var(--d, 0ms);
        }
        .nos-line[data-v='true'] {
          opacity: 1;
          transform: scaleX(1);
        }

        /* Scroll reveal — secciones inferiores */
        .nos-reveal {
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2,0,0.1,1);
          transition-delay: var(--rd, 0ms);
        }
        .nos-reveal[data-v='true'] {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}
