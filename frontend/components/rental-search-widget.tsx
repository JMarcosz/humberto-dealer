'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Sucursal, PoliticaRenta } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  ShieldCheck,
  Fuel,
  Sparkles,
  AlertCircle
} from 'lucide-react'

interface RentalSearchWidgetProps {
  initialFechaInicio?: string
  initialFechaFin?: string
  initialSucursalRecogida?: number
  initialSucursalDevolucion?: number
  compact?: boolean
}

export function RentalSearchWidget({
  initialFechaInicio,
  initialFechaFin,
  initialSucursalRecogida,
  initialSucursalDevolucion,
  compact = false,
}: RentalSearchWidgetProps) {
  const router = useRouter()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loadingSucursales, setLoadingSucursales] = useState(true)

  // Form state
  const [sucursalRecogida, setSucursalRecogida] = useState<string>(
    initialSucursalRecogida ? String(initialSucursalRecogida) : ''
  )
  const [mismaSucursal, setMismaSucursal] = useState(true)
  const [sucursalDevolucion, setSucursalDevolucion] = useState<string>(
    initialSucursalDevolucion ? String(initialSucursalDevolucion) : ''
  )

  /** Formatea en hora LOCAL. `toISOString()` desplazaba el valor por el offset:
   *  en RD (UTC-4) "mañana 10:00" se mostraba como "14:00". */
  const aValorLocal = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  // Default: mañana 10:00 AM hasta 4 días después 10:00 AM
  const defaultInicio = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return aValorLocal(d)
  }

  const defaultFin = () => {
    const d = new Date()
    d.setDate(d.getDate() + 4)
    d.setHours(10, 0, 0, 0)
    return aValorLocal(d)
  }

  const [fechaInicio, setFechaInicio] = useState(initialFechaInicio || defaultInicio())
  const [fechaFin, setFechaFin] = useState(initialFechaFin || defaultFin())
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)
  // Limites que publica el backend. Se usan para acotar los selectores; ningun
  // umbral de negocio se codifica en este componente.
  const [politica, setPolitica] = useState<PoliticaRenta | null>(null)

  useEffect(() => {
    api.getPolitica().then(setPolitica).catch(() => setPolitica(null))
  }, [])

  /** Rango permitido para la recogida, derivado de la politica del servidor. */
  const minRecogida = politica
    ? aValorLocal(new Date(Date.now() + politica.lead_time_minimo_minutos * 60_000))
    : undefined
  const maxRecogida = politica
    ? aValorLocal(new Date(Date.now() + politica.horizonte_maximo_dias * 86_400_000))
    : undefined
  const minDevolucion = politica && fechaInicio
    ? aValorLocal(new Date(new Date(fechaInicio).getTime() +
        politica.duracion_minima_horas * 3_600_000))
    : undefined

  useEffect(() => {
    api.getSucursales()
      .then((data) => {
        setSucursales(data)
        if (!sucursalRecogida && data.length > 0) {
          setSucursalRecogida(String(data[0].id))
          setSucursalDevolucion(String(data[0].id))
        }
      })
      .catch((err) => console.error('Error cargando sucursales:', err))
      .finally(() => setLoadingSucursales(false))
  }, [])

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorValidacion(null)

    const dInicio = new Date(fechaInicio)
    const dFin = new Date(fechaFin)

    if (isNaN(dInicio.getTime()) || isNaN(dFin.getTime())) {
      setErrorValidacion('Por favor selecciona fechas válidas.')
      return
    }

    // La duracion minima, el lead time y el horizonte los decide el backend.
    // Aqui solo se acotan los selectores con los valores que publica; si el
    // usuario fuerza la URL, la API responde 4xx con el mensaje correcto.

    const devId = mismaSucursal ? sucursalRecogida : sucursalDevolucion || sucursalRecogida
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      sucursal_recogida_id: sucursalRecogida,
      sucursal_devolucion_id: devId,
    })

    router.push(`/renta/disponibilidad?${params.toString()}`)
  }

  return (
    <div className={`rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl p-6 md:p-8 text-white ${compact ? 'max-w-4xl' : 'max-w-5xl'} mx-auto`}>
      {/* Header del Widget */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Renta en Santo Domingo
          </div>
          <h3 className="text-xl md:text-2xl font-black tracking-tight">
            Reserva tu auto al mejor precio garantizado
          </h3>
        </div>

        {/* Badges de beneficios */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-green-400">
            <ShieldCheck className="h-4 w-4" /> Seguro TPL Incluido
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <CheckCircle2 className="h-4 w-4" /> Km Ilimitado
          </span>
        </div>
      </div>

      <form onSubmit={handleBuscar} className="space-y-4">
        {/* Fila 1: Sucursales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-orange-500" />
              Lugar de recogida
            </Label>
            <Select
              value={sucursalRecogida}
              onValueChange={(val) => {
                setSucursalRecogida(val)
                if (mismaSucursal) setSucursalDevolucion(val)
              }}
              disabled={loadingSucursales}
            >
              <SelectTrigger className="bg-zinc-900/80 border-zinc-700 text-white h-12 focus:ring-orange-500">
                <SelectValue placeholder="Selecciona sucursal de retiro" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre} {s.codigo_aeropuerto ? `(${s.codigo_aeropuerto})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-500" />
                Lugar de devolución
              </Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mismaSucursal}
                  onChange={(e) => {
                    setMismaSucursal(e.target.checked)
                    if (e.target.checked) setSucursalDevolucion(sucursalRecogida)
                  }}
                  className="rounded border-zinc-700 accent-orange-500"
                />
                Mismo lugar de retiro
              </label>
            </div>

            {mismaSucursal ? (
              <div className="h-12 flex items-center px-4 rounded-md bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-sm">
                Misma sucursal seleccionada
              </div>
            ) : (
              <Select
                value={sucursalDevolucion}
                onValueChange={setSucursalDevolucion}
                disabled={loadingSucursales}
              >
                <SelectTrigger className="bg-zinc-900/80 border-zinc-700 text-white h-12 focus:ring-orange-500">
                  <SelectValue placeholder="Selecciona sucursal de entrega" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nombre} {s.codigo_aeropuerto ? `(${s.codigo_aeropuerto})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Fila 2: Fechas y Botón de Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-orange-500" />
              Fecha y hora de recogida
            </Label>
            <Input
              type="datetime-local"
              value={fechaInicio}
              min={minRecogida}
              max={maxRecogida}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-zinc-900/80 border-zinc-700 text-white h-12 focus-visible:ring-orange-500"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-orange-500" />
              Fecha y hora de devolución
            </Label>
            <Input
              type="datetime-local"
              value={fechaFin}
              min={minDevolucion}
              max={maxRecogida}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-zinc-900/80 border-zinc-700 text-white h-12 focus-visible:ring-orange-500"
            />
          </div>

          <div className="md:col-span-1">
            <Button
              type="submit"
              className="w-full h-12 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: '#FF5500', border: 'none' }}
            >
              <Search className="h-5 w-5 mr-2" />
              Buscar
            </Button>
          </div>
        </div>

        {errorValidacion && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mt-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorValidacion}</span>
          </div>
        )}
      </form>
    </div>
  )
}
