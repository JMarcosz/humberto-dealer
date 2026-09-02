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

// ============================================================
// TIPOS DE RENTA DE AUTOS (CAR RENTAL ENGINE)
// ============================================================

export interface Sucursal {
  id: number
  nombre: string
  codigo_aeropuerto?: string | null
  direccion: string
  ciudad: string
  telefono?: string | null
  horario_atencion: string
  latitud?: number | null
  longitud?: number | null
  activo: boolean
}

export interface CoberturaSeguro {
  id: number
  codigo: string
  nombre: string
  costo_dia: number
  /** Porcentaje que esta cobertura reduce sobre el deposito base del vehiculo. */
  reduccion_deposito_pct: number
  deducible_monto: number
  descripcion?: string
  bullets: string[]
  destacado: boolean
}

export interface ExtraServicio {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  costo_dia: number
  es_pago_unico: boolean
  icono?: string
}

export interface RentalVehicleTarifa {
  precio_por_dia: number
  dias: number
  total_estimado: number
  deposito_garantia: number
  moneda: string
}

export interface RentalVehicle {
  id: number
  marca: string
  modelo: string
  categoria: string
  anio: number
  color: string
  combustible: string
  transmision: string
  pasajeros: number
  maletas_grandes: number
  maletas_pequenas: number
  tiene_aire_acondicionado: boolean
  kilometraje_incluido: string
  politica_combustible: string
  tarifa: RentalVehicleTarifa
  imagenes: { id: number; url: string; es_principal: boolean }[]
  imagen_principal?: string | null
}

export interface DisponibilidadRentaResponse {
  dias_facturables: number
  fecha_inicio: string
  fecha_fin: string
  total_disponibles: number
  vehiculos: RentalVehicle[]
}

export interface ConductorPayload {
  nombre: string
  apellido: string
  email: string
  telefono: string
  documento: string
  licencia: string
  fecha_nacimiento: string
}

/** Estados de una reserva de renta, alineados con el ENUM del backend. */
export type EstadoReservaRenta =
  | 'CONFIRMADA' | 'EN_CURSO' | 'COMPLETADA'
  | 'CANCELADA'  | 'NO_SHOW'  | 'EXPIRADA'

/**
 * Segundo factor del voucher publico. Nunca viaja en la URL de la pagina:
 * quedaria en el historial, en el Referer y en los logs de acceso.
 */
export interface FactorVoucher {
  apellido?: string
  doc4?: string
}

/**
 * Constantes de politica publicadas por el backend (`GET /api/renta/politica`).
 *
 * La UI las consume para constrenir sus inputs. Ningun umbral de negocio se
 * codifica en el frontend.
 */
export interface PoliticaRenta {
  duracion_minima_horas: number
  duracion_maxima_dias: number
  lead_time_minimo_minutos: number
  horizonte_maximo_dias: number
  edad_minima: number
  edad_maxima: number
  young_driver_edad_max: number
  young_driver_cargo_dia: number
  extras_cantidad_maxima: number
  extras_distintos_maximo: number
  reservas_activas_maximas: number
  deposito_minimo: number
  niveles_combustible: string[]
  terminos_version: string
}

/** Desglose calculado por el backend. El frontend no recalcula ninguna cifra. */
export interface CotizacionRenta {
  vehiculo_id: number
  cobertura_id: number
  dias_facturables: number
  tarifa_diaria: number
  subtotal_vehiculo: number
  subtotal_cobertura: number
  subtotal_extras: number
  recargo_young_driver: number
  total_alquiler: number
  deposito_garantia: number
  moneda: string
  edad_conductor: number | null
  es_young_driver: boolean
  extras: {
    extra_id: number
    nombre: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
  coberturas_disponibles: {
    cobertura_id: number
    codigo: string
    nombre: string
    costo_dia: number
    /** Ya calculado para ESTE vehiculo: la UI no aplica la formula. */
    deposito_garantia: number
    subtotal: number
  }[]
}

/** Conductor tal como lo devuelve el voucher publico: PII enmascarada. */
export interface ConductorVoucher {
  nombre: string
  apellido: string
  email: string
  telefono: string
  documento: string
  licencia: string
  fecha_nacimiento?: string
}

export interface ReservaRentaPayload {
  vehiculo_id: number
  sucursal_recogida_id: number
  sucursal_devolucion_id: number
  fecha_inicio: string
  fecha_fin: string
  cobertura_id: number
  extras_ids: number[]
  conductor: ConductorPayload
  notas_vuelo?: string
  /** Prueba de aceptacion del contrato; el backend la persiste con version e IP. */
  acepta_terminos?: boolean
}

export interface ReservaRenta {
  id: number
  pnr: string
  estado: EstadoReservaRenta
  vehiculo_id: number
  vehiculo_nombre: string
  categoria?: string
  fecha_inicio: string
  fecha_fin: string
  total_dias: number
  total_alquiler: number
  deposito_garantia_monto: number
  moneda: string
  sucursal_recogida: Sucursal
  sucursal_devolucion: Sucursal
  conductor: ConductorVoucher
  notas_vuelo?: string
  creado_en: string
  vehiculo_imagen?: string | null
  cobertura?: CoberturaSeguro
  desglose?: {
    tarifa_diaria: number
    subtotal_vehiculo: number
    subtotal_cobertura: number
    subtotal_extras: number
    recargo_young_driver: number
  }
  edad_conductor?: number | null
  liquidacion?: {
    recogida_real: string | null
    devolucion_real: string | null
    horas_retraso: number
    cargo_retraso: number
    cargo_combustible: number
    cargo_danos: number
    total_penalidades: number
    total_final: number | null
  }
  cancelacion?: {
    cancelada_en: string | null
    motivo: string | null
    cancelado_por: 'CLIENTE' | 'ADMIN' | 'SISTEMA' | null
  }
  extras?: {
    extra_id: number
    nombre: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
  inspecciones?: {
    id: number
    tipo: 'ENTREGA' | 'DEVOLUCION'
    odometro: number
    combustible: string
    observaciones_danos?: string
    fotos: string[]
    creado_en: string
  }[]
}
