'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Venta } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, History, DollarSign } from 'lucide-react'

export default function HistorialPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getHistorialVentas({ per_page: 50 })
      .then(res => setVentas(res.items))
      .catch(() => setError('No se pudo cargar el historial. Verifica que el backend esté corriendo.'))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(price)

  const totalVentas = ventas.reduce((acc, v) => acc + (v.precio_final ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Historial de Ventas</h1>
        <p className="text-muted-foreground">Registro completo de ventas realizadas</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatPrice(totalVentas)}</div>
                <p className="text-xs text-muted-foreground">en {ventas.length} ventas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio por Venta</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {ventas.length > 0 ? formatPrice(totalVentas / ventas.length) : formatPrice(0)}
                </div>
                <p className="text-xs text-muted-foreground">valor promedio</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Registro de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Venta</TableHead>
                      <TableHead>Vehículo ID</TableHead>
                      <TableHead>Cliente ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Precio Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay ventas registradas.
                        </TableCell>
                      </TableRow>
                    ) : ventas.map(venta => (
                      <TableRow key={venta.id}>
                        <TableCell className="font-mono text-sm">#{venta.id}</TableCell>
                        <TableCell>Vehículo #{venta.vehiculo_id}</TableCell>
                        <TableCell>Cliente #{venta.cliente_id}</TableCell>
                        <TableCell>
                          <div>{formatDate(venta.fecha_hora)}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{venta.ubicacion_desc ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 font-semibold">
                            {formatPrice(venta.precio_final)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
