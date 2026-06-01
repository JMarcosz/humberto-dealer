'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Menu, X, User, LogOut, Sun, Moon, BookMarked } from 'lucide-react'
import { api } from '@/lib/api'
import type { Usuario } from '@/lib/types'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<Usuario | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  // Check si hay sesión activa al cargar
  useEffect(() => {
    api.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  const handleLogout = async () => {
    try { await api.logout() } catch {}
    setUser(null)
    router.refresh()
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      router.push('/')
    }
  }

  // Scroll suave a secciones de la página de inicio
  const handleSectionNav = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    if (pathname === '/') {
      // Ya estamos en la página principal: solo scroll
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      // Ir al inicio y luego scroll al elemento
      router.push(`/#${sectionId}`)
      setTimeout(() => {
        const el = document.getElementById(sectionId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/20 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <nav className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo — click reinicia/sube al inicio */}
        <a href="/" onClick={handleLogoClick} className="flex items-center gap-2 cursor-pointer">
          <Image src="/logo.png" alt="Humberto Auto Import" width={48} height={48} className="h-10 w-10 object-contain" />
          <span className="hidden font-bold text-lg tracking-tight sm:inline-block">HUMBERTO AUTO IMPORT</span>
        </a>

        {/* Nav desktop */}
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="/#catalogo-section"
            onClick={(e) => handleSectionNav(e, 'catalogo-section')}
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary cursor-pointer"
          >
            Catálogo
          </a>
          <a
            href="/#marcas"
            onClick={(e) => handleSectionNav(e, 'marcas')}
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary cursor-pointer"
          >
            Marcas
          </a>
          <a
            href="/#contacto"
            onClick={(e) => handleSectionNav(e, 'contacto')}
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary cursor-pointer"
          >
            Contacto
          </a>
          <a
            href="/nosotros"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary cursor-pointer"
          >
            Nosotros
          </a>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hola, <span className="font-semibold text-foreground">{user.nombre}</span></span>
              <Link href="/mis-reservas">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BookMarked className="h-4 w-4" /><span>Mis reservas</span>
                </Button>
              </Link>
              {user.rol?.nombre === 'ADMIN' && (
                <Link href="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
              )}
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /><span>Salir</span>
              </Button>
            </div>
          ) : (
            <Link href="/login" className="hidden md:block">
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" /><span>Iniciar Sesión</span>
              </Button>
            </Link>
          )}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {/* Menú móvil */}
      {mobileMenuOpen && (
        <div className="border-t border-border md:hidden">
          <div className="container mx-auto space-y-1 px-4 py-3">
            <a
              href="/#catalogo-section"
              onClick={(e) => handleSectionNav(e, 'catalogo-section')}
              className="block rounded-md px-3 py-3 text-base font-medium hover:bg-muted cursor-pointer min-h-[44px] flex items-center"
            >
              Catálogo
            </a>
            <a
              href="/#marcas"
              onClick={(e) => handleSectionNav(e, 'marcas')}
              className="block rounded-md px-3 py-3 text-base font-medium hover:bg-muted cursor-pointer min-h-[44px] flex items-center"
            >
              Marcas
            </a>
            <a
              href="/#contacto"
              onClick={(e) => handleSectionNav(e, 'contacto')}
              className="block rounded-md px-3 py-3 text-base font-medium hover:bg-muted cursor-pointer min-h-[44px] flex items-center"
            >
              Contacto
            </a>
            <a
              href="/nosotros"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-md px-3 py-3 text-base font-medium hover:bg-muted cursor-pointer min-h-[44px] flex items-center"
            >
              Nosotros
            </a>
            <div className="border-t border-border pt-2">
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-muted-foreground">Hola, {user.nombre}</div>
                  <Link href="/mis-reservas" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2 min-h-[44px]">
                      <BookMarked className="h-4 w-4" /><span>Mis reservas</span>
                    </Button>
                  </Link>
                  {user.rol?.nombre === 'ADMIN' && (
                    <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start min-h-[44px]">Admin</Button>
                    </Link>
                  )}
                  <Button variant="ghost" className="w-full justify-start gap-2 min-h-[44px]" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /><span>Salir</span>
                  </Button>
                </>
              ) : (
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2 min-h-[44px]">
                    <User className="h-4 w-4" /><span>Iniciar Sesión</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
