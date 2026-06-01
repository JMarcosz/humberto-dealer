'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Car, DollarSign, ShoppingCart, Clock } from 'lucide-react'

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ disponibles: 0, reservados: 0, vendidos: 0, pendientes: 0 })
  const [valorInventario, setValorInventario] = useState(0)
  const [recientes, setRecientes] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(price)

  useEffect(() => {
    Promise.all([
      api.getVehiculosAdmin({ estado: 'DISPONIBLE',            per_page: 1 }),
      api.getVehiculosAdmin({ estado: 'RESERVADO',             per_page: 1 }),
      api.getVehiculosAdmin({ estado: 'VENDIDO',               per_page: 1 }),
      api.getVehiculosAdmin({ estado: 'PENDIENTE_VALIDACION',  per_page: 1 }),
      api.getVehiculosAdmin({ per_page: 5 }),
      api.getVehiculosAdmin({ estado: 'DISPONIBLE', per_page: 500 }),
    ])
      .then(([disp, res, ven, pend, ult, dispAll]) => {
        setCounts({
          disponibles: disp.total,
          reservados:  res.total,
          vendidos:    ven.total,
          pendientes:  pend.total,
        })
        setRecientes(ult.items.map(toVehicle))
        setValorInventario(
          dispAll.items.map(toVehicle).reduce((acc, v) => acc + v.precio, 0)
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del inventario y ventas</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
            <Car className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.disponibles}</div>
            <p className="text-xs text-muted-foreground">vehículos en catálogo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservados</CardTitle>
            <ShoppingCart className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.reservados}</div>
            <p className="text-xs text-muted-foreground">pendientes de venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendidos</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.vendidos}</div>
            <p className="text-xs text-muted-foreground">este período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.pendientes}</div>
            <p className="text-xs text-muted-foreground">por validar</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Valor del Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {formatPrice(valorInventario)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Valor total de {counts.disponibles} vehículos disponibles
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...recientes]
              .sort((a, b) => new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime())
              .map(vehicle => (
              <div key={vehicle.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{vehicle.marca} {vehicle.modelo}</p>
                  <p className="text-sm text-muted-foreground">{vehicle.año} - {formatPrice(vehicle.precio)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  vehicle.estado === 'disponible'            ? 'bg-green-500/10 text-green-600'   :
                  vehicle.estado === 'reservado'             ? 'bg-yellow-500/10 text-yellow-600' :
                  vehicle.estado === 'vendido'               ? 'bg-red-500/10 text-red-600'       :
                  'bg-gray-500/10 text-gray-600'
                }`}>
                  {vehicle.estado === 'pendiente_validacion' ? 'Pendiente' : vehicle.estado}
                </span>
              </div>
            ))}
            {recientes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin datos — asegúrate de que el backend Flask está corriendo.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
