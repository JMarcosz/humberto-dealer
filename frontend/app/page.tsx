import { Suspense } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Hero } from '@/components/hero'
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
        {/* 1. Hero futurista */}
        <Hero />

        {/* 2. Marcas — continúa el fondo oscuro del hero */}
        <BrandNav />

        {/* 3. Gradiente de transición suave: oscuro → claro */}
        <div className="h-20 w-full" style={{
          background: 'linear-gradient(to bottom, #080c14 0%, hsl(var(--background)) 100%)'
        }} />

        {/* 4. Catálogo de vehículos */}
        <section id="catalogo-section" className="container mx-auto px-6 md:px-12 pb-12">
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
