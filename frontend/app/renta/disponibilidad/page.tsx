'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { RentalVehicle, DisponibilidadRentaResponse, Sucursal } from '@/lib/types'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { RentalSearchWidget } from '@/components/rental-search-widget'
import { RentalVehicleCard } from '@/components/rental-vehicle-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Car,
  Filter,
  SlidersHorizontal,
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  AlertTriangle
} from 'lucide-react'

function DisponibilidadContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const fechaInicio = searchParams.get('fecha_inicio') || ''
  const fechaFin = searchParams.get('fecha_fin') || ''
  const sucursalRecogidaId = searchParams.get('sucursal_recogida_id') || '1'
  const sucursalDevolucionId = searchParams.get('sucursal_devolucion_id') || sucursalRecogidaId

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DisponibilidadRentaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sucursales, setSucursales] = useState<Record<number, Sucursal>>({})

  // Filtros locales
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
  const [transmisionFiltro, setTransmisionFiltro] = useState<string>('all')

  useEffect(() => {
    // Cargar nombres de sucursales para encabezado
    api.getSucursales()
      .then((sucs) => {
        const map: Record<number, Sucursal> = {}
        sucs.forEach((s) => { map[s.id] = s })
        setSucursales(map)
      })
      .catch((err) => console.error(err))
  }, [])

  useEffect(() => {
    if (!fechaInicio || !fechaFin) {
      setError('Por favor define las fechas de recogida y devolución.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Los filtros van al servidor: antes se descargaba la flota completa y se
    // filtraba en el navegador, asi que el contador de resultados mentia.
    const temporizador = setTimeout(() => {
    api.getDisponibilidadRenta({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      sucursal_recogida_id: Number(sucursalRecogidaId),
      sucursal_devolucion_id: Number(sucursalDevolucionId),
      categoria: categoriaFiltro !== 'all' ? categoriaFiltro : undefined,
      transmision: transmisionFiltro !== 'all' ? transmisionFiltro : undefined,
    })
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        setError(err.message || 'Error al buscar disponibilidad.')
      })
      .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(temporizador)
  }, [fechaInicio, fechaFin, sucursalRecogidaId, sucursalDevolucionId,
      categoriaFiltro, transmisionFiltro])

  // El servidor ya devuelve la lista filtrada.
  const vehiculosFiltrados = data?.vehiculos || []

  const sucRec = sucursales[Number(sucursalRecogidaId)]
  const sucDev = sucursales[Number(sucursalDevolucionId)]

  const formatDateLabel = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-DO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Barra de Itinerario */}
      <div className="mb-6 p-4 rounded-xl bg-card border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-orange-500" />
            <span>{sucRec ? sucRec.nombre : 'Recogida'}</span>
            <span className="text-muted-foreground">→</span>
            <span>{sucDev ? sucDev.nombre : 'Devolución'}</span>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 text-orange-500" />
            <span>{formatDateLabel(fechaInicio)} — {formatDateLabel(fechaFin)}</span>
          </div>

          {data && (
            <Badge variant="secondary" className="font-bold">
              {data.dias_facturables} {data.dias_facturables === 1 ? 'día' : 'días'}
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const el = document.getElementById('search-widget-accordion')
            el?.classList.toggle('hidden')
          }}
          className="text-xs font-semibold"
        >
          Modificar Búsqueda
        </Button>
      </div>

      {/* Widget Desplegable de Modificación */}
      <div id="search-widget-accordion" className="hidden mb-8">
        <RentalSearchWidget
          initialFechaInicio={fechaInicio}
          initialFechaFin={fechaFin}
          initialSucursalRecogida={Number(sucursalRecogidaId)}
          initialSucursalDevolucion={Number(sucursalDevolucionId)}
          compact
        />
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Barra Lateral de Filtros */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="p-5 rounded-xl bg-card border border-border space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-orange-500" /> Filtros
              </h4>
              {(categoriaFiltro !== 'all' || transmisionFiltro !== 'all') && (
                <button
                  onClick={() => {
                    setCategoriaFiltro('all')
                    setTransmisionFiltro('all')
                  }}
                  className="text-xs text-orange-500 hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filtro por Categoría */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Categoría
              </label>
              <div className="space-y-1">
                {[
                  { value: 'all', label: 'Todas las categorías' },
                  { value: 'SEDAN', label: 'Sedán' },
                  { value: 'SUV', label: 'SUV Familiar' },
                  { value: 'PICKUP', label: 'Camioneta Pickup' },
                  { value: 'VAN', label: 'Minivan / Pasajeros' },
                ].map((item) => (
                  <label
                    key={item.value}
                    className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <span className={categoriaFiltro === item.value ? 'font-semibold text-orange-500' : ''}>
                      {item.label}
                    </span>
                    <input
                      type="radio"
                      name="cat_filter"
                      value={item.value}
                      checked={categoriaFiltro === item.value}
                      onChange={(e) => setCategoriaFiltro(e.target.value)}
                      className="accent-orange-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro por Transmisión */}
            <div className="space-y-2 border-t pt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Transmisión
              </label>
              <div className="space-y-1">
                {[
                  { value: 'all', label: 'Cualquiera' },
                  { value: 'AUTOMATICA', label: 'Automática' },
                  { value: 'MANUAL', label: 'Manual' },
                ].map((item) => (
                  <label
                    key={item.value}
                    className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <span className={transmisionFiltro === item.value ? 'font-semibold text-orange-500' : ''}>
                      {item.label}
                    </span>
                    <input
                      type="radio"
                      name="trans_filter"
                      value={item.value}
                      checked={transmisionFiltro === item.value}
                      onChange={(e) => setTransmisionFiltro(e.target.value)}
                      className="accent-orange-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Listado de Resultados */}
        <section className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">
              Autos Disponibles{' '}
              {!loading && data && (
                <span className="text-muted-foreground text-sm font-normal">
                  ({vehiculosFiltrados.length} encontrados)
                </span>
              )}
            </h2>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              <p className="text-sm text-muted-foreground font-medium">Buscando flota disponible en tiempo real...</p>
            </div>
          )}

          {error && (
            <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-5 w-5" />
                <span>Error en la búsqueda</span>
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && vehiculosFiltrados.length === 0 && (
            <div className="text-center py-20 px-4 rounded-xl border border-dashed border-border bg-card space-y-4">
              <Car className="h-14 w-14 mx-auto text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-bold">No hay vehículos disponibles para estas fechas</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Prueba seleccionando otras fechas o una sucursal alternativa como el Aeropuerto SDQ o Centro Piantini.
                </p>
              </div>
              <Button
                onClick={() => {
                  setCategoriaFiltro('all')
                  setTransmisionFiltro('all')
                }}
                variant="outline"
              >
                Limpiar filtros
              </Button>
            </div>
          )}

          {!loading && !error && vehiculosFiltrados.map((v) => (
            <RentalVehicleCard
              key={v.id}
              vehicle={v}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              sucursalRecogidaId={sucursalRecogidaId}
              sucursalDevolucionId={sucursalDevolucionId}
            />
          ))}
        </section>
      </div>
    </div>
  )
}

export default function DisponibilidadPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-4">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        }>
          <DisponibilidadContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
