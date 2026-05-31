// Cliente API para conectar con Flask backend
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
} from './types'

// Servidor usa URL absoluta directa al backend; cliente usa proxy Next.js (para cookies same-origin)
const API_BASE_URL = typeof window === 'undefined'
  ? (process.env.BACKEND_URL || 'http://localhost:5001/api')
  : (process.env.NEXT_PUBLIC_API_URL || '/api')

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
      const error = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new Error(error.error || `Error ${response.status}`)
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

  async getVehiculosAdmin(params: { page?: number; estado?: string; per_page?: number } = {}): Promise<PaginatedResponse<Vehiculo>> {
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
      const error = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new Error(error.error || `Error ${response.status}`)
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
      const error = await response.json().catch(() => ({ error: 'Error de red' }))
      throw new Error(error.error || `Error ${response.status}`)
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
}

// Instancia singleton del cliente
export const api = new ApiClient(API_BASE_URL)
