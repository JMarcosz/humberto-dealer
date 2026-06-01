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

export function GroupedVehicleCard({ group }: { group: GroupedVehicle }) {
  const [selectedYear, setSelectedYear] = useState(group.yearsAvailable[0])

  const unitsForYear = group.units.filter(u => u.año === selectedYear)
  const representative = unitsForYear.reduce((cheapest, u) =>
    u.precio < cheapest.precio ? u : cheapest, unitsForYear[0])
  const minPrice = Math.min(...unitsForYear.map(u => u.precio))
  const multipleUnits = unitsForYear.length > 1

  const [imgSrc, setImgSrc] = useState(() =>
    getVehicleImageUrl(group.modelo, Number(representative.id), representative.imagenes[0])
  )

  const handleYearClick = (year: number) => {
    setSelectedYear(year)
    const newUnits = group.units.filter(u => u.año === year)
    const newRep = newUnits.reduce((c, u) => u.precio < c.precio ? u : c, newUnits[0])
    setImgSrc(getVehicleImageUrl(group.modelo, Number(newRep.id), newRep.imagenes[0]))
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md">

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
        {group.totalUnits > 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
            {group.totalUnits} unidades
          </span>
        )}
      </Link>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-4">

        {/* Título */}
        <Link href={`/modelo/${group.modeloId}`} className="mb-1 block">
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
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors min-h-[32px]"
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

        {/* Precio */}
        <p className="mb-1 text-xl font-black" style={{ color: '#FF5500' }}>
          {multipleUnits ? `Desde ${fmt(minPrice)}` : fmt(representative.precio)}
        </p>
        {multipleUnits && (
          <p className="mb-2 text-xs text-muted-foreground">
            {unitsForYear.length} unidades disponibles en {selectedYear}
          </p>
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
              className="w-full rounded-lg font-bold tracking-wide"
              style={{ background: '#FF5500', color: '#fff', border: 'none' }}
            >
              Ver detalles
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}
