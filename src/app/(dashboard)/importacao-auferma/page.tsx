'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

interface DbStats {
  customers: number
  sales: number
  brands: number
  commercials: number
}

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  errorLog: string[]
  message: string
}

export default function ImportacaoAufermaPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchStats = useCallback(() => {
    fetch('/api/importacao').then(r => r.json()).then(d => setStats(d)).catch(() => {})
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (role && !['ADMIN', 'DIRECTOR'].includes(role)) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso restrito a Administradores e Diretores.</p>
      </div>
    )
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setResult(null); setError(null) }
  }

  async function handleReset() {
    if (!confirm('Isto vai apagar TODOS os clientes, vendas, marcas, tarefas e visitas.\n\nOs utilizadores (logins) são mantidos.\n\nTem a certeza?')) return
    if (!confirm('Segunda confirmação: apagar todos os dados fictícios?')) return
    setResetting(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_CONFIRMED' }),
      })
      const data = await res.json()
      if (res.ok) { setResetDone(true); fetchStats() }
      else setError(data.error || 'Erro no reset')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResetting(false)
    }
  }

  async function startImport() {
    if (!file) return
    setImporting(true)
    setProgress('A processar ficheiro...')
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', 'upsert')

    try {
      setProgress('A importar dados — pode demorar alguns minutos para ficheiros grandes...')
      const res = await fetch('/api/importacao', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro desconhecido')
      } else {
        setResult(data)
        fetchStats()
      }
    } catch (err: any) {
      setError(err.message || 'Erro na importação')
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  const fileSize = file ? (file.size / 1024 / 1024).toFixed(1) : null

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader
        title="Importar Matriz Auferma"
        subtitle="Importação do ficheiro de vendas no formato Auferma 2.0"
      />

      {/* DB Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="kpi-card text-center">
            <p className="text-xl font-bold text-gray-900">{stats.customers.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Clientes na BD</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xl font-bold text-gray-900">{stats.sales.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Vendas na BD</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xl font-bold text-gray-900">{stats.brands}</p>
            <p className="text-xs text-gray-500 mt-0.5">Marcas</p>
          </div>
          <div className="kpi-card text-center">
            <p className="text-xl font-bold text-gray-900">{stats.commercials}</p>
            <p className="text-xs text-gray-500 mt-0.5">Comerciais</p>
          </div>
        </div>
      )}

      {/* Reset section */}
      {stats && (stats.customers > 0 || stats.sales > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-900">Limpar dados de demonstração</p>
              <p className="text-xs text-red-700 mt-1">
                A BD tem {stats.customers.toLocaleString()} clientes e {stats.sales.toLocaleString()} vendas.
                Se forem dados fictícios do seed, limpe antes de importar os dados reais.
                Os utilizadores e logins são mantidos.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 whitespace-nowrap"
            >
              {resetting ? 'A limpar...' : '🗑️ Limpar BD'}
            </button>
          </div>
          {resetDone && (
            <p className="text-xs text-green-700 font-medium mt-2">✓ Base de dados limpa com sucesso. Pronto para importar.</p>
          )}
        </div>
      )}

      {/* Format info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Formato esperado</h3>
        <p className="text-xs text-blue-700 mb-2">Ficheiro Excel (.xlsx) com as seguintes colunas:</p>
        <div className="flex flex-wrap gap-1.5">
          {['Mês Nº','Mês','Ficheiro','Numero Cliente','NIF','Vendedor','Cliente','Localidade','Código','Produto','Classificação 1','Classificação Nivel 2','Tipo de Instalação','Unidade','Quantidade','Valor Produto','Desconto','Valor Líquido','Tipo'].map(col => (
            <span key={col} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{col}</span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-3">
          ✓ Cria clientes automaticamente por NIF · ✓ Cria marcas por Classificação 1 ·
          ✓ Associa vendedor por nome · ✓ Linhas de Desconto são ignoradas · ✓ Upsert seguro — não duplica clientes
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition mb-4 ${
          dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        {file ? (
          <div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{fileSize} MB · Clique para substituir</p>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-medium text-gray-700">Arraste o ficheiro Excel aqui</p>
            <p className="text-sm text-gray-400 mt-1">ou clique para selecionar · .xlsx / .xls</p>
          </div>
        )}
      </div>

      {/* Warning for large files */}
      {file && file.size > 5 * 1024 * 1024 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-800">
            ⚠ Ficheiro grande ({fileSize} MB) — a importação pode demorar 3-8 minutos. Não feche o ecrã.
          </p>
        </div>
      )}

      {/* Import button */}
      {file && !result && (
        <button
          onClick={startImport}
          disabled={importing}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {importing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              A importar...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Iniciar Importação
            </>
          )}
        </button>
      )}

      {/* Progress */}
      {progress && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800">{progress}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-red-800">Erro na importação</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-900">Importação concluída</p>
                <p className="text-sm text-green-700">{result.message}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.imported.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Importados</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{result.skipped.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Ignorados</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${result.errors > 0 ? 'text-red-500' : 'text-gray-400'}`}>{result.errors}</p>
                <p className="text-xs text-gray-500">Erros</p>
              </div>
            </div>
          </div>

          {result.errorLog.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800 mb-2">Primeiros erros:</p>
              {result.errorLog.map((e, i) => (
                <p key={i} className="text-xs text-red-600 font-mono">{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = '' }}
            className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Importar outro ficheiro
          </button>
        </div>
      )}

      {/* Mapping info */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Como é feito o mapeamento</h3>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Vendedor →</span><span>Associado ao Comercial pelo nome (correspondência automática)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">NIF →</span><span>Identifica o cliente de forma única; cria se não existir</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Classificação 1 →</span><span>Cria/associa a Marca automaticamente</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Mês + Ficheiro →</span><span>Data da venda (dia 15 do mês)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Valor Líquido →</span><span>Total da venda (linhas de Desconto são ignoradas)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Localidade →</span><span>Zona do cliente (ex: "4435-321 RIO TINTO" → "RIO TINTO")</span></div>
        </div>
      </div>
    </div>
  )
}
