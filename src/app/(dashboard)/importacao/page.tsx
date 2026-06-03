'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'

interface ImportRecord {
  id: string
  type: string
  filename: string
  status: string
  records: number
  errors: number
  createdAt: string
}

const importTypes = [
  { key: 'customers', label: 'Clientes', description: 'nome, nif, zona, telefone, email', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'sales', label: 'Vendas', description: 'cliente, data, valor, margem', color: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'products', label: 'Produtos', description: 'nome, sku, marca, preço', color: 'bg-purple-50 border-purple-200 text-purple-700' },
]

export default function ImportacaoPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [selectedType, setSelectedType] = useState('customers')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ records: number; errors: number } | null>(null)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchHistory = useCallback(() => {
    fetch('/api/import').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
    })
    return { headers, rows }
  }

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    const text = await f.text()
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setPreview(rows)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setResult(null)

    const text = await file.text()
    const { headers } = parseCSV(text)

    const lines = text.split('\n').filter(l => l.trim())
    const dataRows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
    })

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: selectedType, data: dataRows, filename: file.name }),
    })
    const data = await res.json()
    setResult(data)
    setImporting(false)
    fetchHistory()
    setFile(null)
    setPreview([])
    setHeaders([])
  }

  if (!['ADMIN', 'DIRECTOR'].includes(role || '')) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
          Não tem permissão para aceder a esta página. Apenas Admin e Diretor Comercial podem importar dados.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader title="Importação de Dados" subtitle="Importe clientes, vendas e produtos via CSV/Excel" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {importTypes.map(t => (
          <button
            key={t.key}
            onClick={() => setSelectedType(t.key)}
            className={`p-4 rounded-xl border-2 text-left transition ${
              selectedType === t.key ? t.color + ' border-opacity-100' : 'bg-white border-gray-100 hover:border-gray-200'
            }`}
          >
            <p className="font-semibold text-sm">{t.label}</p>
            <p className="text-xs mt-1 opacity-70">Colunas: {t.description}</p>
          </button>
        ))}
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Importar {importTypes.find(t => t.key === selectedType)?.label}
        </h3>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm text-gray-600 font-medium">
            {file ? file.name : 'Arraste um ficheiro CSV ou clique para selecionar'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Suporta CSV, XLSX, XLS</p>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Pré-visualização (primeiras 5 linhas):</p>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="data-table text-xs">
                <thead>
                  <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {headers.map(h => <td key={h}>{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${result.errors === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="text-2xl">{result.errors === 0 ? '✅' : '⚠️'}</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Importação concluída</p>
              <p className="text-xs text-gray-600">{result.records} registos importados · {result.errors} erros</p>
            </div>
          </div>
        )}

        {file && !result && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-4 w-full bg-blue-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-800 transition disabled:opacity-60"
          >
            {importing ? '⏳ A importar...' : `Importar ${importTypes.find(t => t.key === selectedType)?.label}`}
          </button>
        )}
      </div>

      {/* Import History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Histórico de Importações</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Ficheiro</th>
              <th>Estado</th>
              <th>Registos</th>
              <th>Erros</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8 text-sm">Nenhuma importação realizada ainda.</td></tr>
            ) : history.map(imp => (
              <tr key={imp.id}>
                <td><span className="badge badge-blue capitalize">{imp.type}</span></td>
                <td className="text-sm text-gray-700 font-mono">{imp.filename}</td>
                <td><span className={`badge ${imp.status === 'completed' ? 'badge-green' : 'badge-orange'}`}>{imp.status}</span></td>
                <td className="font-semibold text-gray-900">{imp.records}</td>
                <td className={imp.errors > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{imp.errors}</td>
                <td className="text-sm text-gray-500">{formatDate(imp.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
