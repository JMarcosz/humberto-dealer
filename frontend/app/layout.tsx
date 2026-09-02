import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { TransitionOverlay } from '@/components/transition-overlay'
import { Providers } from '@/app/providers'
import { SeoStructuredData } from '@/components/seo-structured-data'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono"
})

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://humbertoautoimport.com'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#080c14' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'HUMBERTO AUTO IMPORT | Vehículos de Alta Gama en República Dominicana',
    template: '%s | Humberto Auto Import',
  },
  description:
    'Concesionaria líder en importación directa de vehículos de alta gama y renta de autos en República Dominicana. Garantía total, financiamiento y el mejor precio del mercado. ¡El que te monta fácil!',
  keywords: [
    'autos de lujo rd',
    'humberto auto import',
    'vehiculos importados republica dominicana',
    'dealer de vehiculos santo domingo',
    'renta de autos rd',
    'carros en venta rd',
    'financiamiento de vehiculos',
    'el que te monta facil',
    'concesionaria premium',
    'dealer humberto',
  ],
  authors: [{ name: 'Humberto Auto Import SRL', url: baseUrl }],
  creator: 'Humberto Auto Import SRL',
  publisher: 'Humberto Auto Import SRL',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'HUMBERTO AUTO IMPORT | Vehículos de Alta Gama en República Dominicana',
    description:
      'Concesionaria líder en importación directa de vehículos de alta gama y renta de autos en República Dominicana. Garantía total, financiamiento y el mejor precio. ¡El que te monta fácil!',
    url: baseUrl,
    siteName: 'Humberto Auto Import',
    locale: 'es_DO',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Humberto Auto Import - Concesionaria de Autos de Alta Gama en RD',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HUMBERTO AUTO IMPORT | Vehículos de Alta Gama en RD',
    description:
      'Concesionaria líder en importación directa y renta de autos de alta gama en República Dominicana. ¡El que te monta fácil!',
    images: ['/og-image.png'],
    creator: '@humbertoautoimport',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${geistMono.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen" suppressHydrationWarning>
        <SeoStructuredData />
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <TransitionOverlay />
            {children}
          </ThemeProvider>
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
