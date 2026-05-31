import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { WhyUs } from '@/components/why-us'
import { ScrollToTop } from '@/components/scroll-to-top'

export const metadata = {
  title: 'Quiénes Somos | Humberto Auto Import',
  description: 'Conoce más sobre Humberto Auto Import SRL, tu concesionaria de confianza en República Dominicana con más de 15 años de experiencia.',
}

export default function NosotrosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <WhyUs />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
