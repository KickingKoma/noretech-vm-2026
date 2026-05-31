import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { KNOCKOUT_ROUNDS, GROUP_ROUNDS, ROUND_LABEL } from '../types'
import type { Match } from '../types'

const ALL_ROUNDS = [
  ...GROUP_ROUNDS.map(v => ({ value: v, label: ROUND_LABEL[v] })),
  ...KNOCKOUT_ROUNDS.map(v => ({ value: v, label: ROUND_LABEL[v] })),
]

const isKnockout = (round: string) => KNOCKOUT_ROUNDS.includes(round)

export function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState<Match[]>([])
  const [filterRound, setFilterRound] = useState('all')
  const [form, setForm] = useState({
    home_team: '',
    away_team: '',
    home_source_match_id: '',
    away_source_match_id: '',
    home_source_is_winner: true,
    away_source_is_winner: true,
    starts_at: '',
    round: 'group-A',
  })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!isAdmin) { navigate('/'); return }
    loadMatches()
  }, [isAdmin, loading])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('starts_at')
    if (data) setMatches(data)
  }

  async function addMatch(e: FormEvent) {
    e.preventDefault()
    setAdding(true)

    const payload: Partial<Match> & { home_team?: string | null; away_team?: string | null } = {
      starts_at: new Date(form.starts_at).toISOString(),
      round: form.round,
    }

    if (isKnockout(form.round)) {
      payload.home_team = form.home_team.trim() || null
      payload.away_team = form.away_team.trim() || null
      payload.home_source_match_id = form.home_source_match_id || null
      payload.away_source_match_id = form.away_source_match_id || null
      payload.home_source_is_winner = form.home_source_is_winner
      payload.away_source_is_winner = form.away_source_is_winner
    } else {
      payload.home_team = form.home_team.trim()
      payload.away_team = form.away_team.trim()
    }

    await supabase.from('matches').insert(payload)
    setForm(p => ({ ...p, home_team: '', away_team: '', starts_at: '', home_source_match_id: '', away_source_match_id: '' }))
    await loadMatches()
    setAdding(false)
  }

  async function saveResult(matchId: string, homeScore: number | null, awayScore: number | null, winnerTeam: string | null) {
    await supabase.from('matches')
      .update({ home_score: homeScore, away_score: awayScore, winner_team: winnerTeam || null })
      .eq('id', matchId)
    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, home_score: homeScore, away_score: awayScore, winner_team: winnerTeam } : m
    ))
  }

  async function deleteMatch(matchId: string) {
    if (!confirm('Ta bort matchen och alla tips på den?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    setMatches(prev => prev.filter(m => m.id !== matchId))
  }

  if (!isAdmin) return null

  const knockout = isKnockout(form.round)
  const roundsInUse = ['all', ...new Set(matches.map(m => m.round))]
  const filtered = filterRound === 'all' ? matches : matches.filter(m => m.round === filterRound)

  return (
    <div className="space-y-8">

      {/* Add match form */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">Lägg till match</h2>
        <form onSubmit={addMatch} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Omgång</label>
              <select
                value={form.round}
                onChange={e => setForm(p => ({ ...p, round: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                {ALL_ROUNDS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Starttid</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))}
                required
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Group stage: enter team names directly */}
          {!knockout && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Hemmalag</label>
                <input
                  value={form.home_team}
                  onChange={e => setForm(p => ({ ...p, home_team: e.target.value }))}
                  required={!knockout}
                  placeholder="Sverige"
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Bortalag</label>
                <input
                  value={form.away_team}
                  onChange={e => setForm(p => ({ ...p, away_team: e.target.value }))}
                  required={!knockout}
                  placeholder="Brasilien"
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Knockout: source matches or direct team names */}
          {knockout && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                För R32: ange lagnamn direkt. För senare rundor: välj source-match (vinnaren/förloraren av den matchen spelar här).
              </p>
              {(['home', 'away'] as const).map(side => (
                <div key={side} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      {side === 'home' ? 'Hemma' : 'Borta'}: lagnamn (valfritt)
                    </label>
                    <input
                      value={side === 'home' ? form.home_team : form.away_team}
                      onChange={e => setForm(p => side === 'home'
                        ? { ...p, home_team: e.target.value }
                        : { ...p, away_team: e.target.value }
                      )}
                      placeholder="t.ex. Brasilien"
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Eller: source-match</label>
                    <select
                      value={side === 'home' ? form.home_source_match_id : form.away_source_match_id}
                      onChange={e => setForm(p => side === 'home'
                        ? { ...p, home_source_match_id: e.target.value }
                        : { ...p, away_source_match_id: e.target.value }
                      )}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
                    >
                      <option value="">— ingen —</option>
                      {matches.filter(m => KNOCKOUT_ROUNDS.includes(m.round)).map(m => (
                        <option key={m.id} value={m.id}>
                          {new Date(m.starts_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                          {' '}{m.home_team ?? '?'} – {m.away_team ?? '?'} ({ROUND_LABEL[m.round]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Vinnare/förlorare</label>
                    <select
                      value={side === 'home'
                        ? (form.home_source_is_winner ? 'winner' : 'loser')
                        : (form.away_source_is_winner ? 'winner' : 'loser')
                      }
                      onChange={e => {
                        const isWinner = e.target.value === 'winner'
                        setForm(p => side === 'home'
                          ? { ...p, home_source_is_winner: isWinner }
                          : { ...p, away_source_is_winner: isWinner }
                        )
                      }}
                      className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-green-500 focus:outline-none"
                    >
                      <option value="winner">Vinnaren</option>
                      <option value="loser">Förloraren</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={adding}
            className="bg-green-600 hover:bg-green-500 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {adding ? 'Lägger till...' : 'Lägg till match'}
          </button>
        </form>
      </div>

      {/* Match list + result entry */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-lg font-bold text-white">Matcher ({matches.length})</h2>
          <select
            value={filterRound}
            onChange={e => setFilterRound(e.target.value)}
            className="bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600 focus:outline-none"
          >
            {roundsInUse.map(r => (
              <option key={r} value={r}>
                {r === 'all' ? 'Alla' : (ROUND_LABEL[r] ?? r)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          {filtered.map(match => (
            <ResultRow
              key={match.id}
              match={match}
              onSave={saveResult}
              onDelete={deleteMatch}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm py-4 text-center">Inga matcher.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultRow({ match, onSave, onDelete }: {
  match: Match
  onSave: (id: string, home: number | null, away: number | null, winner: string | null) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [home, setHome] = useState(match.home_score?.toString() ?? '')
  const [away, setAway] = useState(match.away_score?.toString() ?? '')
  const [winner, setWinner] = useState(match.winner_team ?? '')
  const [saving, setSaving] = useState(false)
  const knockout = KNOCKOUT_ROUNDS.includes(match.round)

  async function save() {
    setSaving(true)
    const h = home.trim() === '' ? null : parseInt(home)
    const a = away.trim() === '' ? null : parseInt(away)
    await onSave(match.id, h, a, knockout ? winner || null : null)
    setSaving(false)
  }

  const displayName = [match.home_team, match.away_team].filter(Boolean).join(' – ') || '(TBD)'

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-700/40 last:border-0 text-sm flex-wrap">
      <span className="text-gray-600 w-14 shrink-0 text-xs">
        {new Date(match.starts_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
      </span>
      <span className="text-gray-300 flex-1 min-w-32 truncate">
        {displayName}
        <span className="text-gray-600 ml-1 text-xs">({ROUND_LABEL[match.round] ?? match.round})</span>
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <input type="number" min="0" value={home} onChange={e => setHome(e.target.value)} placeholder="–"
          className="w-10 bg-gray-700 text-white text-center rounded px-1 py-1 border border-gray-600 text-sm" />
        <span className="text-gray-600">–</span>
        <input type="number" min="0" value={away} onChange={e => setAway(e.target.value)} placeholder="–"
          className="w-10 bg-gray-700 text-white text-center rounded px-1 py-1 border border-gray-600 text-sm" />

        {knockout && (
          <input
            value={winner}
            onChange={e => setWinner(e.target.value)}
            placeholder="Vinnare"
            className="w-24 bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 text-xs"
          />
        )}

        <button onClick={save} disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs disabled:opacity-50">
          {saving ? '...' : 'OK'}
        </button>
        <button onClick={() => onDelete(match.id)} disabled={saving}
          className="text-gray-600 hover:text-red-400 text-xs px-1" title="Ta bort">
          🗑
        </button>
      </div>
    </div>
  )
}
