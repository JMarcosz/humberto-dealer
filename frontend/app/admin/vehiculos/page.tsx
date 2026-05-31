'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { Loader2, Search, MoreHorizontal, Eye, Check, RefreshCw, Plus } from 'lucide-react'

export default function VehiculosPage() {
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadVehiculos = async (estado?: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await api.getVehiculosAdmin({
        per_page: 100,
        estado: estado === 'all' ? undefined : estado,
      })
      setVehiculos(res.items.map(toVehicle))
    } catch (err) {
      console.error('Error cargando vehículos:', err)
      setLoadError('No se pudieron cargar los vehículos. Verifica tu sesión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVehiculos() }, [])

  const handleStatusChange = async (vehiculoId: string, newEstado: string) => {
    // Map frontend estado → backend ENUM
    const estadoMap: Record<string, string> = {
      disponible: 'DISPONIBLE',
      reservado: 'RESERVADO',
      vendido: 'VENDIDO',
      pendiente_validacion: 'PENDIENTE_VALIDACION',
    }
    try {
      await api.cambiarEstadoVehiculo(Number(vehiculoId), estadoMap[newEstado] ?? newEstado.toUpperCase())
      setVehiculos(prev => prev.map(v =>
        v.id === vehiculoId ? { ...v, estado: newEstado as Vehicle['estado'] } : v
      ))
    } catch (err) {
      console.error('Error cambiando estado:', err)
      alert('Error al cambiar estado. Verifica permisos de admin.')
    }
  }

  const handleApprove = async (vehiculoId: string) => {
    try {
      await api.publicarBorrador(Number(vehiculoId))
      setVehiculos(prev => prev.map(v =>
        v.id === vehiculoId ? { ...v, estado: 'disponible' } : v
      ))
    } catch (err) {
      console.error('Error aprobando borrador:', err)
    }
  }

  const filtered = vehiculos.filter(v => {
    const matchSearch = `${v.marca} ${v.modelo}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || v.estado === statusFilter
    return matchSearch && matchStatus
  })

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(p)

  const estadoStyles: Record<string, string> = {
    disponible: 'bg-green-500/10 text-green-600 border-green-500/20',
    reservado: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    vendido: 'bg-red-500/10 text-red-600 border-red-500/20',
    pendiente_validacion: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vehículos</h1>
          <p className="text-muted-foreground">Gestión del inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadVehiculos()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={() => router.push('/admin/vehiculos/nuevo')} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Vehículo
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca o modelo..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); loadVehiculos(v) }}>
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

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron vehículos
                </TableCell>
              </TableRow>
            ) : filtered.map(vehicle => (
              <TableRow key={vehicle.id}>
                <TableCell>
                  <div className="font-medium">{vehicle.marca} {vehicle.modelo}</div>
                  <div className="text-sm text-muted-foreground capitalize">{vehicle.tipo}</div>
                </TableCell>
                <TableCell>{vehicle.año}</TableCell>
                <TableCell>{formatPrice(vehicle.precio)}</TableCell>
                <TableCell>
                  <Select
                    value={vehicle.estado}
                    onValueChange={val => handleStatusChange(vehicle.id, val)}
                  >
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
                      <DropdownMenuItem onClick={() => window.open(`/vehiculo/${vehicle.id}`, '_blank')}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver ficha
                      </DropdownMenuItem>
                      {vehicle.estado === 'pendiente_validacion' && (
                        <DropdownMenuItem onClick={() => handleApprove(vehicle.id)}>
                          <Check className="h-4 w-4 mr-2" />
                          Aprobar y publicar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
