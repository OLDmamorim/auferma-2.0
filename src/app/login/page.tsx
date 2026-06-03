'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou palavra-passe incorretos')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1f35] via-[#1e3a5f] to-[#1d4ed8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <Image
              src="/logo.png"
              alt="Auferma"
              width={120}
              height={120}
              className="object-contain drop-shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg' }}
            />
          </div>
          <p className="text-blue-200 text-xs tracking-widest uppercase mt-1">Commercial Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar Sessão</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="email@auferma.pt"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Contas de demonstração:</p>
            <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-500">
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Admin</span>
                <span>admin@auferma.pt / admin123</span>
              </div>
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Diretor</span>
                <span>diretor@auferma.pt / diretor123</span>
              </div>
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Comercial</span>
                <span>comercial1@auferma.pt / comercial123</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-blue-200/60 text-xs mt-6">
          © 2024 Auferma. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
