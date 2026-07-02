'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import { PeriodProvider, PeriodSelector } from '@/components/PeriodContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f1f35] sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-white font-bold tracking-widest text-sm">AUFERMA</span>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            {session.user?.name?.charAt(0) || 'U'}
          </div>
        </header>

        {/* Global period bar */}
        <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-white border-b border-gray-100 sticky top-0 md:top-0 z-20">
          <span className="text-xs font-medium text-gray-500">Período:</span>
          <PeriodSelector />
          <span className="text-[11px] text-gray-400 hidden sm:inline">aplica-se ao Dashboard, Comerciais, Supervisão e Meu Painel</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <PwaInstallBanner />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <DashboardContent>{children}</DashboardContent>
    </PeriodProvider>
  )
}
