'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import type { Usuario } from '@/lib/types'

const INSTAGRAM = 'https://www.instagram.com/humbertoautoimportsrl?igsh=MTRobGN2MDNvMHp1dg=='
const TIKTOK    = 'https://www.tiktok.com/@humbertoautoimport?is_from_webapp=1&sender_device=pc'
const WHATSAPP  = 'https://wa.me/18495809586?text=Hola,%20estoy%20interesado%20en%20un%20vehículo'

function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

function TkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.28 8.28 0 0 0 4.84 1.54V6.78a4.85 4.85 0 0 1-1.07-.09z"/>
    </svg>
  )
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  )
}

export function Footer() {
  const [user, setUser] = useState<Usuario | null>(null)

  useEffect(() => {
    api.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  return (
    <footer id="contacto" className="bg-[#0d0d0d] text-white">
      <div className="container mx-auto px-4 pt-14 pb-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">

          {/* Brand + redes */}
          <div className="space-y-5">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Humberto Auto Import" width={44} height={44} className="h-11 w-11 object-contain" />
              <span className="font-black text-base leading-tight">
                HUMBERTO<br />
                <span style={{ color: '#FF5500' }}>AUTO IMPORT</span>
              </span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Tu concesionaria de confianza en República Dominicana. Importación directa, garantía total y el mejor precio del mercado.
            </p>

            {/* Redes sociales */}
            <div className="flex gap-3">
              {[
                { href: INSTAGRAM, icon: IgIcon,  label: 'Instagram', color: 'from-purple-600 to-pink-500' },
                { href: TIKTOK,    icon: TkIcon,  label: 'TikTok',    color: 'from-gray-800 to-gray-600' },
                { href: WHATSAPP,  icon: WaIcon,  label: 'WhatsApp',  color: 'from-green-600 to-green-400' },
              ].map(({ href, icon: Icon, label, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${color} text-white transition-transform hover:scale-110`}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Enlaces rápidos */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#FF5500' }}>
              Encuentra en Humberto
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/#catalogo-section', label: 'Catálogo de vehículos' },
                { href: '/#marcas',           label: 'Explorar por marca' },
                { href: '/login',             label: 'Iniciar sesión' },
                { href: '/registro',          label: 'Crear cuenta' },
                ...(user?.rol?.nombre === 'ADMIN' ? [{ href: '/admin', label: 'Panel Admin' }] : []),
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-white/50 transition-colors hover:text-orange-500">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#FF5500' }}>Contacto</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-white/50">
                <MapPin className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                <span>Prol. Av. 27 de Febrero 467, Santo Domingo</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-orange-500 shrink-0" />
                <a href="tel:+18495809586" className="text-white/50 hover:text-orange-500 transition-colors">
                  +1 (849) 580-9586
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-500 shrink-0" />
                <a href="mailto:info@humbertoautoimport.com" className="text-white/50 hover:text-orange-500 transition-colors">
                  info@humbertoautoimport.com
                </a>
              </li>
            </ul>
          </div>

          {/* Horario */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#FF5500' }}>Horario</h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                Lun – Vie: 9:00 AM – 7:00 PM
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                Sábado: 9:00 AM – 5:00 PM
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500/40 shrink-0" />
                <span className="text-white/30">Domingo: Cerrado</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/30 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Humberto Auto Import SRL. Todos los derechos reservados.</p>
          <p>Santo Domingo, República Dominicana</p>
        </div>
      </div>
    </footer>
  )
}
