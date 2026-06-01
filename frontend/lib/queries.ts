/**
 * queries.ts — Hooks de TanStack Query reutilizables.
 * Centraliza staleTime, deduplicación y caché entre navegaciones.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { toVehicle, type VehiculoFilters } from './types'

export const useCurrentUser = () =>
  useQuery({
    queryKey: ['currentUser'],
    queryFn:  () => api.getCurrentUser(),
    retry:    false,
    staleTime: 60_000,
  })

export const useMarcas = () =>
  useQuery({
    queryKey: ['marcas'],
    queryFn:  () => api.getMarcas(),
    staleTime: 5 * 60_000,
  })

export const useModelos = (marcaId?: number) =>
  useQuery({
    queryKey: ['modelos', marcaId],
    queryFn:  () => api.getModelosPorMarca(marcaId!),
    enabled:  !!marcaId,
    staleTime: 5 * 60_000,
  })

export const useVehiculos = (filters: VehiculoFilters) =>
  useQuery({
    queryKey: ['vehiculos', filters],
    queryFn:  () => api.getVehiculos(filters),
    staleTime: 60_000,
  })

export const useVehiculo = (id: number | string) =>
  useQuery({
    queryKey: ['vehiculo', Number(id)],
    queryFn:  () => api.getVehiculo(Number(id)).then(v => toVehicle(v)),
    enabled:  !!id,
    staleTime: 5 * 60_000,
  })

export const useResenas = (vehiculoId: number) =>
  useQuery({
    queryKey: ['resenas', vehiculoId],
    queryFn:  () => api.getResenas(vehiculoId),
    staleTime: 30_000,
  })
