'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

export default function ConfiguracoesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [saved, setSaved] = useState(false)

  if (role !== 'ADMIN') {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a Administradores.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <PageHeader
        title="Configurações"
        subtitle="Definições gerais do sistema"
      />

      <div className="space-y-4">
        {/* App info */}
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

        {/* Quick links */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Ações de Sistema</h3>
          <div className="space-y-2">
            <a
              href="/importacao-auferma"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Importar Matriz Auferma</p>
                  <p className="text-xs text-gray-500">Carregar dados de vendas do ficheiro Excel</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>

            <a
              href="/importacao"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Importação CSV</p>
                  <p className="text-xs text-gray-500">Importar clientes, vendas ou produtos via CSV</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Seed info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 text-center">
            Para repor dados de demonstração: <code className="bg-gray-200 px-1 rounded text-gray-700">/api/seed?secret=auferma2024seed</code>
          </p>
        </div>
      </div>
    </div>
  )
}
