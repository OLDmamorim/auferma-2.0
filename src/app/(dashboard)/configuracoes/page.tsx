'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

const ROLES = [
  { value: 'COMMERCIAL', label: 'Comercial' },
  { value: 'DIRECTOR', label: 'Diretor' },
  { value: 'ADMIN', label: 'Administrador' },
]
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  DIRECTOR: 'bg-purple-100 text-purple-700',
  COMMERCIAL: 'bg-blue-100 text-blue-700',
}

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt?: string
  _count?: { customers: number; tasks: number; visits: number }
}

interface UserForm {
  name: string
  email: string
  password: string
  role: string
}

const emptyForm: UserForm = { name: '', email: '', password: '', role: 'COMMERCIAL' }

export default function ConfiguracoesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const sessionUserId = (session?.user as any)?.id

  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [cleanupState, setCleanupState] = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle')
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; removedUsers: string[] } | null>(null)

  if (role !== 'ADMIN') {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a Administradores.</p>
      </div>
    )
  }

  function fetchUsers() {
    setLoadingUsers(true)
    fetch('/api/users')
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoadingUsers(false) })
      .catch(() => setLoadingUsers(false))
  }

  useEffect(() => { fetchUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
    setFormError('')
    setShowForm(true)
  }

  async function submitForm() {
    if (!form.name || !form.email || (!editUser && !form.password)) {
      setFormError('Nome, email e palavra-passe são obrigatórios.')
      return
    }
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/users', {
      method: editUser ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editUser ? { id: editUser.id, ...form } : form),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error || 'Erro ao guardar'); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    fetchUsers()
  }

  async function toggleActive(u: User) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    })
    fetchUsers()
  }

  async function deleteUser(id: string) {
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setConfirmDelete(null)
    fetchUsers()
  }

  async function runCleanup() {
    setCleanupState('loading')
    const res = await fetch('/api/cleanup-demo-users', { method: 'POST' })
    const data = await res.json()
    setCleanupResult(data)
    setCleanupState('done')
    fetchUsers()
  }

  const grouped = {
    ADMIN: users.filter(u => u.role === 'ADMIN'),
    DIRECTOR: users.filter(u => u.role === 'DIRECTOR'),
    COMMERCIAL: users.filter(u => u.role === 'COMMERCIAL'),
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      <PageHeader title="Configurações" subtitle="Definições gerais do sistema" />

      {/* ── User Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {editUser ? `Editar: ${editUser.name}` : 'Criar novo utilizador'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Nome completo</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: António Antunes"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="aantunes@auferma.pt"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Palavra-passe {editUser && <span className="text-gray-400">(deixar vazio para manter)</span>}
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={editUser ? '••••••••' : 'Mínimo 6 caracteres'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Perfil</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={submitForm}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-xl transition"
              >
                {saving ? 'A guardar...' : editUser ? 'Guardar alterações' : 'Criar utilizador'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="bg-white border border-gray-200 text-gray-600 text-sm px-4 py-3 rounded-xl transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Management ── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Gestão de Utilizadores</h3>
            <p className="text-xs text-gray-500 mt-0.5">{users.length} utilizadores registados</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo utilizador
          </button>
        </div>


        {/* User list */}
        {loadingUsers ? (
          <div className="p-5 space-y-2">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(['ADMIN', 'DIRECTOR', 'COMMERCIAL'] as const).map(r => (
              grouped[r].length > 0 && (
                <div key={r}>
                  <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                    {ROLES.find(x => x.value === r)?.label}s
                  </p>
                  {grouped[r].map(u => (
                    <div key={u.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition ${!u.active ? 'opacity-50' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${u.active ? 'bg-blue-600' : 'bg-gray-400'}`}>
                        {u.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                            {ROLES.find(x => x.value === u.role)?.label}
                          </span>
                          {!u.active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inativo</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>

                      {/* Stats */}
                      {u._count && u.role === 'COMMERCIAL' && (
                        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
                          <span>{u._count.customers} clientes</span>
                          <span>{u._count.visits} visitas</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`p-1.5 rounded-lg transition ${u.active ? 'hover:bg-amber-50 text-amber-400 hover:text-amber-600' : 'hover:bg-green-50 text-green-400 hover:text-green-600'}`}
                          title={u.active ? 'Desativar' : 'Ativar'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={u.active ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                          </svg>
                        </button>
                        {u.id !== sessionUserId && (
                          confirmDelete === u.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteUser(u.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg">Confirmar</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 px-1">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(u.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── System Info ── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Informação do Sistema</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Plataforma</span>
            <span className="font-medium">Auferma 2.0 Commercial Intelligence</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Versão</span>
            <span className="font-medium">2.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Utilizador atual</span>
            <span className="font-medium">{session?.user?.name}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Perfil</span>
            <span className="font-medium">{role}</span>
          </div>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Ações de Sistema</h3>
        <div className="space-y-2">
          <a href="/importacao-auferma" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Importar Matriz Auferma</p>
                <p className="text-xs text-gray-500">Carregar dados de vendas do ficheiro Excel</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
          <a href="/importacao" className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Importação CSV</p>
                <p className="text-xs text-gray-500">Importar clientes, vendas ou produtos via CSV</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>

      {/* ── Cleanup demo users ── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Remover utilizadores de demonstração</h3>
        <p className="text-xs text-gray-500 mb-4">Remove todos os comerciais sem vendas associadas (utilizadores de seed).</p>
        {cleanupState === 'done' && cleanupResult ? (
          <div className={`rounded-lg p-3 text-sm ${cleanupResult.deleted > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
            {cleanupResult.deleted > 0 ? (
              <><p className="font-semibold mb-1">✓ {cleanupResult.deleted} removidos</p><p className="text-xs">{cleanupResult.removedUsers.join(', ')}</p></>
            ) : <p>Nenhum utilizador demo encontrado.</p>}
          </div>
        ) : cleanupState === 'confirm' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800 mb-3">Tem a certeza? Esta ação é permanente.</p>
            <div className="flex gap-2">
              <button onClick={runCleanup} className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-lg">Confirmar</button>
              <button onClick={() => setCleanupState('idle')} className="bg-white border border-gray-200 text-gray-600 text-xs px-3 py-2 rounded-lg">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCleanupState('confirm')} disabled={cleanupState === 'loading'} className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Remover utilizadores demo
          </button>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 text-center">
          Para repor dados de demonstração: <code className="bg-gray-200 px-1 rounded text-gray-700">/api/seed?secret=auferma2024seed</code>
        </p>
      </div>
    </div>
  )
}
