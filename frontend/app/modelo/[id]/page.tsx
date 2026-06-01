'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, ArrowLeft, Car, ChevronLeft, ChevronRight, Calendar, Gauge, Fuel, Settings2, Palette, MapPin } from 'lucide-react'
import { getVehicleImageUrl, FALLBACK_VEHICLE_IMAGE } from '@/lib/vehicle-images'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const fmtKm = (n: number) => new Intl.NumberFormat('es-DO').format(n)

const ESTADO_STYLES: Record<string, { badge: string; label: string }> = {
  disponible:           { badge: 'bg-green-500/10 text-green-600 border-green-500/20',   label: 'Disponible' },
  reservado:            { badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Reservado'  },
  vendido:              { badge: 'bg-red-500/10 text-red-600 border-red-500/20',          label: 'Vendido'    },
  pendiente_validacion: { badge: 'bg-gray-500/10 text-gray-600 border-gray-500/20',       label: 'Pendiente'  },
}

export default function ModeloPage() {
  const params   = useParams()
  const router   = useRouter()
  const modeloId = Number(params.id)

  const [idx,    setIdx]    = useState(0)
  const [imgSrc, setImgSrc] = useState('')

  const { data: vehiculosData, isLoading: loading, isError: error } = useQuery({
    queryKey: ['vehiculos', { modelo_id: modeloId }],
    queryFn:  () => api.getVehiculos({ modelo_id: modeloId, per_page: 100 }),
    enabled:  !!modeloId,
    staleTime: 60_000,
  })

  const vehicles = useMemo<Vehicle[]>(() => {
    if (!vehiculosData) return []
    const sorted = vehiculosData.items.map(toVehicle).sort((a, b) => b.año - a.año)
    if (sorted.length > 0 && !imgSrc) {
      setImgSrc(getVehicleImageUrl(sorted[0].modelo, Number(sorted[0].id), sorted[0].imagenes[0]))
    }
    return sorted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculosData])

  const current = vehicles[idx]

  const goTo = (newIdx: number) => {
    setIdx(newIdx)
    const v = vehicles[newIdx]
    setImgSrc(getVehicleImageUrl(v.modelo, Number(v.id), v.imagenes[0]))
  }

  const prev = () => goTo(idx === 0 ? vehicles.length - 1 : idx - 1)
  const next = () => goTo(idx === vehicles.length - 1 ? 0 : idx + 1)

  const estado = current ? (ESTADO_STYLES[current.estado] ?? ESTADO_STYLES.disponible) : null

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {loading ? (
          <div className="flex justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error || vehicles.length === 0 ? (
          <div className="container mx-auto px-4 py-32 text-center">
            <Car className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-semibold">Modelo no disponible</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No encontramos unidades de este modelo en el catálogo.
            </p>
            <Link href="/">
              <Button className="mt-6" style={{ background: '#FF5500', color: '#fff', border: 'none' }}>
                Ver catálogo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-8 max-w-5xl">
            {/* Navegación superior */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => router.push('/#catalogo-section')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al catálogo
              </button>
              {vehicles.length > 1 && (
                <span className="text-sm text-muted-foreground">
                  {idx + 1} / {vehicles.length} unidades
                </span>
              )}
            </div>

            <div className="grid gap-8 lg:grid-cols-5">
              {/* Imagen con flechas de navegación */}
              <div className="lg:col-span-3">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={`${current.marca} ${current.modelo} ${current.año}`}
                    className="h-full w-full object-cover transition-opacity duration-300"
                    onError={() => setImgSrc(FALLBACK_VEHICLE_IMAGE)}
                  />

                  {/* Badge estado */}
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold border ${estado?.badge}`}>
                    {estado?.label}
                  </span>

                  {/* Flechas — solo si hay más de 1 unidad */}
                  {vehicles.length > 1 && (
                    <>
                      <button
                        onClick={prev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  {/* Indicador de puntos */}
                  {vehicles.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {vehicles.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => goTo(i)}
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: i === idx ? '20px' : '8px',
                            background: i === idx ? '#FF5500' : 'rgba(255,255,255,0.5)',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Miniaturas de las otras unidades */}
                {vehicles.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {vehicles.map((v, i) => {
                      const thumb = getVehicleImageUrl(v.modelo, Number(v.id), v.imagenes[0])
                      return (
                        <button
                          key={v.id}
                          onClick={() => goTo(i)}
                          className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg transition-all"
                          style={{ outline: i === idx ? '2px solid #FF5500' : '2px solid transparent', outlineOffset: '2px', opacity: i === idx ? 1 : 0.55 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt={`Unidad ${i + 1}`} className="h-full w-full object-cover" />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[10px] text-white py-0.5">
                            {v.año}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Datos del vehículo seleccionado */}
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">{current.marca}</p>
                  <h1 className="mt-0.5 text-2xl font-bold md:text-3xl">{current.modelo}</h1>
                  <p className="mt-3 text-3xl font-black" style={{ color: '#FF5500' }}>
                    {fmt(current.precio)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Año</p>
                      <p className="font-semibold">{current.año}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Kilometraje</p>
                      <p className="font-semibold">{fmtKm(current.kilometraje)} km</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Combustible</p>
                      <p className="font-semibold capitalize">{current.combustible}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Transmisión</p>
                      <p className="font-semibold capitalize">{current.transmision}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Color</p>
                      <p className="font-semibold capitalize">{current.color.toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-semibold capitalize">{current.tipo}</p>
                    </div>
                  </div>
                </div>

                {current.descripcion && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">{current.descripcion}</p>
                  </>
                )}

                <Separator />

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
                  {process.env.NEXT_PUBLIC_BUSINESS_ADDRESS}
                </div>

                <div className="space-y-2 pt-1">
                  <Link href={`/vehiculo/${current.id}`} className="block">
                    <Button className="w-full font-bold" style={{ background: '#FF5500', color: '#fff', border: 'none' }}>
                      Ver ficha completa
                    </Button>
                  </Link>
                  {vehicles.length > 1 && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-1" onClick={prev}>
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </Button>
                      <Button variant="outline" className="flex-1 gap-1" onClick={next}>
                        Siguiente <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
