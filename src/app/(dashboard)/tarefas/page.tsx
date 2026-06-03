'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  notes: string | null
  customer: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

interface User {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
}

const statusConfig: Record<string, { label: string; color: string; badgeClass: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-50 border-yellow-200', badgeClass: 'badge-orange' },
  IN_PROGRESS: { label: 'Em Curso', color: 'bg-blue-50 border-blue-200', badgeClass: 'badge-blue' },
  COMPLETED: { label: 'Concluída', color: 'bg-green-50 border-green-200', badgeClass: 'badge-green' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-50 border-gray-200', badgeClass: 'badge-gray' },
}

const priorityConfig: Record<string, { label: string; dot: string }> = {
  URGENT: { label: 'Urgente', dot: 'bg-red-500' },
  HIGH: { label: 'Alta', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Média', dot: 'bg-yellow-500' },
  LOW: { label: 'Baixa', dot: 'bg-gray-400' },
}

export default function TarefasPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('all')
  const role = (session?.user as any)?.role

  const fetchTasks = useCallback(() => {
    setLoading(true)
    fetch('/api/tasks')
      .then(r => r.json())
      .then(d => { setTasks(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function updateStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchTasks()
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const pendingCount = tasks.filter(t => t.status === 'PENDING').length
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length

  return (
    <div className="p-6">
      <PageHeader
        title="Tarefas Comerciais"
        subtitle={`${tasks.length} tarefas no total`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nova Tarefa
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendentes</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{pendingCount}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Em Curso</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{inProgressCount}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Concluídas</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'PENDING', label: 'Pendentes' },
          { key: 'IN_PROGRESS', label: 'Em Curso' },
          { key: 'COMPLETED', label: 'Concluídas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.key ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-sm">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Cliente</th>
                <th>Atribuída a</th>
                <th>Prioridade</th>
                <th>Estado</th>
                <th>Prazo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => {
                const pc = priorityConfig[task.priority] || { label: task.priority, dot: 'bg-gray-400' }
                const sc = statusConfig[task.status] || { label: task.status, badgeClass: 'badge-gray' }
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
                return (
                  <tr key={task.id}>
                    <td>
                      <div className="font-medium text-gray-900 text-sm">{task.title}</div>
                      {task.description && <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{task.description}</div>}
                    </td>
                    <td className="text-sm text-gray-600">{task.customer?.name || '—'}</td>
                    <td className="text-sm text-gray-600">{task.assignedTo?.name || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${pc.dot}`} />
                        <span className="text-xs text-gray-600">{pc.label}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${sc.badgeClass}`}>{sc.label}</span></td>
                    <td>
                      {task.dueDate ? (
                        <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {formatDate(task.dueDate)}
                          {isOverdue && <span className="ml-1 text-xs">⚠️</span>}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td>
                      <select
                        value={task.status}
                        onChange={e => updateStatus(task.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Curso</option>
                        <option value="COMPLETED">Concluída</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewTaskModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchTasks() }}
        />
      )}
    </div>
  )
}

function NewTaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: session } = useSession()
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    dueDate: '',
    customerId: '',
    assignedToId: '',
  })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/customers?limit=100').then(r => r.json()).then(d => setCustomers(d.customers || []))
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body: any = {
      title: form.title,
      description: form.description || undefined,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
      customerId: form.customerId || undefined,
      assignedToId: form.assignedToId || (session?.user as any)?.id,
    }
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nova Tarefa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prioridade</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                <option value="URGENT">Urgente</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Média</option>
                <option value="LOW">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Limite</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.customerId} onChange={e => setForm(f => ({...f, customerId: e.target.value}))}>
                <option value="">Nenhum</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Atribuir a</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.assignedToId} onChange={e => setForm(f => ({...f, assignedToId: e.target.value}))}>
                <option value="">Eu próprio</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'A guardar...' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
