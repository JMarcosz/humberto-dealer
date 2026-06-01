'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { useRouter } from 'next/navigation'
import { Loader2, Search, MoreHorizontal, Eye, Check, RefreshCw, Plus, Trash2, CheckCheck } from 'lucide-react'

const PER_PAGE = 20

// Genera la secuencia de páginas: [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const left  = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2)       pages.push('ellipsis')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

export default function VehiculosPage() {
  const router = useRouter()
  const [vehiculos, setVehiculos]       = useState<Vehicle[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage]                 = useState(1)
  const [totalPages, setTotalPages]     = useState(1)
  const [total, setTotal]               = useState(0)

  const [seleccionados, setSeleccionados]           = useState<Set<string>>(new Set())
  const [seleccionTodosLote, setSeleccionTodosLote] = useState(false)
  const [cargandoIds, setCargandoIds]               = useState(false)
  const [confirmBulk, setConfirmBulk]               = useState(false)
  const [confirmBulkApprove, setConfirmBulkApprove] = useState(false)
  const [eliminando, setEliminando]                 = useState(false)
  const [aprobando, setAprobando]                   = useState(false)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadVehiculos = useCallback(async (opts: {
    page?: number; estado?: string; buscar?: string
  } = {}) => {
    setLoading(true)
    setLoadError(null)
    setSeleccionados(new Set())
    setSeleccionTodosLote(false)
    try {
      const res = await api.getVehiculosAdmin({
        page:     opts.page ?? 1,
        per_page: PER_PAGE,
        estado:   !opts.estado || opts.estado === 'all' ? undefined : opts.estado,
        buscar:   opts.buscar ?? undefined,
      })
      setVehiculos(res.items.map(toVehicle))
      setTotal(res.total)
      setTotalPages((res as any).pages ?? Math.ceil(res.total / PER_PAGE))
    } catch {
      setLoadError('No se pudieron cargar los vehículos. Verifica tu sesión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadVehiculos() }, [loadVehiculos])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      loadVehiculos({ page: 1, estado: statusFilter, buscar: value })
    }, 350)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
    loadVehiculos({ page: 1, estado: value, buscar: search })
  }

  const handlePage = (newPage: number) => {
    setPage(newPage)
    loadVehiculos({ page: newPage, estado: statusFilter, buscar: search })
  }

  const handleRefresh = () => {
    setPage(1)
    setSearch('')
    setStatusFilter('all')
    loadVehiculos()
  }

  // ── Selección cross-page ───────────────────────────────────────
  const eliminables       = vehiculos.filter(v => v.estado === 'pendiente_validacion')
  const todosVisiblesSeleccionados =
    eliminables.length > 0 && eliminables.every(v => seleccionados.has(v.id))
  const mostrarBannerLote =
    todosVisiblesSeleccionados && !seleccionTodosLote && total > vehiculos.length

  const handleSeleccionarTodosLote = async () => {
    setCargandoIds(true)
    try {
      const res = await api.getVehiculoIdsAdmin({
        estado: statusFilter === 'all' ? 'pendiente_validacion' : statusFilter,
        buscar: search,
      })
      setSeleccionados(new Set(res.ids.map(String)))
      setSeleccionTodosLote(true)
    } catch {
      alert('Error al obtener todos los IDs.')
    } finally {
      setCargandoIds(false)
    }
  }

  const toggleSeleccion = (id: string) => {
    setSeleccionTodosLote(false)
    setSeleccionados(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleTodosVisibles = () => {
    setSeleccionTodosLote(false)
    setSeleccionados(todosVisiblesSeleccionados ? new Set() : new Set(eliminables.map(v => v.id)))
  }

  // ── Cambiar estado individual ──────────────────────────────────
  const handleEstadoChange = async (vehiculoId: string, newEstado: string) => {
    const estadoMap: Record<string, string> = {
      disponible: 'DISPONIBLE', reservado: 'RESERVADO',
      vendido: 'VENDIDO', pendiente_validacion: 'PENDIENTE_VALIDACION',
    }
    try {
      await api.cambiarEstadoVehiculo(Number(vehiculoId), estadoMap[newEstado] ?? newEstado.toUpperCase())
      setVehiculos(prev => prev.map(v =>
        v.id === vehiculoId ? { ...v, estado: newEstado as Vehicle['estado'] } : v
      ))
    } catch {
      alert('Error al cambiar estado. Verifica permisos de admin.')
    }
  }

  // ── Eliminar individual ────────────────────────────────────────
  const handleEliminar = async (vehiculoId: string) => {
    if (!confirm('¿Eliminar este vehículo? Esta acción no se puede deshacer.')) return
    try {
      await api.eliminarBorrador(Number(vehiculoId))
      setVehiculos(prev => prev.filter(v => v.id !== vehiculoId))
      setTotal(t => t - 1)
      setSeleccionados(prev => { const s = new Set(prev); s.delete(vehiculoId); return s })
    } catch {
      alert('No se puede eliminar un vehículo disponible, reservado o vendido.')
    }
  }

  // ── Aprobar individual ─────────────────────────────────────────
  const handleApprove = async (vehiculoId: string) => {
    try {
      await api.publicarBorrador(Number(vehiculoId))
      setVehiculos(prev => prev.map(v =>
        v.id === vehiculoId ? { ...v, estado: 'disponible' } : v
      ))
    } catch (err) {
      console.error('Error aprobando:', err)
    }
  }

  // ── Bulk eliminar — 1 sola petición ───────────────────────────
  const handleEliminarSeleccionados = async () => {
    setEliminando(true)
    setConfirmBulk(false)
    try {
      const ids = Array.from(seleccionados).map(Number)
      await api.eliminarBorradorLote(ids)
      setSeleccionados(new Set())
      setSeleccionTodosLote(false)
      loadVehiculos({ page, estado: statusFilter, buscar: search })
    } catch {
      alert('Error al eliminar los vehículos.')
      setEliminando(false)
    }
  }

  // ── Bulk aprobar — 1 sola petición ────────────────────────────
  const handleAprobarSeleccionados = async () => {
    setAprobando(true)
    setConfirmBulkApprove(false)
    try {
      const ids = Array.from(seleccionados).map(Number)
      await api.publicarBorradorLote(ids)
      setSeleccionados(new Set())
      setSeleccionTodosLote(false)
      loadVehiculos({ page, estado: statusFilter, buscar: search })
    } catch {
      alert('Error al publicar los vehículos.')
      setAprobando(false)
    }
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(p)

  const estadoStyles: Record<string, string> = {
    disponible:           'bg-green-500/10 text-green-600 border-green-500/20',
    reservado:            'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    vendido:              'bg-red-500/10 text-red-600 border-red-500/20',
    pendiente_validacion: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  }

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vehículos</h1>
          <p className="text-muted-foreground">
            {total > 0 ? `${total} vehículo${total !== 1 ? 's' : ''} en total` : 'Gestión del inventario'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={() => router.push('/admin/vehiculos/nuevo')} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Vehículo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca o modelo..."
            className="pl-10"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="disponible">Disponible</SelectItem>
            <SelectItem value="reservado">Reservado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
            <SelectItem value="pendiente_validacion">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Barra bulk */}
      {seleccionados.size > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 px-4 py-3">
            <span className="text-sm font-medium">
              {seleccionados.size} vehículo{seleccionados.size > 1 ? 's' : ''} seleccionado{seleccionados.size > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSeleccionados(new Set()); setSeleccionTodosLote(false) }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                disabled={aprobando || eliminando}
                onClick={() => setConfirmBulkApprove(true)}
              >
                {aprobando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                Marcar disponibles
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={eliminando || aprobando}
                onClick={() => setConfirmBulk(true)}
              >
                {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </Button>
            </div>
          </div>

          {/* Banner seleccionar todos */}
          {mostrarBannerLote && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-2 text-sm text-center">
              Los {vehiculos.length} vehículos de esta página están seleccionados.{' '}
              <button
                className="font-semibold text-blue-600 hover:underline disabled:opacity-50"
                disabled={cargandoIds}
                onClick={handleSeleccionarTodosLote}
              >
                {cargandoIds
                  ? 'Cargando...'
                  : `Seleccionar los ${total} vehículos del filtro`}
              </button>
            </div>
          )}
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                {eliminables.length > 0 && (
                  <Checkbox
                    checked={todosVisiblesSeleccionados}
                    onCheckedChange={toggleTodosVisibles}
                    aria-label="Seleccionar todos en esta página"
                  />
                )}
              </TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>Precio</TableHead>
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
            ) : vehiculos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron vehículos
                </TableCell>
              </TableRow>
            ) : vehiculos.map(vehicle => {
              const esEliminable     = vehicle.estado === 'pendiente_validacion'
              const estaSeleccionado = seleccionados.has(vehicle.id)
              return (
                <TableRow key={vehicle.id} className={estaSeleccionado ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''}>
                  <TableCell>
                    {esEliminable && (
                      <Checkbox
                        checked={estaSeleccionado}
                        onCheckedChange={() => toggleSeleccion(vehicle.id)}
                        aria-label="Seleccionar vehículo"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{vehicle.marca} {vehicle.modelo}</div>
                    <div className="text-sm text-muted-foreground capitalize">{vehicle.tipo}</div>
                  </TableCell>
                  <TableCell>{vehicle.año}</TableCell>
                  <TableCell>{formatPrice(vehicle.precio)}</TableCell>
                  <TableCell>
                    <Select value={vehicle.estado} onValueChange={val => handleEstadoChange(vehicle.id, val)}>
                      <SelectTrigger className="w-44">
                        <Badge variant="outline" className={estadoStyles[vehicle.estado] ?? ''}>
                          {vehicle.estado === 'pendiente_validacion' ? 'Pendiente' : vehicle.estado}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="reservado">Reservado</SelectItem>
                        <SelectItem value="vendido">Vendido</SelectItem>
                        <SelectItem value="pendiente_validacion">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(vehicle.estado === 'disponible' || vehicle.estado === 'reservado') && (
                          <DropdownMenuItem onClick={() => window.open(`/vehiculo/${vehicle.id}`, '_blank')}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver ficha
                          </DropdownMenuItem>
                        )}
                        {vehicle.estado === 'pendiente_validacion' && (
                          <DropdownMenuItem onClick={() => handleApprove(vehicle.id)}>
                            <Check className="h-4 w-4 mr-2" />
                            Aprobar y publicar
                          </DropdownMenuItem>
                        )}
                        {vehicle.estado === 'pendiente_validacion' && (
                          <DropdownMenuItem
                            onClick={() => handleEliminar(vehicle.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Paginador numerado */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total} vehículos
          </p>
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
                      className={n !== page ? 'cursor-pointer' : ''}
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

      {/* Confirmación aprobar */}
      <Dialog open={confirmBulkApprove} onOpenChange={setConfirmBulkApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como disponibles</DialogTitle>
            <DialogDescription>
              ¿Deseas publicar {seleccionados.size} vehículo{seleccionados.size > 1 ? 's' : ''} en el catálogo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkApprove(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAprobarSeleccionados}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <Dialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar vehículos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar {seleccionados.size} vehículo{seleccionados.size > 1 ? 's' : ''}?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulk(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminarSeleccionados}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
