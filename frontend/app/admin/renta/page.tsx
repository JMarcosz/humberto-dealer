'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ReservaRenta } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Car,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Fuel,
  Loader2,
  FileText,
  AlertTriangle,
  RefreshCw,
  Gauge
} from 'lucide-react'

export default function AdminRentaPage() {
  const [reservas, setReservas] = useState<ReservaRenta[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('ALL')

  // Modales
  const [checkInModal, setCheckInModal] = useState<ReservaRenta | null>(null)
  const [checkOutModal, setCheckOutModal] = useState<ReservaRenta | null>(null)
  const [odometro, setOdometro] = useState('')
  const [cargoDanos, setCargoDanos] = useState('')
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [combustible, setCombustible] = useState('8/8')
  const [observaciones, setObservaciones] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const cargarReservas = async () => {
    setLoading(true)
    try {
      const res = await api.getAdminReservasRenta({
        estado: estadoFiltro === 'ALL' ? undefined : estadoFiltro,
        buscar: buscar.trim() || undefined,
      })
      setReservas(res.items)
    } catch (err) {
      console.error('Error cargando reservas de renta:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarReservas()
  }, [estadoFiltro])

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    cargarReservas()
  }

  const handleConfirmarCheckIn = async () => {
    if (!checkInModal || odometro === '') return
    setProcesando(true)
    try {
      await api.checkInRenta({
        pnr: checkInModal.pnr,
        odometro: Number(odometro),
        combustible,
        observaciones_danos: observaciones,
      })
      setMensajeExito(`Check-in exitoso para reserva ${checkInModal.pnr}. Vehículo entregado.`)
      setCheckInModal(null)
      setOdometro('')
      setObservaciones('')
      cargarReservas()
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error al registrar el Check-in')
    } finally {
      setProcesando(false)
    }
  }

  const handleConfirmarCheckOut = async () => {
    if (!checkOutModal || odometro === '') return
    setProcesando(true)
    try {
      const resultado = await api.checkOutRenta({
        pnr: checkOutModal.pnr,
        odometro: Number(odometro),
        combustible,
        observaciones_danos: observaciones,
        cargo_danos: cargoDanos === '' ? undefined : Number(cargoDanos),
      })
      setMensajeExito(resultado.mensaje)
      setCheckOutModal(null)
      setOdometro('')
      setObservaciones('')
      cargarReservas()
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error al registrar el Check-out')
    } finally {
      setProcesando(false)
    }
  }

  const badgeEstado = (estado: string) => {
    switch (estado) {
      case 'CONFIRMADA':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Confirmada</Badge>
      case 'EN_CURSO':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">En Renta</Badge>
      case 'COMPLETADA':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Completada</Badge>
      case 'CANCELADA':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>
      case 'NO_SHOW':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">No-show</Badge>
      case 'EXPIRADA':
        return <Badge className="bg-zinc-500/10 text-zinc-500 border-zinc-500/30">Expirada</Badge>
      default:
        return <Badge>{estado}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operaciones de Renta de Autos</h1>
          <p className="text-sm text-muted-foreground">
            Control de entregas (Check-in), devoluciones (Check-out) y gestión de flota en patio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={cargarReservas} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito(null)} className="text-xs font-bold underline">Cerrar</button>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border">
        <form onSubmit={handleBuscar} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por PNR (ej. HA-84920), nombre, cédula o email..."
              className="pl-9 h-10"
            />
          </div>
          <Button type="submit" size="sm">Buscar</Button>
        </form>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground font-semibold">Estado:</Label>
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger className="w-36 h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="CONFIRMADA">Confirmadas</SelectItem>
              <SelectItem value="EN_CURSO">En Curso</SelectItem>
              <SelectItem value="COMPLETADA">Completadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla de Reservas */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 font-bold">Código PNR</TableHead>
                <TableHead>Conductor Principal</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Fechas (Inicio / Fin)</TableHead>
                <TableHead>Total / Depósito</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones Operativas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
                    <p className="text-xs text-muted-foreground mt-2">Cargando contratos de renta...</p>
                  </TableCell>
                </TableRow>
              )}

              {!loading && reservas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No se encontraron reservas de renta con los filtros aplicados.
                  </TableCell>
                </TableRow>
              )}

              {!loading && reservas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-bold font-mono text-orange-600 dark:text-orange-400">
                    {r.pnr}
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold">{r.conductor.nombre} {r.conductor.apellido}</div>
                    <div className="text-xs text-muted-foreground">{r.conductor.telefono} • {r.conductor.documento}</div>
                  </TableCell>

                  <TableCell>
                    <div className="font-medium">{r.vehiculo_nombre}</div>
                    <div className="text-xs text-muted-foreground">{r.categoria} • {r.total_dias}d</div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <div><strong>In:</strong> {new Date(r.fecha_inicio).toLocaleDateString('es-DO')}</div>
                    <div><strong>Out:</strong> {new Date(r.fecha_fin).toLocaleDateString('es-DO')}</div>
                  </TableCell>

                  <TableCell>
                    <div className="font-bold">${r.total_alquiler.toFixed(2)} {r.moneda}</div>
                    <div className="text-[11px] text-muted-foreground">Fianza: ${r.deposito_garantia_monto.toFixed(0)}</div>
                  </TableCell>

                  <TableCell>
                    {badgeEstado(r.estado)}
                  </TableCell>

                  <TableCell className="text-right space-x-2">
                    <Link href={`/renta/confirmacion/${r.pnr}`} target="_blank">
                      <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Voucher
                      </Button>
                    </Link>

                    {r.estado === 'CONFIRMADA' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCheckInModal(r)
                          setOdometro('')
                        }}
                        className="h-8 px-2 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Entregar (Check-in)
                      </Button>
                    )}

                    {r.estado === 'EN_CURSO' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setCheckOutModal(r)
                          setOdometro('')
                        }}
                        className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                      >
                        Recibir (Check-out)
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal: Check-in (Entrega) */}
      <Dialog open={!!checkInModal} onOpenChange={() => setCheckInModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrega de Auto (Check-in)</DialogTitle>
            <DialogDescription>
              Reserva <strong>{checkInModal?.pnr}</strong> — {checkInModal?.vehiculo_nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="odo_in" className="text-xs font-semibold">Odómetro de Salida (Kilómetros) *</Label>
              <Input
                id="odo_in"
                type="number"
                required
                value={odometro}
                onChange={(e) => setOdometro(e.target.value)}
                placeholder="Ej. 15400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nivel de Combustible *</Label>
              <Select value={combustible} onValueChange={setCombustible}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8/8">8/8 (Tanque Lleno)</SelectItem>
                  <SelectItem value="6/8">6/8 (3/4 Tanque)</SelectItem>
                  <SelectItem value="4/8">4/8 (Medio Tanque)</SelectItem>
                  <SelectItem value="2/8">2/8 (1/4 Tanque)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs_in" className="text-xs font-semibold">Observaciones / Daños Preexistentes</Label>
              <Input
                id="obs_in"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Rayones, estado de llantas, herramientas..."
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs">
              Recuerda verificar la licencia física original y realizar la pre-autorización de <strong>${checkInModal?.deposito_garantia_monto} {checkInModal?.moneda}</strong> en el POS antes de entregar las llaves.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInModal(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmarCheckIn}
              disabled={procesando || odometro === ''}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {procesando ? 'Procesando...' : 'Confirmar y Entregar Llaves'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Check-out (Devolución) */}
      <Dialog open={!!checkOutModal} onOpenChange={() => setCheckOutModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Devolución de Auto (Check-out)</DialogTitle>
            <DialogDescription>
              Reserva <strong>{checkOutModal?.pnr}</strong> — {checkOutModal?.vehiculo_nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="odo_out" className="text-xs font-semibold">Odómetro de Entrada (Kilómetros) *</Label>
              <Input
                id="odo_out"
                type="number"
                required
                value={odometro}
                onChange={(e) => setOdometro(e.target.value)}
                placeholder="Ej. 15950"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nivel de Combustible al Recibir *</Label>
              <Select value={combustible} onValueChange={setCombustible}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8/8">8/8 (Tanque Lleno)</SelectItem>
                  <SelectItem value="6/8">6/8 (3/4 Tanque)</SelectItem>
                  <SelectItem value="4/8">4/8 (Medio Tanque)</SelectItem>
                  <SelectItem value="2/8">2/8 (1/4 Tanque)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cargo_danos" className="text-xs font-semibold">
                Cargo por Daños (USD) — opcional
              </Label>
              <Input
                id="cargo_danos"
                type="number"
                min="0"
                step="0.01"
                value={cargoDanos}
                onChange={(e) => setCargoDanos(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                El retraso y el combustible faltante los calcula el sistema automáticamente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs_out" className="text-xs font-semibold">Estado Físico / Incidencias de Devolución</Label>
              <Input
                id="obs_out"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Vehículo devuelto limpio sin incidencias..."
              />
            </div>

            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 text-xs">
              Al confirmar, el sistema liquidará la renta: calculará el retraso y el combustible
              faltante, marcará la reserva como <strong>COMPLETADA</strong> e indicará cuánto
              retener del depósito de <strong>${checkOutModal?.deposito_garantia_monto} {checkOutModal?.moneda}</strong>.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckOutModal(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmarCheckOut}
              disabled={procesando || odometro === ''}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {procesando ? 'Procesando...' : 'Finalizar Renta y Liberar Fianza'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
