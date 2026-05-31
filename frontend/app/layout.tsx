import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { TransitionOverlay } from '@/components/transition-overlay'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono"
})

export const metadata: Metadata = {
  title: 'HUMBERTO AUTO IMPORT | Vehículos de Alta Gama',
  description: 'Concesionaria de autos de alta gama. Encuentra tu vehículo premium ideal con las mejores condiciones del mercado.',
  keywords: ['autos', 'vehículos', 'alta gama', 'concesionaria', 'importación', 'premium'],
  authors: [{ name: 'Humberto Auto Import' }],
  openGraph: {
    title: 'HUMBERTO AUTO IMPORT | Vehículos de Alta Gama',
    description: 'Concesionaria de autos de alta gama. Encuentra tu vehículo premium ideal.',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HUMBERTO AUTO IMPORT',
    description: 'Concesionaria de autos de alta gama',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TransitionOverlay />
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
