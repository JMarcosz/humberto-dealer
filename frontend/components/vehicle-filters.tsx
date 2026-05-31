'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { Marca, Modelo } from '@/lib/types'
import { api } from '@/lib/api'

export interface VehicleFilterValues {
  marca_id?: number
  marca_nombre?: string
  modelo_id?: number
  anio?: number
  tipo?: string
  precioMin?: number
  precioMax?: number
  kilometrajeMax?: number
  busqueda?: string
}

interface VehicleFiltersProps {
  marcas: Marca[]
  onFilterChange: (filters: VehicleFilterValues) => void
  initialMarcaId?: number
}

const TIPOS = ['sedan', 'suv', 'coupe', 'convertible', 'pickup', 'van', 'otro']
const AÑOS_RANGO = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i)

export function VehicleFilters({ marcas, onFilterChange, initialMarcaId }: VehicleFiltersProps) {
  const [filters, setFilters] = useState<VehicleFilterValues>(
    initialMarcaId ? { marca_id: initialMarcaId } : {}
  )
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [precioRange, setPrecioRange] = useState([0, 300000])
  const [kmMax, setKmMax] = useState(100000)

  const updateFilters = useCallback((newFilters: VehicleFilterValues) => {
    setFilters(newFilters)
    onFilterChange(newFilters)
  }, [onFilterChange])

  // Load modelos when marca changes
  useEffect(() => {
    if (filters.marca_id) {
      api.getModelosPorMarca(filters.marca_id).then(setModelos).catch(() => setModelos([]))
    } else {
      setModelos([])
    }
  }, [filters.marca_id])

  const handleMarcaChange = (value: string) => {
    if (value === 'all') {
      const { marca_id, marca_nombre, modelo_id, ...rest } = filters
      updateFilters(rest)
    } else {
      const [idStr, ...nombreParts] = value.split('|')
      updateFilters({ ...filters, marca_id: Number(idStr), marca_nombre: nombreParts.join('|'), modelo_id: undefined })
    }
  }

  const handleModeloChange = (value: string) => {
    if (value === 'all') {
      const { modelo_id, ...rest } = filters
      updateFilters(rest)
    } else {
      updateFilters({ ...filters, modelo_id: Number(value) })
    }
  }

  const handleAñoChange = (value: string) => {
    updateFilters({ ...filters, anio: value === 'all' ? undefined : parseInt(value) })
  }

  const handleTipoChange = (value: string) => {
    updateFilters({ ...filters, tipo: value === 'all' ? undefined : value })
  }

  const handlePrecioChange = (value: number[]) => {
    setPrecioRange(value)
    updateFilters({ ...filters, precioMin: value[0], precioMax: value[1] })
  }

  const handleKmChange = (value: number[]) => {
    setKmMax(value[0])
    updateFilters({ ...filters, kilometrajeMax: value[0] })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ ...filters, busqueda: e.target.value || undefined })
  }

  const clearFilters = () => {
    setFilters({})
    setPrecioRange([0, 300000])
    setKmMax(100000)
    onFilterChange({})
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(price)

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, color..."
            className="pl-10"
            value={filters.busqueda || ''}
            onChange={handleSearchChange}
          />
        </div>
        <Button
          variant="outline"
          className="gap-2 md:hidden"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Filters */}
      <div className={`space-y-4 ${showFilters ? 'block' : 'hidden'} md:block`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marca */}
          <div className="space-y-2">
            <Label>Marca</Label>
            <Select
              value={filters.marca_id ? `${filters.marca_id}|${filters.marca_nombre ?? ''}` : 'all'}
              onValueChange={handleMarcaChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las marcas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {marcas.map(m => (
                  <SelectItem key={m.id} value={`${m.id}|${m.nombre}`}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modelo */}
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select
              value={filters.modelo_id?.toString() ?? 'all'}
              onValueChange={handleModeloChange}
              disabled={!filters.marca_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los modelos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los modelos</SelectItem>
                {modelos.map(m => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Año */}
          <div className="space-y-2">
            <Label>Año</Label>
            <Select value={filters.anio?.toString() ?? 'all'} onValueChange={handleAñoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los años" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                {AÑOS_RANGO.map(año => (
                  <SelectItem key={año} value={año.toString()}>{año}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={filters.tipo ?? 'all'} onValueChange={handleTipoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {TIPOS.map(tipo => (
                  <SelectItem key={tipo} value={tipo} className="capitalize">{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Price & Km Sliders */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Precio</Label>
              <span className="text-sm text-muted-foreground">
                {formatPrice(precioRange[0])} - {formatPrice(precioRange[1])}
              </span>
            </div>
            <Slider value={precioRange} onValueChange={handlePrecioChange} min={0} max={300000} step={5000} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Kilometraje máximo</Label>
              <span className="text-sm text-muted-foreground">
                {new Intl.NumberFormat('es-DO').format(kmMax)} km
              </span>
            </div>
            <Slider value={[kmMax]} onValueChange={handleKmChange} min={0} max={100000} step={1000} />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
