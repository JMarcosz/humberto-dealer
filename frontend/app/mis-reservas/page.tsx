'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Reserva } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Car, Calendar, ArrowLeft, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/format'

const ESTADO_STYLES: Record<string, { label: string; className: string }> = {
  EN_PROCESO:  { label: 'Activa',     className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  CANCELADA:   { label: 'Cancelada',  className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  CONFIRMADA:  { label: 'Confirmada', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
}

export default function MisReservasPage() {
  const router = useRouter()
  const [reservas, setReservas]   = useState<Reserva[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [reservaACancelar, setReservaACancelar] = useState<Reserva | null>(null)

  useEffect(() => {
    api.getMisReservas()
      .then(data => setReservas(data.filter(r => r.estado === 'EN_PROCESO')))
      .catch(err => {
        if (err.message?.includes('401')) {
          router.push('/login?redirect=/mis-reservas')
        } else {
          setError('No se pudieron cargar tus reservas.')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleCancelar = async () => {
    if (!reservaACancelar) return
    setCancelando(true)
    try {
      await api.cancelarReserva(reservaACancelar.id)
      setReservas(prev => prev.filter(r => r.id !== reservaACancelar.id))
    } catch {
      setError('No se pudo cancelar la reserva. Inténtalo de nuevo.')
    } finally {
      setCancelando(false)
      setReservaACancelar(null)
    }
  }

  const fmt = formatDate

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Reservas</h1>
          <p className="text-sm text-muted-foreground">Historial de vehículos que has reservado</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {reservas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Car className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-lg">No tienes reservas todavía</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cuando reserves un vehículo del catálogo aparecerá aquí.
              </p>
            </div>
            <Link href="/">
              <Button className="mt-2" style={{ background: '#FF5500', color: '#fff', border: 'none' }}>
                Ver catálogo
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reservas.map(reserva => {
            const estado = ESTADO_STYLES[reserva.estado] ?? ESTADO_STYLES.EN_PROCESO
            const activa = reserva.estado === 'EN_PROCESO'
            return (
              <Card key={reserva.id} className={activa ? 'border-orange-500/30' : ''}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="font-semibold">
                          {reserva.vehiculo_nombre ?? `Vehículo #${reserva.vehiculo_id}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Reservado el {fmt(reserva.creado_en)}
                      </div>
                      {reserva.notas && (
                        <p className="text-sm text-muted-foreground italic">"{reserva.notas}"</p>
                      )}
                    </div>
                    <Badge variant="outline" className={estado.className}>
                      {estado.label}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Link href={`/vehiculo/${reserva.vehiculo_id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Ver vehículo
                      </Button>
                    </Link>
                    {activa && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => setReservaACancelar(reserva)}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Confirmación cancelar */}
      <Dialog open={!!reservaACancelar} onOpenChange={() => setReservaACancelar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar reserva</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar la reserva de{' '}
              <strong>{reservaACancelar?.vehiculo_nombre ?? `Vehículo #${reservaACancelar?.vehiculo_id}`}</strong>?
              El vehículo volverá a estar disponible para otros clientes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReservaACancelar(null)}>Mantener reserva</Button>
            <Button variant="destructive" disabled={cancelando} onClick={handleCancelar}>
              {cancelando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
