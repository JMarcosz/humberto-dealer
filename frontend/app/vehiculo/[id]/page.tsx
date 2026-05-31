import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ImageGallery } from '@/components/image-gallery'
import { ReviewSection } from '@/components/review-section'
import { VehicleActions } from '@/components/vehicle-actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getVehiculoById, getVehiculos } from '@/lib/data'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Gauge,
  Fuel,
  Settings2,
  Palette,
  Zap,
  Car,
  Users,
  DoorOpen,
  Navigation
} from 'lucide-react'

export const revalidate = 60

export const generateStaticParams = async () => {
  const vehiculos = await getVehiculos()
  if (vehiculos.length === 0) {
    console.warn(
      '\n⚠ generateStaticParams: No se encontraron vehículos. ' +
      'Asegúrate de que el backend Flask esté corriendo en ' +
      (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:5001/api') +
      ' antes de ejecutar el build.\n'
    )
  }
  return vehiculos.map((v) => ({ id: String(v.id) }))
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const vehicle = await getVehiculoById(id)

  if (!vehicle) {
    return { title: 'Vehículo no encontrado | Humberto Auto Import' }
  }

  return {
    title: `${vehicle.marca} ${vehicle.modelo} ${vehicle.año} | Humberto Auto Import`,
    description: vehicle.descripcion,
    openGraph: {
      title: `${vehicle.marca} ${vehicle.modelo} ${vehicle.año}`,
      description: vehicle.descripcion,
      images: vehicle.imagenes[0] ? [vehicle.imagenes[0]] : [],
    },
  }
}

export default async function VehiclePage({ params }: PageProps) {
  const { id } = await params
  const vehicle = await getVehiculoById(id)

  if (!vehicle) notFound()

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(price)

  const formatKilometraje = (km: number) =>
    new Intl.NumberFormat('es-DO').format(km)

  const whatsappMessage = encodeURIComponent(
    `Hola, estoy interesado en el ${vehicle.marca} ${vehicle.modelo} ${vehicle.año} que vi en su catálogo. ¿Podría darme más información y el precio final?`
  )
  const whatsappUrl = `https://wa.me/18495809586?text=${whatsappMessage}`
  const mapsUrl = 'https://www.google.com/maps/place/Prol.+Av.+27+de+Febrero+467,+Santo+Domingo/@18.463905,-69.9959589,1190m/data=!3m2!1e3!4b1!4m6!3m5!1s0x8ea561d0d74b872b:0xdfb43add602bb6ac!8m2!3d18.463905!4d-69.993384!16s%2Fg%2F11fsrgh5kl?entry=ttu'
  const wazeUrl = 'https://www.waze.com/es/live-map/directions/do/santo-domingo/santo-domingo/prol.-av.-27-de-febrero-467?to=place.ChIJK4dL19BhpY4RrLYrYN06tN8'

  const estadoStyles = {
    disponible: 'bg-green-500/10 text-green-600 border-green-500/20',
    reservado: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    vendido: 'bg-red-500/10 text-red-600 border-red-500/20',
    pendiente_validacion: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  }

  const estadoLabels = {
    disponible: 'Disponible',
    reservado: 'Reservado',
    vendido: 'VENDIDO',
    pendiente_validacion: 'Pendiente'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <article className="container mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>

          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ImageGallery images={vehicle.imagenes} alt={`${vehicle.marca} ${vehicle.modelo}`} />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h1 className="text-2xl font-bold md:text-3xl">
                    {vehicle.marca} {vehicle.modelo}
                  </h1>
                  <Badge
                    variant="outline"
                    className={`${estadoStyles[vehicle.estado]} font-semibold flex-shrink-0`}
                  >
                    {estadoLabels[vehicle.estado]}
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-primary md:text-4xl">
                  {formatPrice(vehicle.precio)}
                </p>
              </div>

              {vehicle.estado === 'vendido' && (
                <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-4 text-center">
                  <span className="text-xl font-bold text-red-600">ESTE VEHÍCULO YA FUE VENDIDO</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Año</p>
                    <p className="font-semibold">{vehicle.año}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Gauge className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Kilometraje</p>
                    <p className="font-semibold">{formatKilometraje(vehicle.kilometraje)} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Fuel className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Combustible</p>
                    <p className="font-semibold capitalize">{vehicle.combustible}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-muted-foreground">Transmisión</p>
                    <p className="font-semibold capitalize">{vehicle.transmision}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Botones de acción (client component con lógica real) */}
              <VehicleActions
                vehicleId={id}
                whatsappUrl={whatsappUrl}
                estado={vehicle.estado}
              />

              {/* Botones de navegación */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="gap-2" asChild>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4" />
                    Google Maps
                  </a>
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4" />
                    Waze
                  </a>
                </Button>
              </div>

              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{vehicle.ubicacion.direccion}</span>
              </div>
            </div>
          </div>

          {/* Full Specs */}
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Especificaciones Técnicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {vehicle.motor && (
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Motor</p>
                        <p className="font-medium">{vehicle.motor}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.potencia && (
                    <div className="flex items-center gap-3">
                      <Gauge className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Potencia</p>
                        <p className="font-medium">{vehicle.potencia}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.traccion && (
                    <div className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tracción</p>
                        <p className="font-medium">{vehicle.traccion}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Color</p>
                      <p className="font-medium">{vehicle.color}</p>
                    </div>
                  </div>
                  {vehicle.puertas && (
                    <div className="flex items-center gap-3">
                      <DoorOpen className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Puertas</p>
                        <p className="font-medium">{vehicle.puertas}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.asientos && (
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Asientos</p>
                        <p className="font-medium">{vehicle.asientos}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Características
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vehicle.caracteristicas.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {vehicle.caracteristicas.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Consulta al vendedor para detalles de equipamiento.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {vehicle.descripcion && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{vehicle.descripcion}</p>
              </CardContent>
            </Card>
          )}

          <ReviewSection vehiculoId={vehicle.id} />
        </article>
      </main>

      <Footer />
    </div>
  )
}
