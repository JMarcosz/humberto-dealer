'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Vehicle } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Gauge, Fuel, Settings2, Palette, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { getVehicleImageUrl, FALLBACK_VEHICLE_IMAGE } from '@/lib/vehicle-images'

function getImage(vehicle: Vehicle): string {
  return getVehicleImageUrl(vehicle.modelo, Number(vehicle.id), vehicle.imagenes[0])
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
          onError={() => setImgSrc(FALLBACK_VEHICLE_IMAGE)}
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
              <span>{process.env.NEXT_PUBLIC_BUSINESS_ADDRESS}</span>
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
