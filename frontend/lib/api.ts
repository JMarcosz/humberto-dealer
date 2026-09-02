import type {
  VehiculoAPI as Vehiculo,
  Marca,
  Modelo,
  Usuario,
  Reserva,
  Venta,
  Resena,
  PaginatedResponse,
  VehiculoFilters,
  Sucursal,
  CoberturaSeguro,
  ExtraServicio,
  DisponibilidadRentaResponse,
  ReservaRenta,
  ReservaRentaPayload,
  PoliticaRenta,
  CotizacionRenta,
  FactorVoucher,
} from './types'

// Servidor usa URL absoluta directa al backend; cliente usa proxy Next.js (para cookies same-origin)
const API_BASE_URL = typeof window === 'undefined'
  ? (process.env.BACKEND_URL || 'https://humberto-dealer.onrender.com/api')
  : (process.env.NEXT_PUBLIC_API_URL || '/api')

/**
 * Error de API con el status y el codigo de negocio del backend.
 *
 * Antes se lanzaba `new Error("422: mensaje")` y esa cadena se pintaba cruda al
 * usuario. Sin `status` ni `codigo` accesibles la UI no podia distinguir un 409
 * (revalidar y volver a buscar) de un 429 (esperar) de un 422 (corregir el
 * formulario).
 */
export class ApiError extends Error {
  status: number
  codigo?: string
  detalles?: Record<string, unknown>

