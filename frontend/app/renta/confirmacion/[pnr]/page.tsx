'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ReservaRenta } from '@/lib/types'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Printer,
  Share2,
  Calendar,
  MapPin,
  Car,
  CreditCard,
  FileCheck,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Phone,
  Clock
} from 'lucide-react'

interface ConfirmacionPageProps {
  params: Promise<{ pnr: string }>
}

export default function ConfirmacionPage({ params }: ConfirmacionPageProps) {
  const resolvedParams = use(params)
  const pnr = resolvedParams.pnr

  const [reserva, setReserva] = useState<ReservaRenta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Carga en frio (link de correo, otro dispositivo): hace falta el segundo factor.
  const [apellido, setApellido] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    // 1) Recien reservado: la reserva viene del propio checkout, sin GET.
    try {
      const guardada = sessionStorage.getItem(`voucher:${pnr}`)
      if (guardada) {
        setReserva(JSON.parse(guardada) as ReservaRenta)
        setLoading(false)
        return
      }
    } catch {
      // Almacenamiento no disponible: se cae al camino de verificacion.
    }
    // 2) Carga en frio: se pide el apellido del conductor.
    setLoading(false)
  }, [pnr])

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerificando(true)
    setError(null)
    try {
      setReserva(await api.getReservaPorPnr(pnr, { apellido }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la reserva.')
    } finally {
      setVerificando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!reserva) {
    // El voucher contiene datos personales del conductor, asi que no basta con
    // conocer el codigo PNR: hace falta un segundo factor.
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-20">
          <form onSubmit={verificar} className="max-w-md mx-auto space-y-5 text-center">
            <ShieldCheck className="h-12 w-12 text-orange-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Verifica tu reserva</h2>
              <p className="text-sm text-muted-foreground">
                Reserva <strong className="font-mono">{pnr.toUpperCase()}</strong>. Por tu
                seguridad, confirma el apellido del conductor principal para ver el voucher.
              </p>
            </div>

            <input
              type="text"
              required
              autoFocus
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Apellido del conductor"
              className="w-full h-12 px-4 rounded-lg border bg-background text-center"
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={verificando || !apellido.trim()}
                    className="w-full h-12 font-bold">
              {verificando ? 'Verificando...' : 'Ver mi voucher'}
            </Button>
            <Link href="/" className="block text-xs text-muted-foreground hover:underline">
              Volver al inicio
            </Link>
          </form>
        </main>
        <Footer />
      </div>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const whatsappMsg = encodeURIComponent(
    `¡Hola! Mi reserva de auto en Humberto Car Rental está confirmada con el código PNR: ${reserva.pnr}. Vehículo: ${reserva.vehiculo_nombre}.`
  )
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`

  return (
    <div className="min-h-screen flex flex-col bg-background print:bg-white print:text-black">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="flex-1 py-8 container mx-auto px-4 max-w-4xl">
        {/* Banner de Éxito */}
        <div className="mb-6 p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center space-y-2 print:border-none">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto" />
          <h1 className="text-2xl md:text-3xl font-black text-green-700 dark:text-green-400">
            ¡Tu reserva ha sido confirmada con éxito!
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Hemos reservado tu vehículo. Presenta este voucher impreso o en tu teléfono inteligente en el mostrador.
          </p>
        </div>

        {/* Botones de Acción Superiores (Ocultos en Print) */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir / Guardar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2 text-green-600 border-green-600/30 hover:bg-green-500/10"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Share2 className="h-4 w-4" />
                Compartir por WhatsApp
              </a>
            </Button>
          </div>
        </div>

        {/* Tarjeta del Voucher Principal */}
        <Card className="border-2 border-border shadow-xl overflow-hidden print:border print:shadow-none bg-card">
          {/* Cabecera del Voucher */}
          <div className="p-6 md:p-8 bg-zinc-950 text-white flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-extrabold block mb-1">
                Voucher Oficial de Alquiler
              </span>
              <h2 className="text-xl font-bold">Humberto Car Rental Santo Domingo</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Renta de vehículos de alta gama y turísticos</p>
            </div>

            <div className="text-right p-3 rounded-xl bg-zinc-900 border border-zinc-700">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-semibold">
                Código de Reserva (PNR)
              </span>
              <span className="text-2xl font-black text-orange-500 tracking-wider">
                {reserva.pnr}
              </span>
              <Badge className="mt-1 bg-green-500 text-white text-[10px] block text-center">
                {reserva.estado}
              </Badge>
            </div>
          </div>

          <CardContent className="p-6 md:p-8 space-y-8">
            {/* 1. Datos del Vehículo */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 relative h-36 bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center p-2">
                <Image
                  src={reserva.vehiculo_imagen || '/placeholder.svg'}
                  alt={reserva.vehiculo_nombre}
                  fill
                  className="object-contain"
                />
              </div>

              <div className="md:col-span-8 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black">{reserva.vehiculo_nombre}</h3>
                  {reserva.categoria && (
                    <Badge variant="outline" className="font-semibold">{reserva.categoria}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Duración total: <strong>{reserva.total_dias} {reserva.total_dias === 1 ? 'día' : 'días'}</strong> de alquiler con kilometraje ilimitado en RD.
                </p>
                {reserva.cobertura && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{reserva.cobertura.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* 2. Itinerario: Recogida y Devolución */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recogida */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>Punto de Recogida (Pick-up)</span>
                </div>
                <h4 className="font-bold text-base">{reserva.sucursal_recogida?.nombre}</h4>
                <p className="text-xs text-muted-foreground">{reserva.sucursal_recogida?.direccion}</p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{new Date(reserva.fecha_inicio).toLocaleString('es-DO')}</span>
                </div>
              </div>

              {/* Devolución */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>Punto de Devolución (Drop-off)</span>
                </div>
                <h4 className="font-bold text-base">{reserva.sucursal_devolucion?.nombre}</h4>
                <p className="text-xs text-muted-foreground">{reserva.sucursal_devolucion?.direccion}</p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{new Date(reserva.fecha_fin).toLocaleString('es-DO')}</span>
                </div>
              </div>
            </div>

            {/* 3. Conductor Principal y Financiero */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Conductor Principal
                </h4>
                <div className="text-sm space-y-1">
                  <p><strong>Titular:</strong> {reserva.conductor.nombre} {reserva.conductor.apellido}</p>
                  <p><strong>Email:</strong> {reserva.conductor.email}</p>
                  <p><strong>Teléfono:</strong> {reserva.conductor.telefono}</p>
                  <p><strong>Documento:</strong> {reserva.conductor.documento}</p>
                  <p><strong>No. Licencia:</strong> {reserva.conductor.licencia}</p>
                  {reserva.notas_vuelo && (
                    <p className="text-xs text-orange-600 font-medium"><strong>No. Vuelo:</strong> {reserva.notas_vuelo}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Liquidación de Alquiler
                </h4>
                <div className="text-xs space-y-1.5">
                  {reserva.desglose && (
                    <>
                      <div className="flex justify-between">
                        <span>Vehículo ({reserva.total_dias} días)</span>
                        <span>${reserva.desglose.subtotal_vehiculo.toFixed(2)}</span>
                      </div>
                      {reserva.desglose.subtotal_cobertura > 0 && (
                        <div className="flex justify-between">
                          <span>Cobertura de Seguro</span>
                          <span>+${reserva.desglose.subtotal_cobertura.toFixed(2)}</span>
                        </div>
                      )}
                      {reserva.desglose.subtotal_extras > 0 && (
                        <div className="flex justify-between">
                          <span>Servicios adicionales</span>
                          <span>+${reserva.desglose.subtotal_extras.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between text-base font-black text-foreground">
                    <span>Total a Pagar al Retirar:</span>
                    <span className="text-orange-600">${reserva.total_alquiler.toFixed(2)} {reserva.moneda}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Depósito en Tarjeta Requerido:</span>
                    <strong>${reserva.deposito_garantia_monto.toFixed(0)} {reserva.moneda}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Checklist Requisitos Obligatorios */}
            <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2 text-orange-400">
                <FileCheck className="h-4 w-4" />
                Documentos Requeridos al Retirar el Auto
              </h4>
              <ul className="text-xs space-y-1.5 text-zinc-300">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <strong>Licencia de Conducir física original:</strong> Válida con al menos 2 años de antigüedad.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <strong>Cédula o Pasaporte vigente:</strong> A nombre del conductor principal.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <strong>Tarjeta de Crédito física internacional:</strong> A nombre del conductor principal para retención del depósito de garantía (${reserva.deposito_garantia_monto} {reserva.moneda}). No se aceptan tarjetas de débito para fianza.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
