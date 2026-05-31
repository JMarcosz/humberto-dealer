'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Vehicle } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Gauge, Fuel, Settings2, Palette, ChevronDown, ChevronUp, MapPin } from 'lucide-react'

// ── Imágenes por categoría y modelo ──────────────────────────────────────────
const MODEL_IMAGES: Record<string, string> = {
  // SUVs — Jeep
  'Grand Cherokee': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
  'Compass':        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80',
  'Patriot':        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
  // Ford
  'Escape':         'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&q=80',
  'Explorer':       'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
  'F-150':          'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'Fiesta':         'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80',
  'Focus':          'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800&q=80',
  'Venza':          'https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=800&q=80',
  // Hyundai
  'Santa Fe':       'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800&q=80',
  'Tucson':         'https://images.unsplash.com/photo-1574357125602-b7b0e26f895a?w=800&q=80',
  'Elantra':        'https://images.unsplash.com/photo-1526726538690-5cbf956ae2fd?w=800&q=80',
  'i20':            'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800&q=80',
  // Chevrolet
  'Equinox':        'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80',
  'Malibu':         'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80',
  'Spark':          'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80',
  'Trax':           'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
  // Land Rover
  'Range Rover':    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
  'Freelander':     'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
  // BMW
  'Serie 3':        'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
  'X5':             'https://images.unsplash.com/photo-1617654112368-307921291f42?w=800&q=80',
  // Mercedes
  'Clase C':        'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
  // Toyota
  '4Runner':        'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80',
  'Tacoma':         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'Highlander':     'https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=800&q=80',
  // Mazda
  'CX-9':           'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
  'CX-7':           'https://images.unsplash.com/photo-1574357125602-b7b0e26f895a?w=800&q=80',
  'CX-8':           'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800&q=80',
  // Dodge
  'Grand Caravan':  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
  'Caravan':        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
  'Durango':        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
  // Suzuki
  'Vitara':         'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
  'Grand Vitara':   'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800&q=80',
  // Nissan
  'Sentra':         'https://images.unsplash.com/photo-1526726538690-5cbf956ae2fd?w=800&q=80',
  'Pathfinder':     'https://images.unsplash.com/photo-1617654112368-307921291f42?w=800&q=80',
  'Navara':         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'Rogue':          'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
  'Note':           'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800&q=80',
  // Honda
  'Pilot':          'https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=800&q=80',
  'CR-V':           'https://images.unsplash.com/photo-1574357125602-b7b0e26f895a?w=800&q=80',
  'Fit':            'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80',
  'Civic':          'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80',
  // Kia
  'Soul':           'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
  'Sportage':       'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800&q=80',
  'K5':             'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80',
  // GMC / Mitsubishi / otros
  'Acadia':         'https://images.unsplash.com/photo-1617654112368-307921291f42?w=800&q=80',
  'Endeavor':       'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&q=80',
  'Montero':        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
  'Eclipse':        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
  'TL':             'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80',
  'Touareg':        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80',
}

const FALLBACK = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'

function getImage(vehicle: Vehicle): string {
  const first = vehicle.imagenes[0]
  if (first && !first.includes('placeholder')) return first
  return MODEL_IMAGES[vehicle.modelo] ?? FALLBACK
}

// ── Estilos de estado ─────────────────────────────────────────────────────────
const ESTADO_STYLES: Record<string, { badge: string; label: string }> = {
  disponible:          { badge: 'bg-green-500 text-white',  label: 'Disponible' },
  reservado:           { badge: 'bg-yellow-500 text-white', label: 'Reservado'  },
  vendido:             { badge: 'bg-red-600 text-white',    label: 'Vendido'    },
  pendiente_validacion:{ badge: 'bg-gray-500 text-white',   label: 'Pendiente'  },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const fmtKm = (n: number) => new Intl.NumberFormat('es-DO').format(n)

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const [imgSrc, setImgSrc]   = useState(() => getImage(vehicle))
  const [expanded, setExpanded] = useState(false)
  const estado = ESTADO_STYLES[vehicle.estado] ?? ESTADO_STYLES.disponible

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md">

      {/* ── Imagen ── */}
      <Link href={`/vehiculo/${vehicle.id}`} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={imgSrc}
          alt={`${vehicle.marca} ${vehicle.modelo} ${vehicle.año}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          onError={() => setImgSrc(FALLBACK)}
        />

        {/* Badge estado */}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${estado.badge}`}>
          {estado.label}
        </span>

        {/* Overlay vendido */}
        {vehicle.estado === 'vendido' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rotate-[-12deg] border-4 border-white px-6 py-2 text-2xl font-black tracking-widest text-white">
              VENDIDO
            </span>
          </div>
        )}
      </Link>

      {/* ── Cuerpo ── */}
      <div className="flex flex-1 flex-col p-4">

        {/* Título + precio */}
        <Link href={`/vehiculo/${vehicle.id}`} className="mb-1 block">
          <h3 className="truncate text-base font-bold text-foreground group-hover:text-orange-500 transition-colors">
            {vehicle.marca} {vehicle.modelo}
          </h3>
        </Link>
        <p className="mb-3 text-xl font-black" style={{ color: '#FF5500' }}>
          {fmt(vehicle.precio)}
        </p>

        {/* Specs en línea — siempre visibles */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            {vehicle.año}
          </span>
          <span className="flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5 text-orange-500" />
            {fmtKm(vehicle.kilometraje)} km
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="h-3.5 w-3.5 text-orange-500" />
            <span className="capitalize">{vehicle.combustible.toLowerCase()}</span>
          </span>
          <span className="flex items-center gap-1">
            <Settings2 className="h-3.5 w-3.5 text-orange-500" />
            <span className="capitalize">{vehicle.transmision.toLowerCase()}</span>
          </span>
        </div>

        {/* ── Sección plegable ── */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-orange-500 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Menos detalles' : 'Más detalles'}
        </button>

        {expanded && (
          <div className="mb-3 space-y-1 rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span>Color: <span className="capitalize font-medium text-foreground">{vehicle.color.toLowerCase()}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="ml-0.5 text-orange-500 font-bold text-[10px]">SUV</span>
              <span>Tipo: <span className="capitalize font-medium text-foreground">{vehicle.tipo}</span></span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
              <span>Prol. Av. 27 de Febrero 467, Santo Domingo</span>
            </div>
            {vehicle.descripcion && (
              <p className="mt-1 line-clamp-2 text-foreground/70">{vehicle.descripcion}</p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <Link href={`/vehiculo/${vehicle.id}`}>
            <Button
              className="w-full rounded-lg font-bold tracking-wide"
              style={vehicle.estado !== 'vendido' ? { background: '#FF5500', color: '#fff', border: 'none' } : {}}
              variant={vehicle.estado === 'vendido' ? 'secondary' : 'default'}
            >
              {vehicle.estado === 'vendido' ? 'Ver ficha' : 'Ver detalles'}
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
