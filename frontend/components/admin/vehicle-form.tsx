'use client'

import { useState } from 'react'
import { Vehicle } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from '@/components/admin/image-upload'

interface VehicleFormProps {
  vehicle: Vehicle | null
  onSave: (vehicle: Vehicle) => void
  onCancel: () => void
}

const emptyVehicle: Vehicle = {
  id: '',
  marca: '',
  modelo: '',
  año: new Date().getFullYear(),
  precio: 0,
  tipo: 'sedan',
  kilometraje: 0,
  combustible: 'gasolina',
  transmision: 'automatico',
  color: '',
  motor: '',
  potencia: '',
  traccion: '',
  puertas: 4,
  asientos: 5,
  descripcion: '',
  caracteristicas: [],
  imagenes: [],
  estado: 'pendiente_validacion',
  destacado: false,
  fechaPublicacion: new Date().toISOString().split('T')[0],
  ubicacion: {
    direccion: 'Av. Principal 123, Ciudad',
    lat: 18.4655,
    lng: -69.9428
  }
}

export function VehicleForm({ vehicle, onSave, onCancel }: VehicleFormProps) {
  const [form, setForm] = useState<Vehicle>(vehicle || emptyVehicle)
  const [caracteristicasText, setCaracteristicasText] = useState(
    vehicle?.caracteristicas.join(', ') || ''
  )

  const handleChange = (field: keyof Vehicle, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Parse caracteristicas
    const caracteristicas = caracteristicasText
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    onSave({ ...form, caracteristicas })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Images */}
      <div className="space-y-2">
        <Label>Imágenes del vehículo</Label>
        <ImageUpload
          images={form.imagenes}
          onImagesChange={(images) => setForm(prev => ({ ...prev, imagenes: images }))}
        />
      </div>

      {/* Basic Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="marca">Marca *</Label>
          <Input
            id="marca"
            value={form.marca}
            onChange={(e) => handleChange('marca', e.target.value)}
            placeholder="Ej: Mercedes-Benz"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo *</Label>
          <Input
            id="modelo"
            value={form.modelo}
            onChange={(e) => handleChange('modelo', e.target.value)}
            placeholder="Ej: AMG GT"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="año">Año *</Label>
          <Input
            id="año"
            type="number"
            value={form.año}
            onChange={(e) => handleChange('año', parseInt(e.target.value))}
            min={1990}
            max={new Date().getFullYear() + 1}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="precio">Precio (USD) *</Label>
          <Input
            id="precio"
            type="number"
            value={form.precio}
            onChange={(e) => handleChange('precio', parseInt(e.target.value))}
            min={0}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kilometraje">Kilometraje *</Label>
          <Input
            id="kilometraje"
            type="number"
            value={form.kilometraje}
            onChange={(e) => handleChange('kilometraje', parseInt(e.target.value))}
            min={0}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={form.tipo} onValueChange={(value) => handleChange('tipo', value)}>
            <SelectTrigger id="tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedan">Sedán</SelectItem>
              <SelectItem value="suv">SUV</SelectItem>
              <SelectItem value="coupe">Coupé</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="deportivo">Deportivo</SelectItem>
              <SelectItem value="hatchback">Hatchback</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color *</Label>
          <Input
            id="color"
            value={form.color}
            onChange={(e) => handleChange('color', e.target.value)}
            placeholder="Ej: Negro Obsidiana"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="combustible">Combustible *</Label>
          <Select value={form.combustible} onValueChange={(value) => handleChange('combustible', value)}>
            <SelectTrigger id="combustible">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gasolina">Gasolina</SelectItem>
              <SelectItem value="diesel">Diésel</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="electrico">Eléctrico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transmision">Transmisión *</Label>
          <Select value={form.transmision} onValueChange={(value) => handleChange('transmision', value)}>
            <SelectTrigger id="transmision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automatico">Automático</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Technical Specs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="motor">Motor</Label>
          <Input
            id="motor"
            value={form.motor}
            onChange={(e) => handleChange('motor', e.target.value)}
            placeholder="Ej: 4.0L V8 Biturbo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="potencia">Potencia</Label>
          <Input
            id="potencia"
            value={form.potencia}
            onChange={(e) => handleChange('potencia', e.target.value)}
            placeholder="Ej: 577 HP"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="traccion">Tracción</Label>
          <Input
            id="traccion"
            value={form.traccion}
            onChange={(e) => handleChange('traccion', e.target.value)}
            placeholder="Ej: Trasera, AWD"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="puertas">Puertas</Label>
          <Input
            id="puertas"
            type="number"
            value={form.puertas}
            onChange={(e) => handleChange('puertas', parseInt(e.target.value))}
            min={2}
            max={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asientos">Asientos</Label>
          <Input
            id="asientos"
            type="number"
            value={form.asientos}
            onChange={(e) => handleChange('asientos', parseInt(e.target.value))}
            min={2}
            max={9}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          value={form.descripcion}
          onChange={(e) => handleChange('descripcion', e.target.value)}
          placeholder="Descripción detallada del vehículo..."
          rows={4}
        />
      </div>

      {/* Features */}
      <div className="space-y-2">
        <Label htmlFor="caracteristicas">Características (separadas por coma)</Label>
        <Textarea
          id="caracteristicas"
          value={caracteristicasText}
          onChange={(e) => setCaracteristicasText(e.target.value)}
          placeholder="Ej: Techo panorámico, Sistema de sonido premium, Asientos de cuero..."
          rows={3}
        />
      </div>

      {/* Status & Visibility */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select value={form.estado} onValueChange={(value) => handleChange('estado', value)}>
            <SelectTrigger id="estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente_validacion">Pendiente de validación</SelectItem>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Destacado</Label>
          <Select 
            value={form.destacado ? 'true' : 'false'} 
            onValueChange={(value) => handleChange('destacado', value === 'true')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No destacado</SelectItem>
              <SelectItem value="true">Destacado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {vehicle ? 'Guardar cambios' : 'Crear vehículo'}
        </Button>
      </div>
    </form>
  )
}
