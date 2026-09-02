'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Vehicle } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Gauge,
  Fuel,
  Settings2,
  Palette,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  Luggage,
  Briefcase,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react'
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

export function VehicleCard({
  vehicle,
  mode = 'renta',
}: {
  vehicle: Vehicle
  mode?: 'renta' | 'venta' | 'ambos'
}) {
  const [imgSrc, setImgSrc]   = useState(() => getImage(vehicle))
  const [expanded, setExpanded] = useState(false)
  const estado = ESTADO_STYLES[vehicle.estado] ?? ESTADO_STYLES.disponible

  const renta = vehicle.tarifa_renta || {
    precio_dia_base: 45,
    precio_semana_estimado: 270,
    deposito_garantia: 500,
    moneda: 'USD',
    kilometraje_incluido: 'ILIMITADO',
    politica_combustible: 'LLENO_A_LLENO',
  }

  const esModoRenta = mode === 'renta' || (mode === 'ambos' && vehicle.disponible_para !== 'VENTA')

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:border-orange-500/40">

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

        {/* Badge categoría / estado */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${estado.badge}`}>
            {estado.label}
          </span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-sm border border-white/10">
            {vehicle.tipo}
          </span>
        </div>

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

        {/* Título */}
        <Link href={`/vehiculo/${vehicle.id}`} className="mb-2 block">
          <h3 className="truncate text-base font-bold text-foreground group-hover:text-orange-500 transition-colors">
            {vehicle.marca} {vehicle.modelo}
          </h3>
        </Link>

        {/* ── SECCIÓN DE PRECIO SEGÚN MODO ── */}
        {esModoRenta ? (
          <div className="mb-3 space-y-1.5">
            {/* Tarifa Diaria y Semanal */}
            <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 block">
                    Tarifa de Renta
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      ${renta.precio_dia_base.toFixed(0)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase">
                      {renta.moneda} / día
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Semanal (7 días)</span>
                  <span className="text-xs font-bold text-foreground">
                    ${renta.precio_semana_estimado.toFixed(0)} {renta.moneda}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-orange-500/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Depósito fianza: <strong>${renta.deposito_garantia.toFixed(0)} {renta.moneda}</strong></span>
                <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Seguro TPL
                </span>
              </div>
            </div>

            {vehicle.precio > 0 && (
              <p className="text-[11px] text-muted-foreground text-right">
                O precio de venta: <span className="font-semibold text-foreground">{fmt(vehicle.precio)}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-xl font-black" style={{ color: '#FF5500' }}>
              {fmt(vehicle.precio)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Disponible en renta: <strong className="text-foreground">${renta.precio_dia_base.toFixed(0)} USD / día</strong>
            </p>
          </div>
        )}

        {/* Capacidades de Renta (Asientos, Maletas) + Motor */}
        <div className="mb-3 grid grid-cols-4 gap-1.5 text-center p-2 rounded-lg bg-muted/40 text-[11px] text-muted-foreground">
          <div className="flex flex-col items-center justify-center gap-0.5" title="Pasajeros">
            <Users className="h-3.5 w-3.5 text-orange-500" />
            <span>{vehicle.pasajeros || 5} pax</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5" title="Maletas Grandes">
            <Luggage className="h-3.5 w-3.5 text-orange-500" />
            <span>{vehicle.maletas_grandes || 2} grand.</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5" title="Maletas Pequeñas / Mano">
            <Briefcase className="h-3.5 w-3.5 text-orange-500" />
            <span>{vehicle.maletas_pequenas || 2} mano</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5" title="Transmisión">
            <Settings2 className="h-3.5 w-3.5 text-orange-500" />
            <span className="capitalize truncate">{vehicle.transmision.toLowerCase().slice(0, 5)}</span>
          </div>
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
          <div className="mb-3 space-y-1.5 rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span>Año modelo:</span>
              <span className="font-semibold text-foreground">{vehicle.año}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Combustible:</span>
              <span className="capitalize font-semibold text-foreground">{vehicle.combustible.toLowerCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Kilometraje de renta:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">Ilimitado en RD</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Combustible entrega:</span>
              <span className="font-semibold text-foreground">Lleno a Lleno</span>
            </div>
            <div className="flex items-start gap-1.5 pt-1 border-t border-border/50">
              <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight">{process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || 'Santo Domingo, RD'}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto">
          <Link href={`/vehiculo/${vehicle.id}`}>
            <Button
              className="w-full rounded-lg font-bold tracking-wide gap-1.5 shadow-md hover:scale-[1.02] transition-transform"
              style={vehicle.estado !== 'vendido' ? { background: '#FF5500', color: '#fff', border: 'none' } : {}}
              variant={vehicle.estado === 'vendido' ? 'secondary' : 'default'}
            >
              <span>{esModoRenta ? 'Rentar / Cotizar' : 'Ver detalles'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
