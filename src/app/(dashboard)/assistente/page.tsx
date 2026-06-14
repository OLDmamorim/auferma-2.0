'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const suggestions = [
  'Que clientes devo visitar esta semana?',
  'Que clientes estão em queda?',
  'Clientes inativos',
  'Tarefas pendentes',
  'Dá-me um plano para esta semana',
]

function MessageContent({ content }: { content: string }) {
  // Render markdown-like content: **bold**, bullet points, line breaks
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        // Bold text **text**
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <p key={i} className="text-sm leading-relaxed">
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function AssistentePage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Olá, ${session?.user?.name?.split(' ')[0] || 'utilizador'}! 👋\n\nSou o seu **Assistente Comercial Auferma**.\n\nPosso ajudá-lo a analisar a sua carteira de clientes, identificar oportunidades e criar planos comerciais.\n\nEscolha uma das sugestões abaixo ou escreva a sua pergunta.`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update greeting with session name
  useEffect(() => {
    if (session?.user?.name) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Olá, **${session.user.name.split(' ')[0]}**! 👋\n\nSou o seu **Assistente Comercial Auferma**.\n\nPosso ajudá-lo a analisar a sua carteira de clientes, identificar oportunidades e criar planos comerciais.\n\nEscolha uma das sugestões abaixo ou escreva a sua pergunta.`,
        timestamp: new Date(),
      }])
    }
  }, [session?.user?.name])

  async function sendMessage(text?: string) {
    const msg = text || input
    if (!msg.trim() || loading) return

    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages
            .filter(m => m.id !== '0')
            .map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar o pedido.',
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Erro ao ligar ao assistente. Por favor tente novamente.',
        timestamp: new Date(),
      }])
    }
    setLoading(false)
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <PageHeader
        title="Assistente Comercial IA"
        subtitle="Motor de análise comercial inteligente"
        actions={
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            IA generativa ativa
          </div>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                )}
                <div className={`max-w-lg rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-700 text-white rounded-tr-sm'
                    : 'bg-gray-50 border border-gray-100 rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <MessageContent content={msg.content} />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold text-gray-600">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-5">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Escreva a sua pergunta..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-700 text-white px-4 py-2.5 rounded-xl hover:bg-blue-800 transition disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar with suggestions */}
        <div className="w-64 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Sugestões</h3>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="w-full text-left text-xs text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 px-3 py-2.5 rounded-lg transition disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-blue-800 mb-2">🤖 Como funciona</h3>
            <p className="text-xs text-blue-700">
              O assistente analisa os dados reais da sua carteira (clientes, vendas, visitas, tarefas e risco) e responde a qualquer pergunta com IA generativa. Escreva livremente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