  constructor(mensaje: string, status: number, codigo?: string,
              detalles?: Record<string, unknown>) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.detalles = detalles
  }
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const cuerpo = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new ApiError(
        cuerpo.error || 'Error de red',
        response.status,
        cuerpo.codigo,
        cuerpo.detalles,
      )
    }

    return response.json()
  }

  // ==================== CATALOGO PUBLICO ====================

  async getMarcas(): Promise<Marca[]> {
    return this.request<Marca[]>('/catalogo/marcas')
  }

  async getModelosPorMarca(marcaId: number): Promise<Modelo[]> {
    return this.request<Modelo[]>(`/catalogo/marcas/${marcaId}/modelos`)
  }

  async getVehiculos(filters: VehiculoFilters = {}): Promise<PaginatedResponse<Vehiculo>> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const query = params.toString()
    return this.request<PaginatedResponse<Vehiculo>>(
      `/catalogo/vehiculos${query ? `?${query}` : ''}`
    )
  }

  async getVehiculo(id: number): Promise<Vehiculo> {
    return this.request<Vehiculo>(`/catalogo/vehiculos/${id}`)
  }

  // ==================== AUTENTICACION ====================

  async registro(data: { nombre: string; email: string; password: string }): Promise<{ mensaje: string; id: number }> {
    return this.request('/auth/registro', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async login(data: { email: string; password: string; remember?: boolean }): Promise<{ mensaje: string; usuario: Usuario }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async logout(): Promise<{ mensaje: string }> {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  async getCurrentUser(): Promise<Usuario> {
    return this.request<Usuario>('/auth/me')
  }

  getGoogleLoginUrl(): string {
    return `${this.baseUrl}/auth/google`
  }

  // ==================== RESERVAS ====================

  async crearReserva(vehiculoId: number, notas?: string): Promise<{ mensaje: string; reserva: Reserva }> {
    return this.request('/reservas/', {
      method: 'POST',
      body: JSON.stringify({ vehiculo_id: vehiculoId, notas }),
    })
  }

  async cancelarReserva(reservaId: number): Promise<{ mensaje: string }> {
    return this.request(`/reservas/${reservaId}`, {
      method: 'DELETE',
    })
  }

  async getMisReservas(): Promise<Reserva[]> {
    return this.request<Reserva[]>('/reservas/mis-reservas')
  }

  // ==================== ADMIN: VEHICULOS ====================

  async getVehiculoAdmin(id: number): Promise<Vehiculo> {
    return this.request<Vehiculo>(`/admin/vehiculos/${id}`)
  }

  async getVehiculosAdmin(params: { page?: number; estado?: string; per_page?: number; buscar?: string } = {}): Promise<PaginatedResponse<Vehiculo>> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.append(key, String(value))
    })
    return this.request<PaginatedResponse<Vehiculo>>(
      `/admin/vehiculos${query.toString() ? `?${query}` : ''}`
    )
  }

  async cambiarEstadoVehiculo(vehiculoId: number, estado: string): Promise<{ mensaje: string; estado: string }> {
    return this.request(`/admin/vehiculos/${vehiculoId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    })
  }

  async crearVehiculo(data: Partial<Vehiculo>): Promise<{ mensaje: string; vehiculo: Vehiculo }> {
    return this.request('/borradores/crear', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async actualizarVehiculo(vehiculoId: number, data: Partial<Vehiculo>): Promise<{ mensaje: string; vehiculo: Vehiculo }> {
    return this.request(`/borradores/${vehiculoId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async eliminarBorrador(vehiculoId: number): Promise<{ mensaje: string }> {
    return this.request(`/borradores/${vehiculoId}`, {
      method: 'DELETE',
    })
  }

  async publicarBorrador(vehiculoId: number): Promise<{ mensaje: string; vehiculo: Vehiculo }> {
    return this.request(`/borradores/${vehiculoId}/aprobar`, {
      method: 'PATCH',
    })
  }

  async publicarBorradorLote(ids: number[]): Promise<{ mensaje: string; total: number }> {
    return this.request('/borradores/aprobar-lote', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    })
  }

  async eliminarBorradorLote(ids: number[]): Promise<{ mensaje: string; total: number }> {
    return this.request('/borradores/eliminar-lote', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    })
  }

  async getVehiculoIdsAdmin(params: { estado?: string; buscar?: string } = {}): Promise<{ ids: number[]; total: number }> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, String(value))
    })
    return this.request(`/admin/vehiculos/ids${query.toString() ? `?${query}` : ''}`)
  }

  // ==================== ADMIN: VENTAS ====================

  async confirmarVenta(data: {
    vehiculo_id: number
    cliente_id: number
    precio_final: number
    metodo_pago: string
    reserva_id?: number
    ubicacion_lat?: number
    ubicacion_lng?: number
    ubicacion_desc?: string
  }): Promise<{ mensaje: string; venta: Venta }> {
    return this.request('/admin/ventas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getHistorialVentas(params: { page?: number; per_page?: number } = {}): Promise<PaginatedResponse<Venta>> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.append(key, String(value))
    })
    return this.request<PaginatedResponse<Venta>>(
      `/admin/historico${query.toString() ? `?${query}` : ''}`
    )
  }

  // ==================== ADMIN: RESERVAS ====================

  async getTodasReservas(params: { estado?: string; page?: number } = {}): Promise<PaginatedResponse<Reserva>> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.append(key, String(value))
    })
    return this.request<PaginatedResponse<Reserva>>(
      `/admin/reservas${query.toString() ? `?${query}` : ''}`
    )
  }

  // ==================== EXCEL ====================

  async importarExcel(file: File): Promise<{ mensaje: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/borradores/importar`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      const cuerpo = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new ApiError(
        cuerpo.error || 'Error de red',
        response.status,
        cuerpo.codigo,
        cuerpo.detalles,
      )
    }

    return response.json()
  }

  async getProgresoImportacion(): Promise<{
    total: number
    procesado: number
    errores: string[]
    terminado: boolean
  }> {
    return this.request('/borradores/progreso')
  }

  async exportarExcel(params: { estado?: string; marca_id?: number } = {}): Promise<Blob> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.append(key, String(value))
    })

    const response = await fetch(
      `${this.baseUrl}/borradores/exportar${query.toString() ? `?${query}` : ''}`,
      { credentials: 'include' }
    )

    if (!response.ok) {
      throw new Error('Error al exportar')
    }

    return response.blob()
  }

  getPlantillaExcelUrl(): string {
    return `${this.baseUrl}/borradores/plantilla`
  }

  // ==================== ADMIN: IMÁGENES ====================

  async agregarImagenUrl(vehiculoId: number, url: string): Promise<{ mensaje: string; imagen: { id: number; url: string; es_principal: boolean; orden: number } }> {
    return this.request(`/admin/vehiculos/${vehiculoId}/imagenes`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  }

  async agregarImagenArchivo(vehiculoId: number, file: File): Promise<{ mensaje: string; imagen: { id: number; url: string; es_principal: boolean; orden: number } }> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${this.baseUrl}/admin/vehiculos/${vehiculoId}/imagenes`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    if (!response.ok) {
      const cuerpo = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new ApiError(
        cuerpo.error || 'Error de red',
        response.status,
        cuerpo.codigo,
        cuerpo.detalles,
      )
    }
    return response.json()
  }

  async eliminarImagen(imagenId: number): Promise<{ mensaje: string }> {
    return this.request(`/admin/imagenes/${imagenId}`, { method: 'DELETE' })
  }

  async setImagenPrincipal(imagenId: number): Promise<{ mensaje: string }> {
    return this.request(`/admin/imagenes/${imagenId}/principal`, { method: 'PATCH' })
  }

  // ==================== WHATSAPP ====================

  getWhatsAppUrl(vehiculoId: number): string {
    return `${this.baseUrl}/whatsapp/${vehiculoId}`
  }

  // ==================== RESENAS ====================

  async getResenasVehiculo(vehiculoId: number): Promise<Resena[]> {
    return this.request<Resena[]>(`/catalogo/vehiculos/${vehiculoId}/resenas`)
  }

  async crearResena(vehiculoId: number, data: { calificacion: number; comentario?: string }): Promise<{ mensaje: string; resena: Resena }> {
    return this.request(`/catalogo/vehiculos/${vehiculoId}/resenas`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async likeResena(vehiculoId: number, resenaId: number): Promise<{ liked: boolean; likes_count: number }> {
    return this.request(`/catalogo/vehiculos/${vehiculoId}/resenas/${resenaId}/like`, { method: 'POST' })
  }

  async eliminarResena(resenaId: number): Promise<void> {
    return this.request(`/catalogo/resenas/${resenaId}`, { method: 'DELETE' })
  }

  // ==================== RENTA DE AUTOS ====================

  /**
   * Constantes de politica publicadas por el backend.
   *
   * La UI las usa para constrenir sus inputs (min/max de los selectores de
   * fecha) en lugar de codificar umbrales propios: las reglas viven en el
   * servidor y aqui solo se consumen.
   */
  async getPolitica(): Promise<PoliticaRenta> {
    return this.request<PoliticaRenta>('/renta/politica')
  }

  /**
   * Desglose completo sin persistir nada.
   *
   * Por dentro llama exactamente al mismo calculo que el checkout, de modo que
   * la cifra mostrada y la cobrada no pueden divergir.
   */
  async cotizarRenta(payload: ReservaRentaPayload): Promise<CotizacionRenta> {
    return this.request<CotizacionRenta>('/renta/cotizar', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getSucursales(): Promise<Sucursal[]> {
    return this.request<Sucursal[]>('/renta/sucursales')
  }

  async getCoberturas(): Promise<CoberturaSeguro[]> {
    return this.request<CoberturaSeguro[]>('/renta/coberturas')
  }

  async getExtras(): Promise<ExtraServicio[]> {
    return this.request<ExtraServicio[]>('/renta/extras')
  }

  async getDisponibilidadRenta(params: {
    fecha_inicio: string
    fecha_fin: string
    sucursal_recogida_id?: number
    sucursal_devolucion_id?: number
    categoria?: string
    transmision?: string
    pasajeros?: number
    maletas?: number
    precio_min?: number
    precio_max?: number
    orden?: string
  }): Promise<DisponibilidadRentaResponse> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value))
      }
    })
    return this.request<DisponibilidadRentaResponse>(
      `/renta/disponibilidad?${query.toString()}`
    )
  }

  async crearReservaRenta(payload: ReservaRentaPayload): Promise<{
    mensaje: string
    pnr: string
    reserva: ReservaRenta
  }> {
    return this.request('/renta/reservas', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  /**
   * Voucher publico. Exige segundo factor: apellido del conductor o los
   * ultimos 4 digitos de su documento.
   */
  async getReservaPorPnr(pnr: string, factor: FactorVoucher): Promise<ReservaRenta> {
    const query = new URLSearchParams()
    if (factor.apellido) query.append('apellido', factor.apellido)
    if (factor.doc4) query.append('doc4', factor.doc4)
    return this.request<ReservaRenta>(
      `/renta/reservas/${encodeURIComponent(pnr.trim().toUpperCase())}?${query.toString()}`
    )
  }

  async cancelarReservaRenta(pnr: string, factor: FactorVoucher & { motivo?: string }): Promise<{
    mensaje: string
    reserva: ReservaRenta
  }> {
    return this.request(
      `/renta/reservas/${encodeURIComponent(pnr.trim().toUpperCase())}/cancelar`,
      { method: 'POST', body: JSON.stringify(factor) }
    )
  }

  // ==================== ADMIN: RENTA ====================

  async getAdminReservasRenta(params: {
    page?: number
    per_page?: number
    estado?: string
    buscar?: string
  } = {}): Promise<PaginatedResponse<ReservaRenta>> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value))
      }
    })
    return this.request<PaginatedResponse<ReservaRenta>>(
      `/admin/renta/reservas?${query.toString()}`
    )
  }

  /** Cancela o marca no-show desde mostrador. El estado CANCELADA no tenía
   *  ningún productor: toda reserva bloqueaba el calendario para siempre. */
  async cancelarReservaRentaAdmin(data: {
    pnr?: string
    reserva_id?: number
    motivo: string
    estado?: 'CANCELADA' | 'NO_SHOW'
  }): Promise<{ mensaje: string; reserva: ReservaRenta }> {
    return this.request('/admin/renta/cancelar', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async checkInRenta(data: {
    reserva_id?: number
    pnr?: string
    odometro: number
    combustible?: string
    observaciones_danos?: string
    fotos_urls?: string
  }): Promise<{ mensaje: string; reserva: ReservaRenta }> {
    return this.request('/admin/renta/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async checkOutRenta(data: {
    reserva_id?: number
    pnr?: string
    odometro: number
    combustible?: string
    observaciones_danos?: string
    fotos_urls?: string
    /** Cargo manual por daños; el retraso y el combustible los calcula el backend. */
    cargo_danos?: number
  }): Promise<{
    mensaje: string
    reserva: ReservaRenta
    liquidacion: {
      horas_retraso: number
      cargo_retraso: number
      octavos_faltantes: number
      cargo_combustible: number
      cargo_danos: number
      total_penalidades: number
      total_final: number
      deposito_a_retener: number
      deposito_a_liberar: number
    }
  }> {
    return this.request('/admin/renta/check-out', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async guardarTarifaRenta(data: {
    vehiculo_id: number
    precio_dia_base: number
    deposito_garantia?: number
    moneda?: string
    kilometraje_incluido?: string
    disponible_para?: string
    pasajeros?: number
    maletas_grandes?: number
    maletas_pequenas?: number
  }): Promise<{ mensaje: string; tarifa: unknown }> {
    return this.request('/admin/renta/tarifas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

// Instancia singleton del cliente
export const api = new ApiClient(API_BASE_URL)
