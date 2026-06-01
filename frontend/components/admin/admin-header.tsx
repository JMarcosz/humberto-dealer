'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/queries'
import {
  Car,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingCart,
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/vehiculos', label: 'Vehículos', icon: Car },
  { href: '/admin/reservas', label: 'Reservas', icon: ShoppingCart },
  { href: '/admin/historial', label: 'Historial Ventas', icon: History },
  { href: '/admin/excel', label: 'Excel', icon: FileSpreadsheet },
]

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { data: user } = useCurrentUser()

  const handleLogout = async () => {
    try { await api.logout() } catch {}
    router.push('/login')
  }

  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      {/* Mobile Menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar">
          <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
            <Image
              src="/logo.png"
              alt="Humberto Auto Import"
              width={40}
              height={40}
              className="h-8 w-8 object-contain"
            />
            <span className="font-bold text-sidebar-foreground">Admin Panel</span>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="border-t border-sidebar-border p-4 space-y-2">
            <Link href="/" onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                <Home className="h-4 w-4" />
                Ver Sitio Público
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logo for mobile */}
      <Link href="/admin" className="flex items-center gap-2 lg:hidden">
        <Image
          src="/logo.png"
          alt="Humberto Auto Import"
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
        />
        <span className="font-bold">Admin</span>
      </Link>

      <div className="flex-1" />

      {/* User Info + Logout */}
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.nombre}
          </span>
        )}
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium select-none">
          {initials}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Cerrar sesión"
          className="hidden lg:flex"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
