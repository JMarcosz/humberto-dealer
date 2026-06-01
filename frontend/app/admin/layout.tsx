'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { useCurrentUser } from '@/lib/queries'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: user, isLoading, isError } = useCurrentUser()

  useEffect(() => {
    if (isLoading) return
    if (isError || !user) {
      router.replace('/login')
    } else if (user.rol?.nombre !== 'ADMIN') {
      router.replace('/')
    }
  }, [user, isLoading, isError, router])

  if (isLoading || !user || user.rol?.nombre !== 'ADMIN') return null

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
