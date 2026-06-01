// ============================================================
// TIPOS DE LA API FLASK (matches backend/models/catalog.py)
// ============================================================

export interface VehiculoImagenAPI {
  id: number
  url: string
  es_principal: boolean
  orden: number
}

export interface MarcaAPI {
  id: number
  nombre: string
  pais_origen?: string
  logo_url?: string
}

export interface ModeloAPI {
  id: number
  nombre: string
  marca: MarcaAPI
  categoria: string
}

export interface VehiculoAPI {
  id: number
  modelo: ModeloAPI
  anio: number
  vin: string
  color: string
  precio: number
  kilometraje: number
  combustible: string   // 'GASOLINA' | 'DIESEL' | 'HIBRIDO' | 'ELECTRICO' | 'GAS'
  transmision: string   // 'AUTOMATICA' | 'MANUAL' | 'CVT'
  descripcion?: string
  estado: string        // 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'BORRADOR' | 'PENDIENTE_VALIDACION'
  publicado_en?: string
  imagenes: VehiculoImagenAPI[]
}

// ============================================================
// TIPO PLANO PARA EL FRONTEND (usado por todos los componentes)
// ============================================================

export interface Vehicle {
  id: string
  modeloId: number
  marca: string
  modelo: string
  año: number
  precio: number
  tipo: string
  kilometraje: number
  combustible: string
  transmision: string
  color: string
  motor?: string
  potencia?: string
  traccion?: string
  puertas?: number
  asientos?: number
  descripcion?: string
  caracteristicas: string[]
  imagenes: string[]
  estado: 'disponible' | 'reservado' | 'vendido' | 'pendiente_validacion'
  destacado: boolean
  fechaPublicacion: string
  ubicacion: {
    direccion: string
    lat: number
    lng: number
  }
}

// ============================================================
// ADAPTADOR: VehiculoAPI → Vehicle (normaliza para el frontend)
// ============================================================

const ESTADO_MAP: Record<string, Vehicle['estado']> = {
  DISPONIBLE:           'disponible',
  RESERVADO:            'reservado',
  VENDIDO:              'vendido',
  BORRADOR:             'pendiente_validacion',
  PENDIENTE_VALIDACION: 'pendiente_validacion',
}

export function toVehicle(v: VehiculoAPI): Vehicle {
  const imagenes = [...v.imagenes]
    .sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0) || a.orden - b.orden)
    .map(img => img.url)

  const combustible = v.combustible?.toLowerCase() ?? 'gasolina'
  const transmision = v.transmision === 'AUTOMATICA' ? 'automatico'
    : v.transmision?.toLowerCase() ?? 'automatico'

  return {
    id:              String(v.id),
    modeloId:        v.modelo?.id ?? 0,
    marca:           v.modelo?.marca?.nombre ?? '',
    modelo:          v.modelo?.nombre ?? '',
    año:             v.anio,
    precio:          v.precio,
    tipo:            (v.modelo?.categoria ?? 'OTRO').toLowerCase(),
    kilometraje:     v.kilometraje,
    combustible,
    transmision,
    color:           v.color,
    descripcion:     v.descripcion,
    caracteristicas: [],          // no existe en schema actual — array vacío
    imagenes:        imagenes.length > 0 ? imagenes : ['/placeholder.jpg'],
    estado:          ESTADO_MAP[v.estado] ?? 'disponible',
    destacado:       v.estado === 'DISPONIBLE',
    fechaPublicacion: v.publicado_en ?? new Date().toISOString(),
    ubicacion: {
      direccion: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? 'Prol. Av. 27 de Febrero 467, Santo Domingo',
      lat: 18.463905,
      lng: -69.993384,
    },
  }
}

// ============================================================
// OTROS TIPOS (auth, reservas, ventas, reseñas)
// ============================================================

export interface Marca {
  id: number
  nombre: string
  pais_origen?: string
  logo_url?: string
}

export interface Modelo {
  id: number
  nombre: string
  marca: Marca
  categoria: string
}

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: { id: number; nombre: string }
  avatar_url?: string
  activo: boolean
}

export interface Reserva {
  id: number
  vehiculo_id: number
  cliente_id: number
  vehiculo_nombre?: string
  cliente_nombre?: string
  estado: string
  notas?: string
  creado_en: string
}

export interface Venta {
  id: number
  vehiculo_id: number
  cliente_id: number
  vehiculo_nombre?: string
  cliente_nombre?: string
  precio_final: number
  metodo_pago?: string
  fecha_hora: string
  ubicacion_desc?: string
}

export interface Resena {
  id: number
  vehiculo_id: number
  usuario_id: number
  calificacion: number
  usuario_nombre?: string
  comentario?: string
  creado_en: string
  likes_count: number
  liked_by_me: boolean
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  pages?: number
  items: T[]
}

export interface VehiculoFilters {
  marca_id?: number
  modelo_id?: number
  anio?: number
  combustible?: string
  transmision?: string
  precio_min?: number
  precio_max?: number
  tipo?: string
  kilometraje_max?: number
  busqueda?: string
  estado?: string
  page?: number
  per_page?: number
}

// Alias para compatibilidad con api.ts existente
export type { Marca as MarcaType, Modelo as ModeloType }

export interface Review {
  id: string
  vehiculoId: string
  userId: string
  userName: string
  userImage?: string
  rating: number
  comentario: string
  fecha: string
}