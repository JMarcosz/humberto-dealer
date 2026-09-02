'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Vehicle } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Calendar, Gauge, Fuel, Settings2 } from 'lucide-react'
import { getVehicleImageUrl, FALLBACK_VEHICLE_IMAGE } from '@/lib/vehicle-images'

export interface GroupedVehicle {
  modeloId: number
  marca: string
  modelo: string
  tipo: string
  units: Vehicle[]
  yearsAvailable: number[]
  totalUnits: number
}

export function groupVehicles(vehicles: Vehicle[]): GroupedVehicle[] {
  const map = new Map<number, Vehicle[]>()
  for (const v of vehicles) {
    const group = map.get(v.modeloId) ?? []
    group.push(v)
    map.set(v.modeloId, group)
  }

  return Array.from(map.entries()).map(([modeloId, units]) => {
    const sorted = [...units].sort((a, b) => b.año - a.año)
    const years = [...new Set(sorted.map(u => u.año))]
    return {
      modeloId,
      marca:          sorted[0].marca,
      modelo:         sorted[0].modelo,
      tipo:           sorted[0].tipo,
      units:          sorted,
      yearsAvailable: years,
      totalUnits:     units.length,
    }
  })
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const fmtKm = (n: number) => new Intl.NumberFormat('es-DO').format(n)

export function GroupedVehicleCard({
  group,
  mode = 'renta',
}: {
  group: GroupedVehicle
  mode?: 'renta' | 'venta' | 'ambos'
}) {
  const [selectedYear, setSelectedYear] = useState(group.yearsAvailable[0])

  const unitsForYear = group.units.filter(u => u.año === selectedYear)
  const representative = unitsForYear.reduce((cheapest, u) =>
    u.precio < cheapest.precio ? u : cheapest, unitsForYear[0])
  const minPrice = Math.min(...unitsForYear.map(u => u.precio))
  const multipleUnits = unitsForYear.length > 1

  const minTarifaDia = Math.min(
    ...unitsForYear.map(u => u.tarifa_renta?.precio_dia_base ?? 45)
  )
  const minTarifaSemana = Math.min(
    ...unitsForYear.map(u => u.tarifa_renta?.precio_semana_estimado ?? Math.round(minTarifaDia * 6))
  )

  const [imgSrc, setImgSrc] = useState(() =>
    getVehicleImageUrl(group.modelo, Number(representative.id), representative.imagenes[0])
  )

  const handleYearClick = (year: number) => {
    setSelectedYear(year)
    const newUnits = group.units.filter(u => u.año === year)
    const newRep = newUnits.reduce((c, u) => u.precio < c.precio ? u : c, newUnits[0])
    setImgSrc(getVehicleImageUrl(group.modelo, Number(newRep.id), newRep.imagenes[0]))
  }

  const esModoRenta = mode === 'renta' || mode === 'ambos'

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:border-orange-500/40">

      {/* Imagen */}
      <Link href={`/modelo/${group.modeloId}`} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={imgSrc}
          alt={`${group.marca} ${group.modelo}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          onError={() => setImgSrc(FALLBACK_VEHICLE_IMAGE)}
        />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-sm border border-white/10">
            {group.tipo}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-500 text-white">
            {group.totalUnits} {group.totalUnits === 1 ? 'unidad' : 'unidades'}
          </span>
        </div>
      </Link>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-4">

        {/* Título */}
        <Link href={`/modelo/${group.modeloId}`} className="mb-2 block">
          <h3 className="truncate text-base font-bold text-foreground group-hover:text-orange-500 transition-colors">
            {group.marca} {group.modelo}
          </h3>
        </Link>

        {/* Selector de años */}
        {group.yearsAvailable.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {group.yearsAvailable.map(year => (
              <button
                key={year}
                onClick={() => handleYearClick(year)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors min-h-[30px]"
                style={year === selectedYear
                  ? { background: '#FF5500', color: '#fff', borderColor: '#FF5500' }
                  : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                }
              >
                {year}
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">Año {selectedYear}</p>
        )}

        {/* Sección Precios según Modo */}
        {esModoRenta ? (
          <div className="mb-3 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-1">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 block">
                  Renta diaria desde
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    ${minTarifaDia.toFixed(0)}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    USD / día
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block">Semanal</span>
                <span className="text-xs font-bold text-foreground">
                  ${minTarifaSemana.toFixed(0)} USD
                </span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-muted-foreground flex justify-between border-t border-orange-500/15">
              <span>Km Ilimitado en RD</span>
              <span>O compra: <strong>{multipleUnits ? `Desde ${fmt(minPrice)}` : fmt(representative.precio)}</strong></span>
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <p className="mb-1 text-xl font-black" style={{ color: '#FF5500' }}>
              {multipleUnits ? `Desde ${fmt(minPrice)}` : fmt(representative.precio)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Disponible en renta desde: <strong className="text-foreground">${minTarifaDia.toFixed(0)} USD / día</strong>
            </p>
          </div>
        )}

        {/* Specs */}
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="h-3.5 w-3.5 text-orange-500" />
            {fmtKm(representative.kilometraje)} km
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="h-3.5 w-3.5 text-orange-500" />
            <span className="capitalize">{representative.combustible.toLowerCase()}</span>
          </span>
          <span className="flex items-center gap-1">
            <Settings2 className="h-3.5 w-3.5 text-orange-500" />
            <span className="capitalize">{representative.transmision.toLowerCase()}</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            {selectedYear}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <Link href={`/modelo/${group.modeloId}`}>
            <Button
              className="w-full rounded-lg font-bold tracking-wide hover:scale-[1.02] transition-transform"
              style={{ background: '#FF5500', color: '#fff', border: 'none' }}
            >
              {esModoRenta ? 'Cotizar Renta / Ver Unidades' : 'Ver detalles'}
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
