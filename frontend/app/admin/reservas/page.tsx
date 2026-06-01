'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Reserva } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { Loader2, X, Eye, RefreshCw, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/format'

const PER_PAGE = 30

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  if (current > 3) pages.push('ellipsis')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('ellipsis')
  pages.push(total)
  return pages
}

const METODOS_PAGO = [
  { value: 'EFECTIVO',       label: 'Efectivo' },
  { value: 'TRANSFERENCIA',  label: 'Transferencia' },
  { value: 'TARJETA',        label: 'Tarjeta' },
  { value: 'FINANCIAMIENTO', label: 'Financiamiento' },
  { value: 'OTRO',           label: 'Otro' },
]

export default function ReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Confirmar venta
  const [reservaAConfirmar, setReservaAConfirmar] = useState<Reserva | null>(null)
  const [precioFinal, setPrecioFinal] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null)

  const totalPages = Math.ceil(total / PER_PAGE)

  const loadReservas = async (estado: string = filterStatus, p: number = page) => {
    setLoading(true)
    try {
      const res = await api.getTodasReservas({
        estado: estado === 'all' ? undefined : estado,
        page: p,
      })
      setReservas(res.items)
      setTotal(res.total)
    } catch (err) {
      console.error('Error cargando reservas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReservas() }, []) // eslint-disable-line

  const handlePage = (p: number) => {
    setPage(p)
    loadReservas(filterStatus, p)
  }

  const handleFilter = (estado: string) => {
    setFilterStatus(estado)
    setPage(1)
    loadReservas(estado, 1)
  }

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

  const abrirConfirmarVenta = (reserva: Reserva) => {
    setReservaAConfirmar(reserva)
    setPrecioFinal('')
    setMetodoPago('')
    setErrorConfirmar(null)
  }

  const handleConfirmarVenta = async () => {
    if (!reservaAConfirmar) return
    const precio = parseFloat(precioFinal.replace(/,/g, ''))
    if (!precio || precio <= 0) { setErrorConfirmar('Ingresa un precio válido.'); return }
    if (!metodoPago) { setErrorConfirmar('Selecciona el método de pago.'); return }

    setConfirmando(true)
    setErrorConfirmar(null)
    try {
      await api.confirmarVenta({
        vehiculo_id: reservaAConfirmar.vehiculo_id,
        cliente_id:  reservaAConfirmar.cliente_id,
        precio_final: precio,
        metodo_pago:  metodoPago,
        reserva_id:   reservaAConfirmar.id,
      })
      setReservas(prev => prev.map(r =>
        r.id === reservaAConfirmar.id ? { ...r, estado: 'CONFIRMADA' } : r
      ))
      setReservaAConfirmar(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorConfirmar(`No se pudo registrar la venta. ${msg}`)
    } finally {
      setConfirmando(false)
    }
  }

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

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reservas</h1>
          <p className="text-muted-foreground">Gestión de reservas activas y transición a venta</p>
        </div>
        <Button variant="outline" onClick={() => loadReservas(filterStatus, page)} className="gap-2">
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

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{total} reservas en total</p>
        <Select value={filterStatus} onValueChange={handleFilter}>
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
            ) : reservas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay reservas
                </TableCell>
              </TableRow>
            ) : reservas.map(reserva => (
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
                      title="Ver vehículo"
                      onClick={() => window.open(`/vehiculo/${reserva.vehiculo_id}`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {reserva.estado?.toUpperCase() === 'EN_PROCESO' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Confirmar venta"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => abrirConfirmarVenta(reserva)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Cancelar reserva"
                          onClick={() => handleCancelar(reserva.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination className="w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={page > 1 ? () => handlePage(page - 1) : undefined}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {pageNumbers.map((n, i) =>
                n === 'ellipsis' ? (
                  <PaginationItem key={`e-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === page}
                      onClick={() => n !== page && handlePage(n)}
                      className="cursor-pointer"
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={page < totalPages ? () => handlePage(page + 1) : undefined}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Dialog confirmar venta */}
      <Dialog open={!!reservaAConfirmar} onOpenChange={() => setReservaAConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar venta</DialogTitle>
            <DialogDescription>
              Registrar la venta de{' '}
              <strong>{reservaAConfirmar?.vehiculo_nombre ?? `Vehículo #${reservaAConfirmar?.vehiculo_id}`}</strong>
              {' '}a{' '}
              <strong>{reservaAConfirmar?.cliente_nombre ?? `Cliente #${reservaAConfirmar?.cliente_id}`}</strong>.
              El vehículo pasará a estado <strong>VENDIDO</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {errorConfirmar && (
              <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                {errorConfirmar}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="precio">Precio final (DOP)</Label>
              <Input
                id="precio"
                type="number"
                min="0"
                step="100"
                placeholder="Ej: 1500000"
                value={precioFinal}
                onChange={e => setPrecioFinal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metodo">Método de pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger id="metodo">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReservaAConfirmar(null)} disabled={confirmando}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarVenta}
              disabled={confirmando || !precioFinal || !metodoPago}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {confirmando
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registrando...</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar venta</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
