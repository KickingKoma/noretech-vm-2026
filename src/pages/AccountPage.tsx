import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function StatusMsg({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <p className={`text-sm mt-2 ${ok ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
  )
}

export function AccountPage() {
  const { user } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [savingName, setSavingName] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('display_name').eq('id', user.id).single()
      .then(({ data }) => { if (data) setDisplayName(data.display_name) })
  }, [user])

  const saveDisplayName = async () => {
    if (!user || !displayName.trim()) return
    setSavingName(true)
    setNameMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)
    setNameMsg(error
      ? { text: 'Kunde inte spara.', ok: false }
      : { text: 'Sparat!', ok: true })
    setSavingName(false)
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Lösenorden matchar inte.', ok: false })
      return
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: 'Lösenordet måste vara minst 6 tecken.', ok: false })
      return
    }
    setSavingPw(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) { setNewPassword(''); setConfirmPassword('') }
    setPwMsg(error
      ? { text: 'Kunde inte uppdatera lösenord.', ok: false }
      : { text: 'Lösenord uppdaterat!', ok: true })
    setSavingPw(false)
  }

  const inputClass = 'w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:border-green-500 focus:outline-none text-sm'
  const btnClass = (active: boolean) =>
    `px-4 py-2 rounded text-sm font-medium transition-colors ${
      active ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400 cursor-default'
    } disabled:opacity-50`

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold text-white mb-6">Mitt konto</h1>

      <Section title="Visningsnamn">
        <input
          type="text"
          value={displayName}
          onChange={e => { setDisplayName(e.target.value); setNameMsg(null) }}
          className={inputClass}
          placeholder="Ditt namn i topplistan"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveDisplayName}
            disabled={savingName || !displayName.trim()}
            className={btnClass(!!displayName.trim())}
          >
            {savingName ? 'Sparar...' : 'Spara'}
          </button>
          {nameMsg && <StatusMsg msg={nameMsg.text} ok={nameMsg.ok} />}
        </div>
      </Section>

<Section title="Lösenord">
        <div className="space-y-2">
          <input
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPwMsg(null) }}
            className={inputClass}
            placeholder="Nytt lösenord"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setPwMsg(null) }}
            className={inputClass}
            placeholder="Bekräfta nytt lösenord"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={savePassword}
            disabled={savingPw || !newPassword}
            className={btnClass(!!newPassword)}
          >
            {savingPw ? 'Sparar...' : 'Byt lösenord'}
          </button>
          {pwMsg && <StatusMsg msg={pwMsg.text} ok={pwMsg.ok} />}
        </div>
      </Section>
    </div>
  )
}
