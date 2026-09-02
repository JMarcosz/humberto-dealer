'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Vehicle, Sucursal } from '@/lib/types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Fuel,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface VehicleRentalCalculatorProps {
  vehicle: Vehicle
}

export function VehicleRentalCalculator({ vehicle }: VehicleRentalCalculatorProps) {
  const router = useRouter()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalRecogida, setSucursalRecogida] = useState('1')
  const [sucursalDevolucion, setSucursalDevolucion] = useState('1')

  const defaultInicio = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const defaultFin = () => {
    const d = new Date()
    d.setDate(d.getDate() + 4)
    d.setHours(10, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const [fechaInicio, setFechaInicio] = useState(defaultInicio())
  const [fechaFin, setFechaFin] = useState(defaultFin())
  const [errorFechas, setErrorFechas] = useState<string | null>(null)

  useEffect(() => {
    api.getSucursales()
      .then((data) => {
        setSucursales(data)
        if (data.length > 0) {
          setSucursalRecogida(String(data[0].id))
          setSucursalDevolucion(String(data[0].id))
        }
      })
      .catch((err) => console.error(err))
  }, [])

  const renta = vehicle.tarifa_renta || {
    precio_dia_base: 45,
    precio_semana_estimado: 270,
    deposito_garantia: 500,
    moneda: 'USD',
    kilometraje_incluido: 'ILIMITADO',
    politica_combustible: 'LLENO_A_LLENO',
  }

  // Cálculo reactivo de duración
  const dInicio = new Date(fechaInicio)
  const dFin = new Date(fechaFin)
  const diffHours = (dFin.getTime() - dInicio.getTime()) / (1000 * 60 * 60)
  const dias = isNaN(diffHours) || diffHours < 1 ? 1 : Math.max(1, Math.ceil((diffHours - 0.98) / 24))
  const subtotalEstimado = dias * renta.precio_dia_base

  const handleReservar = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorFechas(null)

    if (diffHours < 23) {
      setErrorFechas('El alquiler mínimo es de 24 horas (1 día completo).')
      return
    }

    const params = new URLSearchParams({
      vehiculo_id: vehicle.id,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      sucursal_recogida_id: sucursalRecogida,
      sucursal_devolucion_id: sucursalDevolucion,
    })

    router.push(`/renta/checkout?${params.toString()}`)
  }

  return (
    <div className="rounded-2xl border-2 border-orange-500/30 bg-card p-5 md:p-6 shadow-xl space-y-5">
      {/* Encabezado con Tarifas */}
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="h-3 w-3" /> Tarifa de Alquiler
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-orange-600 dark:text-orange-400">
              ${renta.precio_dia_base.toFixed(0)}
            </span>
            <span className="text-sm font-bold text-muted-foreground uppercase">
              {renta.moneda} / día
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-muted-foreground block">Tarifa Semanal (7d)</span>
          <span className="text-base font-black text-foreground">
            ${renta.precio_semana_estimado.toFixed(0)} {renta.moneda}
          </span>
          <span className="text-[10px] text-green-600 font-bold block">Ahorras 15%</span>
        </div>
      </div>

      {/* Formulario de Cotización Rápida */}
      <form onSubmit={handleReservar} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-orange-500" /> Recogida
            </Label>
            <Select value={sucursalRecogida} onValueChange={setSucursalRecogida}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-orange-500" /> Devolución
            </Label>
            <Select value={sucursalDevolucion} onValueChange={setSucursalDevolucion}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-orange-500" /> Fecha y Hora Retiro
            </Label>
            <Input
              type="datetime-local"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-orange-500" /> Fecha y Hora Entrega
            </Label>
            <Input
              type="datetime-local"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="h-10 text-xs"
            />
          </div>
        </div>

        {errorFechas && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorFechas}</span>
          </div>
        )}

        {/* Resumen de Cotización en Vivo */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Período calculado:</span>
            <strong className="text-foreground">{dias} {dias === 1 ? 'día' : 'días'} de alquiler</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total estimado ({dias}d x ${renta.precio_dia_base.toFixed(0)}):</span>
            <strong className="text-base text-orange-600 dark:text-orange-400 font-black">
              ${subtotalEstimado.toFixed(2)} {renta.moneda}
            </strong>
          </div>
          <div className="flex justify-between items-center pt-1 border-t text-[11px] text-muted-foreground">
            <span>Depósito en tarjeta al retirar:</span>
            <strong className="text-foreground">${renta.deposito_garantia.toFixed(0)} {renta.moneda}</strong>
          </div>
        </div>

        {/* Beneficios */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Km Ilimitado en RD
          </span>
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" /> Seguro TPL Incluido
          </span>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-bold text-white shadow-lg gap-2"
          style={{ background: '#FF5500', border: 'none' }}
        >
          <span>Reservar este Auto</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
