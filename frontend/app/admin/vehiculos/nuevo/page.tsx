'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Marca, Modelo } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Plus, Trash2, Star, Link, Upload, CheckCircle } from 'lucide-react'

type Imagen = { id: number; url: string; es_principal: boolean; orden: number }

// ── Paso 1: datos del vehículo ──────────────────────────────────────────────
function FormDatos({ onCreado }: { onCreado: (id: number) => void }) {
  const [marcas, setMarcas]     = useState<Marca[]>([])
  const [modelos, setModelos]   = useState<Modelo[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm]         = useState({
    marca_id: '', modelo_id: '', anio: '', vin: '',
    color: '', precio: '', kilometraje: '', combustible: '',
    transmision: '', descripcion: '',
  })

  useEffect(() => {
    api.getMarcas().then(setMarcas).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.marca_id) {
      api.getModelosPorMarca(Number(form.marca_id)).then(setModelos).catch(() => setModelos([]))
      setForm(f => ({ ...f, modelo_id: '' }))
    }
  }, [form.marca_id])

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.crearVehiculo({
        modelo_id:   Number(form.modelo_id),
        anio:        Number(form.anio),
        vin:         form.vin,
        color:       form.color.toUpperCase(),
        precio:      Number(form.precio),
        kilometraje: Number(form.kilometraje || 0),
        combustible: form.combustible,
        transmision: form.transmision,
        descripcion: form.descripcion || undefined,
      } as any)
      onCreado((res as any).vehiculo.id)
    } catch (err: any) {
      setError(err.message || 'Error al crear el vehículo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Marca */}
        <div className="space-y-2">
          <Label>Marca *</Label>
          <Select value={form.marca_id} onValueChange={set('marca_id')} required>
            <SelectTrigger><SelectValue placeholder="Seleccionar marca" /></SelectTrigger>
            <SelectContent>
              {marcas.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Modelo */}
        <div className="space-y-2">
          <Label>Modelo *</Label>
          <Select value={form.modelo_id} onValueChange={set('modelo_id')} disabled={!form.marca_id} required>
            <SelectTrigger><SelectValue placeholder="Seleccionar modelo" /></SelectTrigger>
            <SelectContent>
              {modelos.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Año */}
        <div className="space-y-2">
          <Label>Año *</Label>
          <Input type="number" min={1990} max={2026} value={form.anio}
            onChange={e => set('anio')(e.target.value)} required placeholder="2023" />
        </div>

        {/* VIN */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>VIN *</Label>
            <span className={`text-xs ${form.vin.length === 17 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {form.vin.length}/17
            </span>
          </div>
          <Input value={form.vin} onChange={e => set('vin')(e.target.value.toUpperCase().slice(0, 17))}
            required maxLength={17} placeholder="17 caracteres" className="font-mono" />
          {form.vin.length > 0 && form.vin.length !== 17 && (
            <p className="text-xs text-destructive">El VIN debe tener exactamente 17 caracteres</p>
          )}
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Color *</Label>
          <Input value={form.color} onChange={e => set('color')(e.target.value)}
            required placeholder="BLANCO" />
        </div>

        {/* Precio */}
        <div className="space-y-2">
          <Label>Precio (USD) *</Label>
          <Input type="number" min={0} step={100} value={form.precio}
            onChange={e => set('precio')(e.target.value)} required placeholder="25000" />
        </div>

        {/* Kilometraje */}
        <div className="space-y-2">
          <Label>Kilometraje</Label>
          <Input type="number" min={0} value={form.kilometraje}
            onChange={e => set('kilometraje')(e.target.value)} placeholder="0" />
        </div>

        {/* Combustible */}
        <div className="space-y-2">
          <Label>Combustible *</Label>
          <Select value={form.combustible} onValueChange={set('combustible')} required>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {['GASOLINA','DIESEL','HIBRIDO','ELECTRICO','GAS'].map(v =>
                <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Transmisión */}
        <div className="space-y-2">
          <Label>Transmisión *</Label>
          <Select value={form.transmision} onValueChange={set('transmision')} required>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {['AUTOMATICA','MANUAL','CVT'].map(v =>
                <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Descripción */}
      <div className="space-y-2">
        <Label>Descripción</Label>
        <Textarea value={form.descripcion} onChange={e => set('descripcion')(e.target.value)}
          rows={3} placeholder="Descripción opcional del vehículo..." />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : 'Crear Vehículo y Agregar Imágenes →'}
      </Button>
    </form>
  )
}

// ── Paso 2: imágenes ────────────────────────────────────────────────────────
function FormImagenes({ vehiculoId, onListo }: { vehiculoId: number; onListo: () => void }) {
  const [imagenes, setImagenes]   = useState<Imagen[]>([])
  const [urlInput, setUrlInput]   = useState('')
  const [loadingUrl, setLoadingUrl]   = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try {
      const v = await api.getVehiculo(vehiculoId)
      setImagenes((v as any).imagenes ?? [])
    } catch {}
  }

  useEffect(() => { reload() }, [vehiculoId])

  const agregarUrl = async () => {
    if (!urlInput.trim()) return
    setError(null)
    setLoadingUrl(true)
    try {
      await api.agregarImagenUrl(vehiculoId, urlInput.trim())
      setUrlInput('')
      await reload()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingUrl(false)
    }
  }

  const agregarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoadingFile(true)
    try {
      await api.agregarImagenArchivo(vehiculoId, file)
      await reload()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingFile(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const eliminar = async (id: number) => {
    await api.eliminarImagen(id)
    await reload()
  }

  const setPrincipal = async (id: number) => {
    await api.setImagenPrincipal(id)
    await reload()
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Agregar por URL */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Link className="h-4 w-4" /> Agregar por URL</Label>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://ejemplo.com/foto.jpg"
            onKeyDown={e => e.key === 'Enter' && agregarUrl()}
          />
          <Button type="button" onClick={agregarUrl} disabled={loadingUrl || !urlInput.trim()} className="shrink-0">
            {loadingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Agregar archivo */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Subir desde tu PC</Label>
        <div className="relative">
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif"
            onChange={agregarArchivo} disabled={loadingFile}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
          <Button type="button" variant="outline" disabled={loadingFile} className="w-full gap-2 pointer-events-none">
            {loadingFile
              ? <><Loader2 className="h-4 w-4 animate-spin" />Subiendo...</>
              : <><Upload className="h-4 w-4" />Seleccionar imagen (jpg, png, webp)</>}
          </Button>
        </div>
      </div>

      {/* Vista previa */}
      {imagenes.length > 0 && (
        <div className="space-y-3">
          <Label>Imágenes agregadas ({imagenes.length})</Label>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {imagenes.map(img => (
              <div key={img.id} className="relative group rounded-lg border overflow-hidden bg-muted">
                <img src={img.url} alt="Imagen vehículo"
                  className="w-full h-36 object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '/placeholder.jpg' }} />
                {img.es_principal && (
                  <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-xs">Principal</Badge>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!img.es_principal && (
                    <button onClick={() => setPrincipal(img.id)}
                      className="rounded bg-black/70 p-1 text-yellow-400 hover:bg-black" title="Hacer principal">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => eliminar(img.id)}
                    className="rounded bg-black/70 p-1 text-red-400 hover:bg-black" title="Eliminar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="button" onClick={onListo} className="w-full gap-2" variant={imagenes.length > 0 ? 'default' : 'outline'}>
        <CheckCircle className="h-4 w-4" />
        {imagenes.length > 0 ? 'Guardar y volver al inventario' : 'Omitir imágenes y guardar'}
      </Button>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function NuevoVehiculoPage() {
  const router = useRouter()
  const [paso, setPaso]             = useState<1 | 2>(1)
  const [vehiculoId, setVehiculoId] = useState<number | null>(null)

  const handleCreado = (id: number) => {
    setVehiculoId(id)
    setPaso(2)
  }

  const handleListo = () => {
    router.push('/admin/vehiculos')
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/vehiculos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo Vehículo</h1>
          <p className="text-muted-foreground text-sm">
            Paso {paso} de 2 — {paso === 1 ? 'Datos del vehículo' : 'Imágenes'}
          </p>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="flex gap-2">
        {[1, 2].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${paso >= n ? 'bg-orange-500' : 'bg-muted'}`} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{paso === 1 ? 'Datos del Vehículo' : 'Agregar Imágenes'}</CardTitle>
        </CardHeader>
        <CardContent>
          {paso === 1
            ? <FormDatos onCreado={handleCreado} />
            : <FormImagenes vehiculoId={vehiculoId!} onListo={handleListo} />}
        </CardContent>
      </Card>
    </div>
  )
}
