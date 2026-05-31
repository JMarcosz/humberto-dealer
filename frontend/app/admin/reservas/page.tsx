'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Reserva } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, X, Eye, RefreshCw } from 'lucide-react'

export default function ReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')

  const loadReservas = async (estado?: string) => {
    setLoading(true)
    try {
      const res = await api.getTodasReservas({
        estado: estado === 'all' ? undefined : estado?.toUpperCase(),
        page: 1,
      })
      setReservas(res.items)
    } catch (err) {
      console.error('Error cargando reservas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReservas() }, [])

  const handleCancelar = async (id: number) => {
    if (!confirm('¿Cancelar esta reserva? El vehículo volverá a DISPONIBLE.')) return
    try {
      await api.cancelarReserva(id)
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'CANCELADA' } : r))
    } catch (err) {
      console.error('Error cancelando reserva:', err)
      alert('Error al cancelar. Verifica permisos.')
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  const filtered = reservas.filter(r =>
    filterStatus === 'all' || r.estado?.toUpperCase() === filterStatus.toUpperCase()
  )

  const enProceso   = reservas.filter(r => r.estado?.toUpperCase() === 'EN_PROCESO').length
  const canceladas  = reservas.filter(r => r.estado?.toUpperCase() === 'CANCELADA').length
  const confirmadas = reservas.filter(r => r.estado?.toUpperCase() === 'CONFIRMADA').length

  const estadoStyle = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case 'EN_PROCESO':  return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'CONFIRMADA':  return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'CANCELADA':   return 'bg-red-500/10 text-red-600 border-red-500/20'
      default:            return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reservas</h1>
          <p className="text-muted-foreground">Gestión de reservas activas y transición a venta</p>
        </div>
        <Button variant="outline" onClick={() => loadReservas(filterStatus)} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{enProceso}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{confirmadas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{canceladas}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); loadReservas(v) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="EN_PROCESO">En Proceso</SelectItem>
            <SelectItem value="CONFIRMADA">Confirmada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay reservas
                </TableCell>
              </TableRow>
            ) : filtered.map(reserva => (
              <TableRow key={reserva.id}>
                <TableCell className="font-mono text-sm">#{reserva.id}</TableCell>
                <TableCell>{reserva.vehiculo_nombre ?? `Vehículo #${reserva.vehiculo_id}`}</TableCell>
                <TableCell>{reserva.cliente_nombre ?? `Cliente #${reserva.cliente_id}`}</TableCell>
                <TableCell>{formatDate(reserva.creado_en)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={estadoStyle(reserva.estado)}>
                    {reserva.estado}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/vehiculo/${reserva.vehiculo_id}`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {reserva.estado?.toUpperCase() === 'EN_PROCESO' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelar(reserva.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
