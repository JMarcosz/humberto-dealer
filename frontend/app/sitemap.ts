import { MetadataRoute } from 'next'
import { getVehiculos } from '@/lib/data'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://humbertoautoimport.com'

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ]

  let vehiclePages: MetadataRoute.Sitemap = []
  try {
    const vehiculos = await getVehiculos()
    vehiclePages = vehiculos
      .filter(v => v.estado !== 'pendiente_validacion')
      .map(vehicle => ({
        url: `${baseUrl}/vehiculo/${vehicle.id}`,
        lastModified: new Date(vehicle.fechaPublicacion),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
  } catch {
    // Backend unreachable — sitemap only has static pages
  }

  return [...staticPages, ...vehiclePages]
}
