'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import * as XLSX from 'xlsx'

interface DbStats {
  customers: number
  sales: number
  brands: number
  commercials: number
}

interface Totals {
  imported: number
  skipped: number
  errors: number
  errorLog: string[]
  skipReasons: Record<string, number>
}

const CHUNK_SIZE = 1000

export default function ImportacaoAufermaPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [phase, setPhase] = useState<string | null>(null)
  const [result, setResult] = useState<Totals | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [createCommercials, setCreateCommercials] = useState(true)
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
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.xlsm'))) {
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
    if (!confirm('Segunda confirmação: apagar todos os dados?')) return
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
    setResult(null)
    setError(null)
    setPhase('A ler o ficheiro Excel...')

    try {
      // ── 1. Parse Excel in the browser ──────────────────────────────────
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const ws = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })

      setPhase(`${rawRows.length.toLocaleString()} linhas lidas. A preparar dados...`)

      if (rawRows.length === 0) throw new Error('O ficheiro não tem linhas de dados.')

      // ── 2. Resolve real header names (robust to accents/spacing) ──────
      const normalize = (s: string) =>
        s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

      const actualKeys = Object.keys(rawRows[0])
      const keyMap = new Map<string, string>()
      for (const k of actualKeys) keyMap.set(normalize(k), k)

      const col = (wanted: string): string | null => keyMap.get(normalize(wanted)) || null

      const K = {
        data: col('Data'),
        colabNome: col('Colab_Nome'),
        cliId: col('Cli_Id'),
        cliNome: col('Cli_Nome'),
        cliContr: col('Cli_Contr'),
        cliCodPostal: col('Cli_CodPostal'),
        marca: col('Marca'),
        familia: col('Familia'),
        docId: col('Doc_Id'),
        vendas: col('Vendas'),
      }

      const missing = Object.entries(K).filter(([, v]) => !v).map(([k]) => k)
      if (missing.length > 0) {
        throw new Error(`Colunas não encontradas: ${missing.join(', ')}. Colunas no ficheiro: ${actualKeys.join(' | ')}`)
      }

      // Quantity is optional (SomaDeQuant) — not all files include it
      const quantKey = col('SomaDeQuant') || col('SomaDeQuantidade') || col('Quantidade')

      // ── 3. Map to compact payload ──────────────────────────────────────
      const rows = rawRows.map(r => ({
        data: r[K.data!] != null ? Number(r[K.data!]) : null,
        colabNome: r[K.colabNome!] ?? null,
        cliId: r[K.cliId!] ?? null,
        cliNome: r[K.cliNome!] ?? null,
        cliContr: r[K.cliContr!] ?? null,
        cliCodPostal: r[K.cliCodPostal!] ?? null,
        marca: r[K.marca!] ?? null,
        familia: r[K.familia!] ?? null,
        docId: r[K.docId!] ?? null,
        vendas: parseFloat(String(r[K.vendas!] ?? 0)) || 0,
        quantidade: quantKey ? (parseFloat(String(r[quantKey] ?? 0)) || 0) : 0,
      }))

      // Always replace the months present in the file so re-importing never
      // duplicates. YYYY-M derived from the Excel serial dates.
      const monthsSet = new Set<string>()
      for (const r of rows) {
        if (r.data == null) continue
        const adj = r.data > 59 ? r.data - 1 : r.data
        const d = new Date(Date.UTC(1900, 0, 0) + adj * 86400000)
        if (!isNaN(d.getTime())) monthsSet.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`)
      }
      const monthsPresent = Array.from(monthsSet).map(s => {
        const [y, m] = s.split('-').map(Number)
        return { year: y, month: m }
      })

      // ── 3. Send in chunks ──────────────────────────────────────────────
      const totals: Totals = { imported: 0, skipped: 0, errors: 0, errorLog: [], skipReasons: {} }
      const numChunks = Math.ceil(rows.length / CHUNK_SIZE)
      setProgress({ done: 0, total: numChunks })

      for (let i = 0; i < numChunks; i++) {
        const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const isLastChunk = i === numChunks - 1
        const isFirstChunk = i === 0
        setPhase(`A importar bloco ${i + 1} de ${numChunks}...`)

        let attempt = 0
        let ok = false
        while (attempt < 3 && !ok) {
          try {
            const res = await fetch('/api/importacao', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rows: chunk, filename: file.name, isLastChunk, createCommercials,
                ...(isFirstChunk ? { replaceMonths: monthsPresent } : {}),
              }),
            })
            if (!res.ok) {
              const txt = await res.text()
              throw new Error(`HTTP ${res.status}: ${txt.slice(0, 100)}`)
            }
            const data = await res.json()
            totals.imported += data.imported || 0
            totals.skipped += data.skipped || 0
            totals.errors += data.errors || 0
            if (data.errorLog?.length) totals.errorLog.push(...data.errorLog.slice(0, 3))
            if (data.skipReasons) {
              for (const [reason, count] of Object.entries(data.skipReasons)) {
                totals.skipReasons[reason] = (totals.skipReasons[reason] || 0) + (count as number)
              }
            }
            ok = true
          } catch (err: any) {
            attempt++
            if (attempt >= 3) throw new Error(`Bloco ${i + 1} falhou após 3 tentativas: ${err.message}`)
            await new Promise(r => setTimeout(r, 2000 * attempt))
          }
        }
        setProgress({ done: i + 1, total: numChunks })
      }

      setResult(totals)
      fetchStats()
    } catch (err: any) {
      setError(err.message || 'Erro na importação')
    } finally {
      setImporting(false)
      setPhase(null)
    }
  }

  const fileSize = file ? (file.size / 1024 / 1024).toFixed(1) : null
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

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
              <p className="text-sm font-semibold text-red-900">Limpar dados existentes</p>
              <p className="text-xs text-red-700 mt-1">
                A BD tem {stats.customers.toLocaleString()} clientes e {stats.sales.toLocaleString()} vendas.
                Limpe antes de reimportar para evitar duplicados. Os utilizadores são mantidos.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting || importing}
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

      {/* Options */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mb-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createCommercials}
            onChange={e => setCreateCommercials(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Criar comerciais automaticamente</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cria um utilizador para cada vendedor do Excel que não exista (ex: António Antunes → aantunes@auferma.pt, password inicial: auferma123)
            </p>
          </div>
        </label>

        <div className="flex items-start gap-3 border-t border-gray-100 pt-4">
          <div className="mt-0.5 w-4 h-4 rounded bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-xs">✓</div>
          <div>
            <p className="text-sm font-medium text-gray-900">Reimportação segura (automática)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              A importação <strong>substitui sempre os meses presentes no ficheiro</strong> e mantém os restantes. Podes reimportar o mesmo ficheiro sem duplicar e <strong>sem precisar de Limpar BD</strong>. Os meses que não estão no ficheiro ficam intactos.
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !importing && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition mb-4 ${
          importing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${
          dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={handleFileChange} />
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
            <p className="text-sm text-gray-400 mt-1">ou clique para selecionar · .xlsx / .xlsm</p>
          </div>
        )}
      </div>

      {/* Import button */}
      {file && !result && !importing && (
        <button
          onClick={startImport}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Iniciar Importação
        </button>
      )}

      {/* Progress */}
      {importing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-800 font-medium">{phase}</p>
          </div>
          {progress && (
            <>
              <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-blue-600 text-right">{pct}% · bloco {progress.done}/{progress.total}</p>
            </>
          )}
          <p className="text-xs text-blue-500 mt-2">⚠ Não feche nem atualize esta página durante a importação.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-red-800">Erro na importação</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <p className="text-xs text-red-500 mt-2">Os blocos já importados foram guardados. Pode limpar a BD e tentar de novo, ou contactar suporte.</p>
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
                <p className="text-sm text-green-700">
                  {result.imported.toLocaleString()} vendas importadas
                </p>
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
            {Object.keys(result.skipReasons || {}).length > 0 && (
              <div className="mt-3 bg-white rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-1.5">Motivos de exclusão:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.skipReasons).map(([reason, count]) => (
                    <span key={reason} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {reason}: {count.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result.errorLog.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800 mb-2">Primeiros erros:</p>
              {result.errorLog.slice(0, 10).map((e, i) => (
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
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Formato esperado (Ficheiro Mestre Auferma)</h3>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Colab_Nome →</span><span>Comercial responsável (cria utilizador se a opção estiver ativa)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Cli_Contr →</span><span>NIF do cliente — identificador único; cria se não existir</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Marca →</span><span>Marca do produto (cria automaticamente)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Data →</span><span>Data da venda em formato serial Excel</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Vendas →</span><span>Valor da venda (líquido — notas de crédito e devoluções são abatidas)</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Cli_CodPostal →</span><span>Zona do cliente (ex: "4435-321 RIO TINTO" → "RIO TINTO")</span></div>
          <div className="flex gap-2"><span className="font-medium w-36 flex-shrink-0">Ignorado →</span><span>Apenas linhas de valor zero. Todas as vendas, notas de crédito e devoluções são importadas (total líquido = soma da coluna Vendas).</span></div>
        </div>
      </div>
    </div>
  )
}
