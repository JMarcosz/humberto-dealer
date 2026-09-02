'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { RentalVehicle } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  Briefcase,
  Luggage,
  Fuel,
  Settings2,
  Check,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Wind
} from 'lucide-react'

interface RentalVehicleCardProps {
  vehicle: RentalVehicle
  fechaInicio: string
  fechaFin: string
  sucursalRecogidaId: string
  sucursalDevolucionId: string
}

export function RentalVehicleCard({
  vehicle,
  fechaInicio,
  fechaFin,
  sucursalRecogidaId,
  sucursalDevolucionId,
}: RentalVehicleCardProps) {
  const checkoutUrl = `/renta/checkout?vehiculo_id=${vehicle.id}&fecha_inicio=${encodeURIComponent(fechaInicio)}&fecha_fin=${encodeURIComponent(fechaFin)}&sucursal_recogida_id=${sucursalRecogidaId}&sucursal_devolucion_id=${sucursalDevolucionId}`

  // Categorías amigables
  const categoriaLabels: Record<string, string> = {
    SEDAN: 'Sedán Compacto / Cómodo',
    SUV: 'SUV / Camioneta Familiar',
    PICKUP: 'Pickup 4x4 Todo Terreno',
    VAN: 'Minivan / Pasajeros',
    COUPE: 'Coupé Deportivo',
    CONVERTIBLE: 'Convertible Premium',
    OTRO: 'Económico',
  }

  const catLabel = categoriaLabels[vehicle.categoria] || 'Estándar'
  const fallbackImg = '/placeholder.svg'
  const imgSrc = vehicle.imagen_principal || fallbackImg

  return (
    <Card className="overflow-hidden border-border/60 hover:border-orange-500/50 hover:shadow-xl transition-all duration-300 group bg-card">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
        {/* 1. Columna de Imagen */}
        <div className="md:col-span-4 relative bg-muted/20 min-h-[220px] md:min-h-full flex items-center justify-center p-4">
          <div className="relative w-full h-48 md:h-52">
            <Image
              src={imgSrc}
              alt={`${vehicle.marca} ${vehicle.modelo}`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <Badge className="absolute top-3 left-3 bg-zinc-900/90 text-zinc-100 border border-zinc-700 text-xs uppercase tracking-wider font-semibold">
            {vehicle.categoria}
          </Badge>
        </div>

        {/* 2. Columna de Especificaciones y Beneficios */}
        <div className="md:col-span-5 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border/50">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-orange-500 transition-colors">
                  {vehicle.marca} {vehicle.modelo}
                </h3>
                <p className="text-xs text-muted-foreground">{catLabel} • Modelo {vehicle.anio}</p>
              </div>
            </div>

            {/* Grilla de Capacidades */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 p-3 rounded-xl bg-muted/40 text-xs">
              <div className="flex items-center gap-1.5" title="Pasajeros">
                <Users className="h-4 w-4 text-orange-500 shrink-0" />
                <span>{vehicle.pasajeros} Asientos</span>
              </div>
              <div className="flex items-center gap-1.5" title="Maletas Grandes">
                <Luggage className="h-4 w-4 text-orange-500 shrink-0" />
                <span>{vehicle.maletas_grandes} Grandes</span>
              </div>
              <div className="flex items-center gap-1.5" title="Maletas Pequeñas / Mano">
                <Briefcase className="h-4 w-4 text-orange-500 shrink-0" />
                <span>{vehicle.maletas_pequenas} Mano</span>
              </div>
              <div className="flex items-center gap-1.5" title="Transmisión">
                <Settings2 className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="capitalize">{vehicle.transmision.toLowerCase()}</span>
              </div>
            </div>

            {/* Bullets de Beneficios (Kayak / Rentcars Style) */}
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                <Check className="h-3.5 w-3.5" />
                <span>Kilometraje Ilimitado en República Dominicana</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5 text-orange-500" />
                <span>Política de combustible: Lleno a Lleno</span>
              </div>
              {vehicle.tiene_aire_acondicionado && (
                <div className="flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5 text-blue-400" />
                  <span>Aire Acondicionado (A/C Climatizado)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Columna de Precio y Checkout */}
        <div className="md:col-span-3 p-5 flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-border/50 bg-muted/10">
          <div className="w-full text-right">
            <span className="text-xs text-muted-foreground font-medium">Precio por día</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-black text-foreground">
                ${vehicle.tarifa.precio_por_dia.toFixed(0)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase">{vehicle.tarifa.moneda} / día</span>
            </div>

            {/* Total acumulado por días */}
            <div className="mt-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-right">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                Total: ${vehicle.tarifa.total_estimado.toFixed(2)} {vehicle.tarifa.moneda}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Por {vehicle.tarifa.dias} {vehicle.tarifa.dias === 1 ? 'día' : 'días'} con impuestos
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">
              Depósito en tarjeta: <strong className="text-foreground">${vehicle.tarifa.deposito_garantia.toFixed(0)} {vehicle.tarifa.moneda}</strong>
            </p>
          </div>

          <div className="w-full mt-4">
            <Link href={checkoutUrl} className="block w-full">
              <Button
                className="w-full h-11 font-bold text-white shadow-md gap-2"
                style={{ background: '#FF5500', border: 'none' }}
              >
                <span>Seleccionar</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
