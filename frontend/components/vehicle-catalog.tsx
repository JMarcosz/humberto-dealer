'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toVehicle, type Vehicle } from '@/lib/types'
import { useMarcas } from '@/lib/queries'
import { GroupedVehicleCard, groupVehicles, type GroupedVehicle } from '@/components/grouped-vehicle-card'
import { VehicleFilters, type VehicleFilterValues } from '@/components/vehicle-filters'
import { Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const GROUPS_PER_PAGE = 12
const API_BATCH = 200

// ── Paginador numérico ────────────────────────────────────────────────────────
function Paginator({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null

  const getPages = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="mt-10 flex items-center justify-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 bg-card text-sm disabled:opacity-30 hover:border-orange-500 hover:text-orange-500 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="flex h-11 w-11 items-center justify-center text-sm text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors"
            style={page === p
              ? { background: '#FF5500', color: '#fff', borderColor: '#FF5500' }
              : { borderColor: 'hsl(var(--border) / 0.5)', background: 'hsl(var(--card))' }
            }
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 bg-card text-sm disabled:opacity-30 hover:border-orange-500 hover:text-orange-500 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Catálogo principal ────────────────────────────────────────────────────────
export function VehicleCatalog() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const pathname      = usePathname()
  const hasScrolled   = useRef(false)

  const [filters, setFilters] = useState<VehicleFilterValues>({})
  const [page,    setPage]    = useState(1)

  const marcaIdParam     = searchParams.get('marca_id')
  const marcaNombreParam = searchParams.get('marca_nombre')

  // React Query — marcas (5 min stale, compartida con BrandNav)
  const { data: marcas = [] } = useMarcas()

  // React Query — vehículos (1 min stale, se cachea entre navegaciones)
  const apiFilters = {
    marca_id:        filters.marca_id || (marcaIdParam ? Number(marcaIdParam) : undefined),
    modelo_id:       filters.modelo_id,
    anio:            filters.anio,
    precio_min:      filters.precioMin,
    precio_max:      filters.precioMax,
    tipo:            filters.tipo,
    kilometraje_max: filters.kilometrajeMax,
    busqueda:        filters.busqueda,
    per_page:        API_BATCH,
    page:            1,
  }
  const { data: vehiculosData, isLoading: loading } = useQuery({
    queryKey: ['vehiculos', apiFilters],
    queryFn:  () => api.getVehiculos(apiFilters),
    staleTime: 60_000,
  })

  const allUnits: Vehicle[] = useMemo(() => {
    if (!vehiculosData) return []
    const vehicles = vehiculosData.items.map(toVehicle)
    return [...vehicles].sort((a, b) => {
      if (a.destacado && !b.destacado) return -1
      if (!a.destacado && b.destacado) return 1
      return new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime()
    })
  }, [vehiculosData])

  const groups: GroupedVehicle[] = useMemo(() => groupVehicles(allUnits), [allUnits])

  // Reset página cuando cambian los filtros o la marca en URL
  useEffect(() => {
    setPage(1)
    hasScrolled.current = false
  }, [marcaIdParam, filters])

  // Scroll al catálogo cuando se selecciona una marca
  useEffect(() => {
    if (marcaIdParam && !loading && !hasScrolled.current) {
      hasScrolled.current = true
      setTimeout(() => {
        document.getElementById('catalogo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
    if (!marcaIdParam) hasScrolled.current = false
  }, [marcaIdParam, loading])

  const totalUnits  = allUnits.length
  const totalGroups = groups.length
  const totalPages  = Math.ceil(totalGroups / GROUPS_PER_PAGE)
  const visibleGroups = groups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE)

  const handleFilterChange = (newFilters: VehicleFilterValues) => setFilters(newFilters)

  const handlePageChange = (p: number) => {
    setPage(p)
    document.getElementById('catalogo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearMarcaFilter = () => router.push(pathname)

  return (
    <section id="catalogo-section" className="py-8">
      {marcaIdParam && marcaNombreParam && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
          <p className="text-sm">
            Mostrando: <span className="font-bold text-orange-500">{decodeURIComponent(marcaNombreParam)}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={clearMarcaFilter} className="gap-1">
            <X className="h-4 w-4" /> Quitar filtro
          </Button>
        </div>
      )}

      <div className="mb-8">
        <VehicleFilters marcas={marcas} onFilterChange={handleFilterChange} />
      </div>

      <div className="mb-6 flex items-center justify-between">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {totalGroups} modelo{totalGroups !== 1 ? 's' : ''}
            <span className="ml-1 text-xs">({totalUnits} unidades)</span>
            {totalPages > 1 && <span className="ml-2 text-xs">— Página {page} de {totalPages}</span>}
          </p>
        )}
      </div>

      {!loading && visibleGroups.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGroups.map(g => <GroupedVehicleCard key={g.modeloId} group={g} />)}
          </div>
          <Paginator page={page} totalPages={totalPages} onChange={handlePageChange} />
        </>
      ) : !loading ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">No se encontraron vehículos con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}
    </section>
  )
}
