import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { WhyUs } from '@/components/why-us'
import { ScrollToTop } from '@/components/scroll-to-top'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://humbertoautoimport.com'

export const metadata: Metadata = {
  title: 'Quiénes Somos | Humberto Auto Import - Líderes en Importación de Vehículos en RD',
  description:
    'Conoce más sobre Humberto Auto Import SRL: más de 15 años brindando importación directa de autos premium, garantía total, financiamiento y renta en República Dominicana.',
  alternates: {
    canonical: '/nosotros',
  },
  openGraph: {
    title: 'Quiénes Somos | Humberto Auto Import SRL',
    description:
      'Más de 15 años de experiencia en importación y renta de vehículos de alta gama en República Dominicana.',
    url: `${baseUrl}/nosotros`,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Quiénes Somos - Humberto Auto Import',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quiénes Somos | Humberto Auto Import',
    description:
      'Líderes en importación y renta de autos de alta gama en República Dominicana.',
    images: ['/og-image.png'],
  },
}

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Quiénes Somos - Humberto Auto Import SRL',
  description:
    'Información sobre la historia, misión, valores y servicios de importación y renta de vehículos de Humberto Auto Import SRL.',
  url: `${baseUrl}/nosotros`,
  mainEntity: {
    '@type': 'AutoDealer',
    name: 'Humberto Auto Import SRL',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    foundingDate: '2010',
    areaServed: 'República Dominicana',
  },
}

export default function NosotrosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
        />
        <WhyUs />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
