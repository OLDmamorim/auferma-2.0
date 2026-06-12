'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const navItems = [
  {
    group: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'chart-bar' },
      { href: '/meu-painel', label: 'O Meu Painel', icon: 'user-circle' },
      { href: '/comerciais', label: 'Comerciais', icon: 'users', roles: ['ADMIN', 'DIRECTOR'] },
    ]
  },
  {
    group: 'Comercial',
    items: [
      { href: '/clientes', label: 'Clientes', icon: 'building' },
      { href: '/pipeline', label: 'Propostas', icon: 'funnel' },
      { href: '/vendas', label: 'Vendas', icon: 'currency' },
      { href: '/tarefas', label: 'Tarefas', icon: 'check' },
      { href: '/visitas', label: 'Visitas', icon: 'map-pin' },
    ]
  },
  {
    group: 'Análise',
    items: [
      { href: '/analise-comportamento', label: 'Comportamento', icon: 'signal' },
      { href: '/targets', label: 'Metas', icon: 'target' },
      { href: '/performance', label: 'Performance', icon: 'trending-up' },
      { href: '/assistente', label: 'Assistente IA', icon: 'sparkles' },
      { href: '/gamificacao', label: 'Gamificação', icon: 'trophy' },
    ]
  },
  {
    group: 'Diretor',
    items: [
      { href: '/supervisao', label: 'Supervisão', icon: 'eye', roles: ['ADMIN', 'DIRECTOR'] },
      { href: '/alertas', label: 'Alertas', icon: 'bell', roles: ['ADMIN', 'DIRECTOR'] },
    ]
  },
  {
    group: 'Sistema',
    items: [
      { href: '/importacao-auferma', label: 'Importar Matriz', icon: 'upload', roles: ['ADMIN', 'DIRECTOR'] },
      { href: '/importacao', label: 'Importação CSV', icon: 'upload', roles: ['ADMIN', 'DIRECTOR'] },
      { href: '/configuracoes', label: 'Configurações', icon: 'cog', roles: ['ADMIN'] },
    ]
  }
]

function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, string> = {
    'chart-bar': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    'users': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    'building': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    'currency': 'M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z',
    'check': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    'map-pin': 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    'sparkles': 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    'trophy': 'M8 21v-2a4 4 0 014-4 4 4 0 014 4v2M12 3v4m0 0a4 4 0 01-4 4H4m8-4a4 4 0 004 4h4',
    'upload': 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    'cog': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    'signal': 'M3 12h2l3-9 4 18 3-9h6',
    'user-circle': 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    'funnel': 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
    'target': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    'trending-up': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    'eye': 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-9a9.003 9.003 0 00-8.485 6 9.003 9.003 0 0016.97 0A9.003 9.003 0 0012 3z',
    'bell': 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    'x': 'M6 18L18 6M6 6l12 12',
  }
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={icons[name] || icons['chart-bar']} />
    </svg>
  )
}

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ''

  const content = (
    <aside className="h-full w-64 bg-[#0f1f35] flex flex-col">
      {/* Brand */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png.png"
          alt="Auferma"
          className="w-full max-h-16 object-contain"
          style={{ mixBlendMode: 'screen', filter: 'invert(1) brightness(1.5)' }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.mixBlendMode = 'normal'
            el.style.filter = 'none'
            el.src = '/logo.svg'
          }}
        />
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 md:hidden text-slate-400 hover:text-white p-1">
            <Icon name="x" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navItems.map(group => {
          const visibleItems = group.items.filter(item =>
            !item.roles || item.roles.includes(role)
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.group}>
              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`sidebar-link ${isActive ? 'active' : 'inactive'}`}
                    >
                      <Icon name={item.icon} className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {session?.user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{(session?.user as any)?.role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-400 hover:text-white transition-colors"
            title="Sair"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden md:flex fixed top-0 left-0 h-full w-64 z-50">
        {content}
      </div>

      {/* Mobile: slide-over drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={onClose}
          />
          <div className="fixed top-0 left-0 h-full w-64 z-50 md:hidden">
            {content}
          </div>
        </>
      )}
    </>
  )
}
