import { Suspense } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Hero } from '@/components/hero'
import { RentalSearchWidget } from '@/components/rental-search-widget'
import { VehicleCatalog } from '@/components/vehicle-catalog'
import { BrandNav } from '@/components/brand-nav'
import { SocialSection } from '@/components/social-section'
import { ScrollToTop } from '@/components/scroll-to-top'
import { Loader2 } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* 1 y 2. Bloque Hero + Buscador de Renta con fondo oscuro unificado */}
        <div className="relative bg-black">
          <Hero />

          {/* Sección Renta de Autos (Buscador estilo Kayak / Rentcars) */}
          <section id="renta-section" className="relative -mt-6 md:-mt-10 z-20 container mx-auto px-4 pb-12 scroll-mt-20">
            <RentalSearchWidget />
          </section>

          {/* Transición suave hacia el contenido del sitio */}
          <div
            className="h-16 w-full pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, #000000 0%, hsl(var(--background)) 100%)'
            }}
          />
        </div>

        {/* 3. Marcas */}
        <BrandNav />

        {/* 4. Catálogo de vehículos */}
        <section id="catalogo-section" className="container mx-auto px-6 md:px-12 pb-12 scroll-mt-20">
          <div className="mb-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-orange-500">Inventario</p>
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Catálogo de Vehículos</h2>
            <p className="mt-1 text-muted-foreground text-sm">Encuentra tu vehículo ideal con nuestros filtros avanzados</p>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          }>
            <VehicleCatalog />
          </Suspense>
        </section>

        {/* 5. Redes sociales */}
        <SocialSection />

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
