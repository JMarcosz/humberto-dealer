'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { api } from '@/lib/api'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    api.getCurrentUser()
      .then(user => {
        if (user?.rol?.nombre !== 'ADMIN') {
          router.replace('/')
        } else {
          setAuthorized(true)
        }
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [router])

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <AdminHeader />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
