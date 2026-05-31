'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Marca } from '@/lib/types'
import { triggerTransition } from '@/components/transition-overlay'

// ── Configuración por marca ───────────────────────────────────────────────────
interface BrandConfig {
  favicon?: string       // dominio para Google favicon (si funciona bien)
  circleBg: string       // color del círculo contenedor
  circleText?: string    // color del texto si se usa badge
  abbr?: string          // abreviación para el badge
  svg?: string           // SVG inline (string) para logos sin fuente confiable
}

const BRANDS: Record<string, BrandConfig> = {
  'BMW':           { favicon: 'bmw.com',                circleBg: '#fff' },
  'TOYOTA':        { favicon: 'toyota.com',             circleBg: '#fff' },
  'HONDA':         { favicon: 'honda.com',              circleBg: '#fff' },
  'FORD':          { favicon: 'ford.com',               circleBg: '#fff' },
  'NISSAN': {
    circleBg: '#fff',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#888" stroke-width="3.5"/>
      <circle cx="50" cy="50" r="36" fill="none" stroke="#888" stroke-width="2"/>
      <rect x="4" y="42" width="92" height="16" fill="#fff" stroke="#888" stroke-width="2.5"/>
      <text x="50" y="55" text-anchor="middle" fill="#333" font-size="13" font-weight="bold" font-family="Arial,sans-serif" letter-spacing="1.5">NISSAN</text>
    </svg>`,
  },
  'CHEVROLET':     { favicon: 'chevrolet.com',          circleBg: '#fff' },
  'HYUNDAI':       { favicon: 'hyundai.com',            circleBg: '#fff' },
  'KIA':           { favicon: 'kia.com',                circleBg: '#fff' },
  'JEEP':          { favicon: 'jeep.com',               circleBg: '#fff' },
  'DODGE':         { favicon: 'dodge.com',              circleBg: '#fff' },
  'MAZDA':         { favicon: 'mazda.com',              circleBg: '#fff' },
  'VOLKSWAGEN':    { favicon: 'vw.com',                 circleBg: '#fff' },
  'LAND ROVER':    { favicon: 'landrover.com',          circleBg: '#fff' },
  'SUZUKI':        { favicon: 'suzuki.com',             circleBg: '#fff' },
  'GMC':           { favicon: 'gmc.com',                circleBg: '#fff' },
  'ACURA':         { favicon: 'acura.com',              circleBg: '#fff' },
  'LEXUS':         { favicon: 'lexus.com',              circleBg: '#1a1a1a' },
  'AUDI':          { favicon: 'audi.com',               circleBg: '#fff' },
  'PORSCHE':       { favicon: 'porsche.com',            circleBg: '#fff' },
  'SUBARU':        { favicon: 'subaru.com',             circleBg: '#fff' },
  'VOLVO':         { favicon: 'volvocars.com',          circleBg: '#fff' },
  'INFINITI':      { favicon: 'infiniti.com',           circleBg: '#fff' },
  'RAM':           { favicon: 'ramtrucks.com',          circleBg: '#fff' },

  // Mercedes — estrella de tres puntas sobre fondo oscuro
  'MERCEDES BENZ': {
    circleBg: '#1a1a1a',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#1a1a1a"/>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#aaa" stroke-width="2"/>
      <polygon points="50,50 44,22 50,6 56,22" fill="#ccc"/>
      <polygon points="50,50 44,22 50,6 56,22" transform="rotate(120,50,50)" fill="#ccc"/>
      <polygon points="50,50 44,22 50,6 56,22" transform="rotate(240,50,50)" fill="#ccc"/>
      <circle cx="50" cy="50" r="7" fill="#ccc"/>
    </svg>`,
  },

  // Ferrari — escudo amarillo oficial con franja roja y nombre
  'FERRARI': {
    circleBg: '#fff',
    svg: `<svg viewBox="0 0 100 115" xmlns="http://www.w3.org/2000/svg">
      <path d="M10,5 L90,5 L90,80 L50,110 L10,80 Z" fill="#FFD700"/>
      <path d="M10,5 L90,5 L90,22 L10,22 Z" fill="#CC0000"/>
      <path d="M10,22 L90,22 L90,26 L10,26 Z" fill="#009246"/>
      <path d="M10,26 L90,26 L90,30 L10,30 Z" fill="#fff"/>
      <path d="M10,30 L90,30 L90,34 L10,34 Z" fill="#CE2B37"/>
      <text x="50" y="19" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold" font-family="Arial" letter-spacing="1">FERRARI</text>
      <text x="50" y="72" text-anchor="middle" fill="#CC0000" font-size="22" font-weight="900" font-family="Georgia,serif" font-style="italic">SF</text>
    </svg>`,
  },

  // Lamborghini — escudo negro con detalle dorado
  'LAMBORGHINI': {
    circleBg: '#0d0d0d',
    svg: `<svg viewBox="0 0 100 115" xmlns="http://www.w3.org/2000/svg">
      <path d="M10,5 L90,5 L90,80 L50,110 L10,80 Z" fill="#0d0d0d" stroke="#DAA520" stroke-width="2.5"/>
      <path d="M10,5 L90,5 L90,22 L10,22 Z" fill="#DAA520"/>
      <text x="50" y="18" text-anchor="middle" fill="#0d0d0d" font-size="8" font-weight="bold" font-family="Arial" letter-spacing="0.5">LAMBORGHINI</text>
      <text x="50" y="62" text-anchor="middle" fill="#DAA520" font-size="28" font-weight="900" font-family="Georgia,serif">L</text>
      <line x1="20" y1="72" x2="80" y2="72" stroke="#DAA520" stroke-width="1"/>
      <text x="50" y="85" text-anchor="middle" fill="#DAA520" font-size="7" font-family="Arial" letter-spacing="1">AUTOMOBILI</text>
    </svg>`,
  },

  // Mitsubishi: favicon devuelve globo → SVG inline de los tres diamantes
  'MITSUBISHI': {
    circleBg: '#fff',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,2 62,24 50,46 38,24" fill="#CC0000"/>
      <polygon points="50,2 62,24 50,46 38,24" transform="rotate(120,50,50)" fill="#CC0000"/>
      <polygon points="50,2 62,24 50,46 38,24" transform="rotate(240,50,50)" fill="#CC0000"/>
    </svg>`,
  },
}

function normalize(s: string) {
  return s.toUpperCase().trim().replace(/[-\s]+/g, '')
}

function getConfig(nombre: string): BrandConfig | null {
  const upper = nombre.toUpperCase().trim()
  if (BRANDS[upper]) return BRANDS[upper]
  const norm = normalize(upper)
  const key = Object.keys(BRANDS).find(k => normalize(k) === norm)
  return key ? BRANDS[key] : null
}

function BrandLogo({ nombre, config }: { nombre: string; config: BrandConfig }) {
  const [failed, setFailed] = useState(false)

  // SVG inline (Mitsubishi, etc.)
  if (config.svg) {
    return (
      <div
        className="h-10 w-10 flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: config.svg }}
      />
    )
  }

  // Favicon de Google + fallback a badge
  if (config.favicon && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${config.favicon}&sz=128`}
        alt={nombre}
        className="h-9 w-9 object-contain"
        onError={() => setFailed(true)}
      />
    )
  }

  // Badge de letras con color de marca
  const abbr = config.abbr
    ?? nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-black"
      style={{ background: config.circleBg === '#fff' ? '#FF5500' : config.circleBg, color: config.circleText ?? '#fff' }}
    >
      {abbr.slice(0, 3)}
    </span>
  )
}

