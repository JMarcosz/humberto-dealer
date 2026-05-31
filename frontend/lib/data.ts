/**
 * data.ts — Capa de acceso a datos para Server Components.
 * Todos los exports son async. Usa el api client → Flask backend → MySQL.
 * Para Client Components usa el api client directamente desde lib/api.ts.
 */

import { api } from './api'
import { toVehicle } from './types'
import type { Vehicle, Marca, Modelo } from './types'

// ---------------------------------------------------------------------------
// VEHÍCULOS
// ---------------------------------------------------------------------------

export async function getVehiculos(): Promise<Vehicle[]> {
  try {
    const res = await api.getVehiculos({ per_page: 100 })
    return res.items.map(toVehicle)
  } catch {
    return []
  }
}

export async function getVehiculoById(id: string | number): Promise<Vehicle | null> {
  try {
    const v = await api.getVehiculo(Number(id))
    return toVehicle(v)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// MARCAS
// ---------------------------------------------------------------------------

export async function getMarcasData(): Promise<Marca[]> {
  try {
    return await api.getMarcas()
  } catch {
    return []
  }
}

export async function getMarcas(): Promise<string[]> {
  const marcas = await getMarcasData()
  return marcas.map(m => m.nombre)
}

// ---------------------------------------------------------------------------
// MODELOS
// ---------------------------------------------------------------------------

export async function getModelosPorMarca(marcaId: number): Promise<Modelo[]> {
  try {
    return await api.getModelosPorMarca(marcaId)
  } catch {
    return []
  }
}

export async function getModelosByMarca(marcaNombre: string): Promise<string[]> {
  try {
    const marcasData = await getMarcasData()
    const marca = marcasData.find(
      m => m.nombre.toLowerCase() === marcaNombre.toLowerCase()
    )
    if (!marca) return []
    const modelos = await api.getModelosPorMarca(marca.id)
    return modelos.map(m => m.nombre)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// HELPERS DE FILTRO (client-side fallback)
// ---------------------------------------------------------------------------

export const TIPOS_VEHICULO = [
  'sedan', 'suv', 'coupe', 'convertible', 'pickup', 'van', 'otro'
] as const

export function filterVehiculosLocal(
  vehiculos: Vehicle[],
  filters: {
    marca?: string
    modelo?: string
    año?: number
    tipo?: string
    precioMin?: number
    precioMax?: number
    kilometrajeMax?: number
    busqueda?: string
  }
): Vehicle[] {
  return vehiculos.filter(v => {
    if (filters.marca && v.marca !== filters.marca) return false
    if (filters.modelo && v.modelo !== filters.modelo) return false
    if (filters.año && v.año !== filters.año) return false
    if (filters.tipo && v.tipo !== filters.tipo) return false
    if (filters.precioMin && v.precio < filters.precioMin) return false
    if (filters.precioMax && v.precio > filters.precioMax) return false
    if (filters.kilometrajeMax && v.kilometraje > filters.kilometrajeMax) return false
    if (filters.busqueda) {
      const search = filters.busqueda.toLowerCase()
      const text = `${v.marca} ${v.modelo} ${v.descripcion ?? ''} ${v.color}`.toLowerCase()
      if (!text.includes(search)) return false
    }
    return true
  })
}
