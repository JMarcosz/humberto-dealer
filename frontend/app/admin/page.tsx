'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Car, DollarSign, ShoppingCart, Clock } from 'lucide-react'

export default function AdminDashboard() {
  const [vehiculos, setVehiculos] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getVehiculosAdmin({ per_page: 100 })
      .then(res => setVehiculos(res.items.map(toVehicle)))
      .catch(() => setVehiculos([]))
      .finally(() => setLoading(false))
  }, [])

  const disponibles  = vehiculos.filter(v => v.estado === 'disponible').length
  const reservados   = vehiculos.filter(v => v.estado === 'reservado').length
  const vendidos     = vehiculos.filter(v => v.estado === 'vendido').length
  const pendientes   = vehiculos.filter(v => v.estado === 'pendiente_validacion').length

  const totalValorInventario = vehiculos
    .filter(v => v.estado === 'disponible')
    .reduce((acc, v) => acc + v.precio, 0)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(price)

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
            <div className="text-2xl font-bold">{disponibles}</div>
            <p className="text-xs text-muted-foreground">vehículos en catálogo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservados</CardTitle>
            <ShoppingCart className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservados}</div>
            <p className="text-xs text-muted-foreground">pendientes de venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendidos</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendidos}</div>
            <p className="text-xs text-muted-foreground">este período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendientes}</div>
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
            {formatPrice(totalValorInventario)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Valor total de {disponibles} vehículos disponibles
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vehículos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {vehiculos.slice(0, 5).map(vehicle => (
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
            {vehiculos.length === 0 && (
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
