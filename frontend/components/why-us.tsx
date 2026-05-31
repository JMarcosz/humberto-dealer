'use client'

import { Shield, Truck, CreditCard, Headphones, Award, MapPin, Star, RefreshCw } from 'lucide-react'

const FEATURES = [
  {
    icon: Truck,
    title: 'Importación Directa',
    desc: 'Traemos los vehículos directamente sin intermediarios, garantizando el mejor precio del mercado dominicano.',
  },
  {
    icon: Shield,
    title: 'Garantía Total',
    desc: 'Cada vehículo pasa por una inspección exhaustiva de más de 150 puntos antes de ser publicado en nuestro catálogo.',
  },
  {
    icon: CreditCard,
    title: 'Financiamiento Disponible',
    desc: 'Te ayudamos a encontrar el plan de financiamiento que mejor se adapta a tu presupuesto y perfil crediticio.',
  },
  {
    icon: Headphones,
    title: 'Atención Personalizada',
    desc: 'Nuestro equipo de expertos está disponible para asesorarte en cada paso del proceso de compra o reserva.',
  },
  {
    icon: Award,
    title: 'Más de 15 Años de Experiencia',
    desc: 'Desde 2010 somos referente en importación de vehículos en República Dominicana, con miles de clientes satisfechos.',
  },
  {
    icon: MapPin,
    title: 'Ubicación Céntrica',
    desc: 'Nos encontramos en Prol. Av. 27 de Febrero 467, Santo Domingo — fácil acceso desde cualquier punto de la ciudad.',
  },
  {
    icon: Star,
    title: 'Vehículos Verificados',
    desc: 'Todos nuestros vehículos tienen historial verificado, documentación en regla y están libres de gravámenes.',
  },
  {
    icon: RefreshCw,
    title: 'Inventario Actualizado',
    desc: 'Renovamos nuestro inventario constantemente para ofrecerte siempre las mejores opciones del mercado de importación.',
  },
]

export function WhyUs() {
  return (
    <section className="relative overflow-hidden py-20">
      {/* Fondo con gradiente oscuro */}
      <div className="absolute inset-0 bg-[#080c14]" />
      <div className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(255,85,0,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="container relative z-10 mx-auto px-6 md:px-16">
        {/* ── Quiénes somos ── */}
        <div className="mb-16 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-orange-500">
              Quiénes somos
            </p>
            <h2 className="text-3xl font-black leading-tight text-white md:text-4xl">
              Humberto Auto Import SRL
            </h2>
            <div className="mt-4 h-px w-16 bg-orange-500" />
            <p className="mt-6 text-white/60 leading-relaxed">
              Somos una concesionaria dominicana especializada en la importación directa de vehículos de alta calidad.
              Desde 2010 operamos en Santo Domingo ofreciendo el mejor inventario de vehículos importados al mejor precio del mercado.
            </p>
            <p className="mt-4 text-white/60 leading-relaxed">
              Nuestro compromiso es brindarte una experiencia de compra transparente, segura y sin complicaciones.
              Cada vehículo en nuestro catálogo ha sido seleccionado cuidadosamente para garantizarte calidad y confianza.
            </p>
            <p className="mt-4 text-white/60 leading-relaxed">
              Contamos con un equipo de profesionales especializados en importación, financiamiento y atención al cliente,
              listos para acompañarte desde la primera consulta hasta la entrega de tu vehículo.
            </p>
          </div>

          {/* Stats glass */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '15+', label: 'Años en el mercado' },
              { value: '110+', label: 'Vehículos disponibles' },
              { value: '1,200+', label: 'Clientes satisfechos' },
              { value: '100%', label: 'Documentación en regla' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 p-6 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
              >
                <div className="text-3xl font-black" style={{ color: '#FF5500' }}>{value}</div>
                <div className="mt-1 text-xs text-white/50 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Por qué elegirnos ── */}
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.4em] text-orange-500">
            Nuestras ventajas
          </p>
          <h2 className="text-3xl font-black text-white md:text-4xl">
            ¿Por qué elegirnos?
          </h2>
          <div className="mx-auto mt-4 h-px w-16 bg-orange-500" />
        </div>

        {/* Grid de cards con glass */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/10 p-6 transition-all duration-300 hover:border-orange-500/40 hover:-translate-y-1"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: 'rgba(255,85,0,0.15)', border: '1px solid rgba(255,85,0,0.3)' }}
              >
                <Icon className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