export function BrandNav() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const router = useRouter()

  useEffect(() => {
    api.getMarcas().then(setMarcas).catch(() => setMarcas([]))
  }, [])

  const handleBrandClick = (marca: Marca) => {
    triggerTransition()
    const url = `/?marca_id=${marca.id}&marca_nombre=${encodeURIComponent(marca.nombre)}`
    setTimeout(() => {
      router.push(url, { scroll: false })
      setTimeout(() => {
        document.getElementById('catalogo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
    }, 180)
  }

  // Deduplicar por nombre normalizado
  const unicas = marcas.filter((m, i, arr) =>
    arr.findIndex(x => normalize(x.nombre) === normalize(m.nombre)) === i
  )

  if (unicas.length === 0) return null

  return (
    <section id="marcas" className="py-10 bg-muted/30 border-y border-border/30">
      <div className="container mx-auto px-6 md:px-12">
        <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Explora por Marca
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          {unicas.map(marca => {
            const config = getConfig(marca.nombre)
            return (
              <button
                key={marca.id}
                onClick={() => handleBrandClick(marca)}
                title={marca.nombre}
                className="group relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-border/40 shadow-sm transition-all duration-200 hover:border-orange-500 hover:shadow-md hover:-translate-y-0.5"
                style={{ background: config?.circleBg ?? '#fff' }}
              >
                {config ? (
                  <BrandLogo nombre={marca.nombre} config={config} />
                ) : (
                  <span className="text-sm font-black" style={{ color: '#FF5500' }}>
                    {marca.nombre.charAt(0)}
                  </span>
                )}

                {/* Tooltip */}
                <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {marca.nombre}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
