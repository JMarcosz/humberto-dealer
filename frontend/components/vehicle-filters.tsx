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
import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import type { Marca, Modelo } from '@/lib/types'
import { api } from '@/lib/api'

export interface VehicleFilterValues {
  marca_id?: number
  marca_nombre?: string
  modelo_id?: number
  anio?: number
  tipo?: string
  transmision?: string
  combustible?: string
  orden?: string
  precioMin?: number
  precioMax?: number
  precioDiaMin?: number
  precioDiaMax?: number
  kilometrajeMax?: number
  busqueda?: string
}

interface VehicleFiltersProps {
  marcas: Marca[]
  onFilterChange: (filters: VehicleFilterValues) => void
  initialMarcaId?: number
  mode?: 'renta' | 'venta'
}

const TIPOS = ['sedan', 'suv', 'coupe', 'convertible', 'pickup', 'van', 'otro']
const AÑOS_RANGO = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i)

const COMBUSTIBLES = [
  { value: 'all', label: 'Todos' },
  { value: 'GASOLINA', label: 'Gasolina' },
  { value: 'DIESEL', label: 'Diésel' },
  { value: 'HIBRIDO', label: 'Híbrido' },
  { value: 'ELECTRICO', label: 'Eléctrico' },
]

const TRANSMISIONES = [
  { value: 'all', label: 'Todas' },
  { value: 'AUTOMATICA', label: 'Automática' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'CVT', label: 'CVT' },
]

const OPCIONES_ORDEN = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'precio_desc', label: 'Mayor precio' },
  { value: 'anio_desc', label: 'Año: más nuevo' },
  { value: 'kilometraje_asc', label: 'Menor kilometraje' },
]

export function VehicleFilters({ marcas, onFilterChange, initialMarcaId, mode = 'renta' }: VehicleFiltersProps) {
  const [filters, setFilters] = useState<VehicleFilterValues>(
    initialMarcaId ? { marca_id: initialMarcaId } : {}
  )
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Sliders independientes según modo
  const [precioVentaRange, setPrecioVentaRange] = useState([5000, 150000])
  const [precioDiaRange, setPrecioDiaRange] = useState([20, 200])
  const [kmMax, setKmMax] = useState(100000)

  const updateFilters = useCallback((newFilters: VehicleFilterValues) => {
    setFilters(newFilters)
    onFilterChange(newFilters)
  }, [onFilterChange])

  // Cargar modelos cuando cambia la marca
  useEffect(() => {
    if (filters.marca_id) {
      api.getModelosPorMarca(filters.marca_id).then(setModelos).catch(() => setModelos([]))
    } else {
      setModelos([])
    }
  }, [filters.marca_id])

  // Limpiar filtros de precio al cambiar de modo
  useEffect(() => {
    if (mode === 'renta') {
      const { precioMin, precioMax, ...rest } = filters
      updateFilters({ ...rest, precioDiaMin: precioDiaRange[0], precioDiaMax: precioDiaRange[1] })
    } else {
      const { precioDiaMin, precioDiaMax, ...rest } = filters
      updateFilters({ ...rest, precioMin: precioVentaRange[0], precioMax: precioVentaRange[1] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

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

  const handleTransmisionChange = (value: string) => {
    updateFilters({ ...filters, transmision: value === 'all' ? undefined : value })
  }

  const handleCombustibleChange = (value: string) => {
    updateFilters({ ...filters, combustible: value === 'all' ? undefined : value })
  }

  const handleOrdenChange = (value: string) => {
    updateFilters({ ...filters, orden: value })
  }

  const handlePrecioVentaChange = (value: number[]) => {
    setPrecioVentaRange(value)
    updateFilters({ ...filters, precioMin: value[0], precioMax: value[1] })
  }

  const handlePrecioDiaChange = (value: number[]) => {
    setPrecioDiaRange(value)
    updateFilters({ ...filters, precioDiaMin: value[0], precioDiaMax: value[1] })
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
    setPrecioVentaRange([5000, 150000])
    setPrecioDiaRange([20, 200])
    setKmMax(100000)
    onFilterChange({})
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => v !== undefined && k !== 'orden')

  const formatCurrency = (amount: number) => `US$ ${amount.toLocaleString('en-US')}`

  return (
    <div className="space-y-4">
      {/* Search Bar y Selector de Ordenamiento */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={mode === 'renta' ? "Buscar auto para rentar (marca, modelo, año)..." : "Buscar auto para comprar (marca, modelo, año)..."}
            className="pl-10 h-11"
            value={filters.busqueda || ''}
            onChange={handleSearchChange}
          />
        </div>

        {/* Dropdown de Ordenamiento */}
        <div className="w-full sm:w-56">
          <Select value={filters.orden || 'recientes'} onValueChange={handleOrdenChange}>
            <SelectTrigger className="h-11">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-orange-500" />
                <SelectValue placeholder="Ordenar por" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_ORDEN.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          className="gap-2 md:hidden h-11"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4 text-orange-500" />
          Filtros
        </Button>
      </div>

      {/* Grid de Filtros */}
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

          {/* Tipo / Categoría */}
          <div className="space-y-2">
            <Label>Carrocería</Label>
            <Select value={filters.tipo ?? 'all'} onValueChange={handleTipoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las carrocerías</SelectItem>
                {TIPOS.map(tipo => (
                  <SelectItem key={tipo} value={tipo} className="capitalize">{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transmisión */}
          <div className="space-y-2">
            <Label>Transmisión</Label>
            <Select value={filters.transmision ?? 'all'} onValueChange={handleTransmisionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera" />
              </SelectTrigger>
              <SelectContent>
                {TRANSMISIONES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Combustible */}
          <div className="space-y-2">
            <Label>Combustible</Label>
            <Select value={filters.combustible ?? 'all'} onValueChange={handleCombustibleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los combustibles" />
              </SelectTrigger>
              <SelectContent>
                {COMBUSTIBLES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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

          {/* Sliders Dinámicos de Presupuesto */}
          {mode === 'renta' ? (
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Tarifa Diaria (USD / día)</Label>
                <span className="text-xs font-bold text-orange-500">
                  {formatCurrency(precioDiaRange[0])}/día — {formatCurrency(precioDiaRange[1])}/día
                </span>
              </div>
              <Slider
                value={precioDiaRange}
                onValueChange={handlePrecioDiaChange}
                min={20}
                max={250}
                step={5}
                className="py-2"
              />
            </div>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Precio de Venta</Label>
                <span className="text-xs font-bold text-orange-500">
                  {formatCurrency(precioVentaRange[0])} — {formatCurrency(precioVentaRange[1])}
                </span>
              </div>
              <Slider
                value={precioVentaRange}
                onValueChange={handlePrecioVentaChange}
                min={5000}
                max={150000}
                step={2500}
                className="py-2"
              />
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-xs">
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
