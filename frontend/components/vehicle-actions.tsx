'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageCircle, ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

interface VehicleActionsProps {
  vehicleId: string
  whatsappUrl: string
  estado: string
}

export function VehicleActions({ vehicleId, whatsappUrl, estado }: VehicleActionsProps) {
  const router = useRouter()
  const [reserving, setReserving] = useState(false)
  const [reserved, setReserved] = useState(false)
  const [reserveError, setReserveError] = useState<string | null>(null)

  // "Consultar compra" abre WhatsApp con mensaje predefinido
  const handleConsultar = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  // "Reservar" — intenta crear reserva; si no está logueado, redirige al login
  const handleReservar = async () => {
    setReserveError(null)
    setReserving(true)
    try {
      await api.crearReserva(Number(vehicleId), 'Solicitud de reserva desde el catálogo web')
      setReserved(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      // Si el error es 401 (no autenticado), redirigir al login
      if (msg.includes('401') || msg.toLowerCase().includes('no autenticado') || msg.toLowerCase().includes('unauthorized')) {
        router.push(`/login?redirect=/vehiculo/${vehicleId}`)
      } else {
        setReserveError('No se pudo crear la reserva. Inicia sesión o intenta de nuevo.')
      }
    } finally {
      setReserving(false)
    }
  }

  if (estado === 'vendido') return null

  return (
    <div className="space-y-3">
      {/* Consultar compra → WhatsApp */}
      <Button
        className="w-full gap-2 text-base h-12 font-semibold"
        onClick={handleConsultar}
      >
        <MessageCircle className="h-5 w-5" />
        Consultar compra
      </Button>

      {/* WhatsApp directo */}
      <Button variant="secondary" className="w-full gap-2 h-11" asChild>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-5 w-5" />
          WhatsApp
        </a>
      </Button>

      {/* Reservar */}
      {reserved ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-green-500 bg-green-500/10 px-4 py-3 text-green-600 font-medium">
          <CheckCircle2 className="h-5 w-5" />
          ¡Reserva creada con éxito!
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2 h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={handleReservar}
          disabled={reserving}
        >
          {reserving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Reservando...</>
          ) : (
            <><ShoppingCart className="h-4 w-4" /> Reservar</>
          )}
        </Button>
      )}

      {reserveError && (
        <p className="text-sm text-destructive text-center">{reserveError}</p>
      )}
    </div>
  )
}
