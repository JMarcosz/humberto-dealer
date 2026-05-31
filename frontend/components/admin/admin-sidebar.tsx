'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Car,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  ShoppingCart
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/vehiculos', label: 'Vehículos', icon: Car },
  { href: '/admin/reservas', label: 'Reservas', icon: ShoppingCart },
  { href: '/admin/historial', label: 'Historial Ventas', icon: History },
  { href: '/admin/excel', label: 'Excel', icon: FileSpreadsheet },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <Home className="h-4 w-4" />
            Ver Sitio Público
          </Button>
        </Link>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  )
}
