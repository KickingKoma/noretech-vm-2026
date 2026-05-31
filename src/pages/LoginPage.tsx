import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

type Tab = 'login' | 'register'

export function LoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggning misslyckades')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.')
      return
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.')
      return
    }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }
    // Update display name if provided
    if (displayName.trim() && data.user) {
      await supabase.from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', data.user.id)
    }
    setSuccess('Konto skapat! Kontrollera din e-post för att bekräfta kontot, logga sedan in.')
    setLoading(false)
  }

  const inputClass = 'w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-xl p-8 w-full max-w-sm border border-gray-800">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⚽</div>
          <h1 className="text-2xl font-bold text-white">VM-Tippning 2026</h1>
          <p className="text-gray-500 text-sm mt-1">FIFA World Cup 2026</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
          <button
            onClick={() => { setTab('login'); setError(null); setSuccess(null) }}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Logga in
          </button>
          <button
            onClick={() => { setTab('register'); setError(null); setSuccess(null) }}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Registrera
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Lösenord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" className={inputClass} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Namn i topplistan</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="T.ex. Kim" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Lösenord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bekräfta lösenord</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                required autoComplete="new-password" className={inputClass} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Skapar konto...' : 'Skapa konto'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
