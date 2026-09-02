'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type {
  RentalVehicle,
  CoberturaSeguro,
  ExtraServicio,
  Sucursal,
  ReservaRentaPayload,
  ConductorPayload,
  CotizacionRenta
} from '@/lib/types'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Car,
  Calendar,
  MapPin,
  Clock,
  Luggage,
  Users,
  CreditCard,
  FileText,
  Loader2,
  Sparkles,
  ArrowLeft,
  Lock,
  Plus
} from 'lucide-react'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const vehiculoId = searchParams.get('vehiculo_id') || ''
  const fechaInicio = searchParams.get('fecha_inicio') || ''
  const fechaFin = searchParams.get('fecha_fin') || ''
  const sucursalRecogidaId = searchParams.get('sucursal_recogida_id') || '1'
  const sucursalDevolucionId = searchParams.get('sucursal_devolucion_id') || sucursalRecogidaId

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  // Datos base
  const [vehicle, setVehicle] = useState<RentalVehicle | null>(null)
  const [coberturas, setCoberturas] = useState<CoberturaSeguro[]>([])
  const [extras, setExtras] = useState<ExtraServicio[]>([])
  const [sucursales, setSucursales] = useState<Record<number, Sucursal>>({})

  // Selecciones del cliente
  const [coberturaSeleccionada, setCoberturaSeleccionada] = useState<number>(0)
  const [cotizacion, setCotizacion] = useState<CotizacionRenta | null>(null)
  const [cotizando, setCotizando] = useState(false)
  // Motivo por el que el backend rechaza esta configuracion (edad, ventana
  // temporal, topes...). Se muestra literal: el umbral no se codifica aqui.
  const [avisoElegibilidad, setAvisoElegibilidad] = useState<string | null>(null)
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<number[]>([])

  // Datos del conductor
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [documento, setDocumento] = useState('')
  const [licencia, setLicencia] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [notasVuelo, setNotasVuelo] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)

  useEffect(() => {
    if (!vehiculoId || !fechaInicio || !fechaFin) {
      setErrorGlobal('Parámetros de reserva incompletos.')
      setLoading(false)
      return
    }

    Promise.all([
      api.getDisponibilidadRenta({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        sucursal_recogida_id: Number(sucursalRecogidaId),
        sucursal_devolucion_id: Number(sucursalDevolucionId),
      }),
      api.getCoberturas(),
      api.getExtras(),
      api.getSucursales(),
      api.getCurrentUser().catch(() => null),
    ])
      .then(([disp, cobs, exts, sucs, user]) => {
        const found = disp.vehiculos.find((v) => v.id === Number(vehiculoId))
        // Si el auto elegido ya no esta disponible se muestra el estado de
        // error correspondiente; sustituirlo en silencio hacia que el usuario
        // confirmara la reserva de un vehiculo que nunca eligio.
        setVehicle(found ?? null)

        setCoberturas(cobs)
        // Por defecto, seleccionar CDW (estándar) o la destacada
        const dest = cobs.find((c) => c.destacado) || cobs[0]
        if (dest) setCoberturaSeleccionada(dest.id)

        setExtras(exts)

        const sucMap: Record<number, Sucursal> = {}
        sucs.forEach((s) => { sucMap[s.id] = s })
        setSucursales(sucMap)

        if (user) {
          const partes = (user.nombre || '').split(' ')
          setNombre(partes[0] || '')
          setApellido(partes.slice(1).join(' ') || '')
          setEmail(user.email || '')
        }
      })
      .catch((err) => {
        setErrorGlobal(err.message || 'Error cargando datos de reserva.')
      })
      .finally(() => setLoading(false))
  }, [vehiculoId, fechaInicio, fechaFin, sucursalRecogidaId, sucursalDevolucionId])

  // ── Cotización: el backend calcula, el frontend solo muestra ────────────
  //
  // Antes este bloque reimplementaba en TypeScript los días facturables, los
  // subtotales, el depósito y la edad mínima. Eran una segunda fuente de verdad
  // que ya divergía del backend (el depósito replicaba el mismo `||` roto).
  // Ahora se pide `POST /api/renta/cotizar`, que por dentro ejecuta exactamente
  // el mismo cálculo que el checkout: la cifra mostrada es la que se cobra.
  useEffect(() => {
    if (!vehicle || !coberturaSeleccionada) return

    const temporizador = setTimeout(() => {
      setCotizando(true)
      api.cotizarRenta({
        vehiculo_id: vehicle.id,
        sucursal_recogida_id: Number(sucursalRecogidaId),
        sucursal_devolucion_id: Number(sucursalDevolucionId),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cobertura_id: coberturaSeleccionada,
        extras_ids: extrasSeleccionados,
        conductor: fechaNacimiento
          ? ({ fecha_nacimiento: fechaNacimiento } as ConductorPayload)
          : undefined as unknown as ConductorPayload,
      })
        .then((cot) => {
          setCotizacion(cot)
          setAvisoElegibilidad(null)
          setErrorGlobal(null)
        })
        .catch((err: unknown) => {
          // Una fecha de nacimiento incompleta mientras se teclea no es un error
          // que merezca interrumpir al usuario.
          if (err instanceof ApiError && err.status === 400) return
          if (err instanceof ApiError && err.status === 422) {
            // Regla de negocio incumplida: se muestra el mensaje del backend
            // tal cual, sin replicar el umbral en el cliente.
            setAvisoElegibilidad(err.message)
            setCotizacion(null)
            return
          }
          setErrorGlobal(err instanceof Error ? err.message : 'No se pudo calcular el precio.')
        })
        .finally(() => setCotizando(false))
    }, 350)

    return () => clearTimeout(temporizador)
  }, [vehicle, coberturaSeleccionada, extrasSeleccionados, fechaNacimiento,
      fechaInicio, fechaFin, sucursalRecogidaId, sucursalDevolucionId])

  const dias            = cotizacion?.dias_facturables ?? 0
  const totalAlquiler   = cotizacion?.total_alquiler ?? 0
  const depositoGarantia = cotizacion?.deposito_garantia ?? 0
  const recargoJoven    = cotizacion?.recargo_young_driver ?? 0
  const cobActual       = coberturas.find((c) => c.id === coberturaSeleccionada)

  /** Depósito ya calculado por el backend para ESTE vehículo y cobertura. */
  const depositoDeCobertura = (coberturaId: number) =>
    cotizacion?.coberturas_disponibles?.find((c) => c.cobertura_id === coberturaId)
      ?.deposito_garantia

  const toggleExtra = (id: number) => {
    setExtrasSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorGlobal(null)

    // La elegibilidad (edad mínima, recargo por conductor joven, ventana
    // temporal, topes de extras) la decide el backend y responde 422 con un
    // mensaje accionable. Aquí no se duplica ninguna de esas reglas.

    setSubmitting(true)

    const payload: ReservaRentaPayload = {
      vehiculo_id: vehicle!.id,
      sucursal_recogida_id: Number(sucursalRecogidaId),
      sucursal_devolucion_id: Number(sucursalDevolucionId),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      cobertura_id: coberturaSeleccionada,
      extras_ids: extrasSeleccionados,
      acepta_terminos: aceptaTerminos,
      conductor: {
        nombre,
        apellido,
        email,
        telefono,
        documento,
        licencia,
        fecha_nacimiento: fechaNacimiento,
      },
      notas_vuelo: notasVuelo || undefined,
    }

    try {
      const res = await api.crearReservaRenta(payload)
      // Camino feliz: el POST ya devolvio la reserva completa. Se deja en
      // sessionStorage para que la confirmacion no tenga que volver a pedirla
      // ni exigir el segundo factor a quien acaba de reservar.
      try {
        sessionStorage.setItem(`voucher:${res.pnr}`, JSON.stringify(res.reserva))
      } catch {
        // Modo privado o almacenamiento bloqueado: la confirmacion pedira el
        // apellido, que es el camino de carga en frio.
      }
      router.push(`/renta/confirmacion/${res.pnr}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la reserva'
      setErrorGlobal(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="text-sm font-medium text-muted-foreground">Preparando tu reserva...</p>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Vehículo no disponible</h2>
        <p className="text-muted-foreground">El vehículo seleccionado ya no se encuentra disponible para estas fechas.</p>
        <Button onClick={() => router.back()}>Volver al catálogo</Button>
      </div>
    )
  }

  const sucRec = sucursales[Number(sucursalRecogidaId)]
  const sucDev = sucursales[Number(sucursalDevolucionId)]

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Botón Volver */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la selección de autos
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUMNA IZQUIERDA: Formulario de Selección y Conductor (8 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-8">
          {/* PASO 1: Selección de Cobertura */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-orange-500" />
                  1. Selecciona tu Nivel de Cobertura
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Elige tu protección ante colisiones y reduce el monto del depósito de garantía en mostrador.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {coberturas.map((cob) => {
                const selected = cob.id === coberturaSeleccionada
                return (
                  <div
                    key={cob.id}
                    onClick={() => setCoberturaSeleccionada(cob.id)}
                    className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      selected
                        ? 'border-orange-500 bg-orange-500/5 shadow-md'
                        : 'border-border hover:border-zinc-400 dark:hover:border-zinc-700 bg-card'
                    }`}
                  >
                    {cob.destacado && (
                      <span className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold uppercase tracking-wider">
                        Recomendado
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-bold text-base leading-snug">{cob.nombre}</h4>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'}`}>
                          {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                      </div>

                      <div className="my-2">
                        <span className="text-2xl font-black">
                          {cob.costo_dia === 0 ? 'Incluido' : `+$${cob.costo_dia.toFixed(0)}`}
                        </span>
                        {cob.costo_dia > 0 && (
                          <span className="text-xs text-muted-foreground"> / día</span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mb-3">{cob.descripcion}</p>

                      <div className="space-y-1.5 text-xs">
                        {cob.bullets.map((b, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                      Depósito en tarjeta:{' '}
                      <strong className="text-foreground">
                        {depositoDeCobertura(cob.id) !== undefined
                          ? `$${depositoDeCobertura(cob.id)!.toFixed(0)} USD`
                          : '—'}
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* PASO 2: Extras y Servicios Adicionales */}
          <section className="space-y-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                2. Agrega Servicios Adicionales
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Optimiza tu viaje por Santo Domingo y las carreteras del país.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {extras.map((ex) => {
                const checked = extrasSeleccionados.includes(ex.id)
                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleExtra(ex.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      checked
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-border hover:border-zinc-400 dark:hover:border-zinc-700 bg-card'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="rounded accent-orange-500"
                        />
                        <h5 className="font-bold text-sm">{ex.nombre}</h5>
                      </div>
                      <p className="text-xs text-muted-foreground">{ex.descripcion}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-sm">+${ex.costo_dia.toFixed(0)}</span>
                      <span className="text-[11px] text-muted-foreground block">
                        {ex.es_pago_unico ? 'único' : '/ día'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* PASO 3: Datos del Conductor Principal */}
          <section className="space-y-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                3. Información del Conductor Principal
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                El titular debe presentar su licencia física y tarjeta de crédito al retirar el vehículo.
              </p>
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre" className="text-xs font-semibold">Nombre *</Label>
                    <Input
                      id="nombre"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Juan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="apellido" className="text-xs font-semibold">Apellido *</Label>
                    <Input
                      id="apellido"
                      required
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Ej. Pérez"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">Correo Electrónico *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan.perez@email.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="telefono" className="text-xs font-semibold">Teléfono / WhatsApp *</Label>
                    <Input
                      id="telefono"
                      required
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="+1 (809) 000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="documento" className="text-xs font-semibold">Cédula o Pasaporte *</Label>
                    <Input
                      id="documento"
                      required
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      placeholder="Número de identidad"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="licencia" className="text-xs font-semibold">No. Licencia de Conducir *</Label>
                    <Input
                      id="licencia"
                      required
                      value={licencia}
                      onChange={(e) => setLicencia(e.target.value)}
                      placeholder="No. licencia vigente"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fechaNac" className="text-xs font-semibold">Fecha de Nacimiento *</Label>
                    <Input
                      id="fechaNac"
                      type="date"
                      required
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                    />
                  </div>
                </div>

                {avisoElegibilidad && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{avisoElegibilidad}</span>
                  </div>
                )}

                <div className="space-y-1.5 pt-2 border-t">
                  <Label htmlFor="vuelo" className="text-xs text-muted-foreground">
                    Número de Vuelo (Opcional - Si retiras en Aeropuerto SDQ / JBQ)
                  </Label>
                  <Input
                    id="vuelo"
                    value={notasVuelo}
                    onChange={(e) => setNotasVuelo(e.target.value)}
                    placeholder="Ej. JetBlue 1923 / Delta 1832"
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Términos y Confirmación */}
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
                className="mt-0.5 rounded accent-orange-500"
              />
              <span>
                Confirmo que el conductor principal tiene al menos 21 años, cuenta con licencia vigente emitida hace al menos 2 años y presentará una tarjeta de crédito física a su nombre para el depósito de garantía de <strong>${depositoGarantia} USD</strong> en mostrador.
              </span>
            </label>

            {errorGlobal && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{errorGlobal}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || cotizando || !cotizacion || !!avisoElegibilidad || !aceptaTerminos}
              className="w-full h-14 text-lg font-bold text-white shadow-xl gap-2"
              style={{ background: '#FF5500', border: 'none' }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Emitiendo Voucher y Confirmando Reserva...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 mr-1" />
                  Confirmar Reserva Garantizada (${totalAlquiler.toFixed(2)} USD)
                </>
              )}
            </Button>
          </div>
        </form>

        {/* COLUMNA DERECHA: Resumen de Orden Flotante (4 cols) */}
        <aside className="lg:col-span-4 sticky top-6 space-y-4">
          <Card className="border-border/80 shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/40 p-5 border-b">
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-500 text-white font-bold">{vehicle.categoria}</Badge>
                <span className="text-xs font-bold text-muted-foreground">{dias} {dias === 1 ? 'Día' : 'Días'} de Renta</span>
              </div>
              <CardTitle className="text-xl font-bold mt-2">
                {vehicle.marca} {vehicle.modelo}
              </CardTitle>
              <CardDescription className="text-xs">Año {vehicle.anio} • {vehicle.transmision.toLowerCase()}</CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Imagen del Auto */}
              <div className="relative w-full h-36 bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center">
                <Image
                  src={vehicle.imagen_principal || '/placeholder.svg'}
                  alt={`${vehicle.marca} ${vehicle.modelo}`}
                  fill
                  className="object-contain p-2"
                />
              </div>

              {/* Detalles de Retiro y Entrega */}
              <div className="space-y-2 text-xs border-y py-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground block">Recogida:</span>
                    <strong className="text-foreground">{sucRec?.nombre || 'Sucursal'}</strong>
                    <span className="text-[11px] text-muted-foreground block">{new Date(fechaInicio).toLocaleString('es-DO')}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-border/40">
                  <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground block">Devolución:</span>
                    <strong className="text-foreground">{sucDev?.nombre || 'Sucursal'}</strong>
                    <span className="text-[11px] text-muted-foreground block">{new Date(fechaFin).toLocaleString('es-DO')}</span>
                  </div>
                </div>
              </div>

              {/* Desglose de Tarifas */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Alquiler ({dias} días x ${(cotizacion?.tarifa_diaria ?? 0).toFixed(0)})
                  </span>
                  <span className="font-semibold">
                    ${(cotizacion?.subtotal_vehiculo ?? 0).toFixed(2)}
                  </span>
                </div>

                {(cotizacion?.subtotal_cobertura ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{cobActual?.nombre} ({dias}d)</span>
                    <span className="font-semibold">
                      +${cotizacion!.subtotal_cobertura.toFixed(2)}
                    </span>
                  </div>
                )}

                {(cotizacion?.subtotal_extras ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicios adicionales</span>
                    <span className="font-semibold">
                      +${cotizacion!.subtotal_extras.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* El recargo por conductor joven se muestra ANTES de reservar:
                    un cargo que aparece por primera vez en la confirmación
                    genera disputas en mostrador. */}
                {recargoJoven > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Recargo conductor joven ({cotizacion?.edad_conductor} años)
                    </span>
                    <span className="font-semibold">+${recargoJoven.toFixed(2)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-baseline pt-1">
                  <div>
                    <span className="font-bold text-sm block">Total Estimado</span>
                    <span className="text-[10px] text-muted-foreground">Impuestos incluidos</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      ${totalAlquiler.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase ml-1">USD</span>
                  </div>
                </div>

                {/* Depósito en Tarjeta Requerido */}
                <div className="mt-3 p-3 rounded-lg bg-zinc-900 text-zinc-100 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>Depósito en Garantía (Fianza):</span>
                    <span className="text-orange-400">${depositoGarantia.toFixed(0)} USD</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Varía según la categoría del vehículo y la cobertura elegida. Se bloquea
                    temporalmente en tu tarjeta de crédito al retirar y se libera al devolverlo
                    sin incidencias.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-4">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        }>
          <CheckoutContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
