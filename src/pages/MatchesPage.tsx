import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeadlines } from '../hooks/useDeadlines'
import { calcPoints, GROUP_ROUNDS, ROUND_LABEL } from '../types'
import type { Match, UserTip } from '../types'
import { Flag } from '../components/Flag'

interface DraftTip { home: string; away: string }

export function MatchesPage() {
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, DraftTip>>(new Map())
  const [activeRound, setActiveRound] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const { groupLocked } = useDeadlines(allMatches)

  const groupMatches = allMatches.filter(m => GROUP_ROUNDS.includes(m.round))

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: matchData }, { data: tipData }] = await Promise.all([
        supabase.from('matches').select('*').order('starts_at'),
        supabase.from('tips').select('*').eq('user_id', user!.id),
      ])

      if (matchData) {
        setAllMatches(matchData)
        const rounds = [...new Set(
          matchData
            .filter((m: Match) => GROUP_ROUNDS.includes(m.round))
            .map((m: Match) => m.round)
        )].sort((a, b) => GROUP_ROUNDS.indexOf(a) - GROUP_ROUNDS.indexOf(b))
        setActiveRound(rounds[0] ?? '')
      }

      if (tipData) {
        const map = new Map<string, UserTip>()
        tipData.forEach((t: UserTip) => map.set(t.match_id, t))
        setTips(map)
      }

      setLoading(false)
    }
    load()
  }, [user])

  const setDraft = (matchId: string, field: 'home' | 'away', value: string) => {
    const existing = tips.get(matchId)
    setDrafts(prev => {
      const current = prev.get(matchId) ?? {
        home: existing?.home_tip?.toString() ?? '',
        away: existing?.away_tip?.toString() ?? '',
      }
      return new Map(prev).set(matchId, { ...current, [field]: value })
    })
  }

  const getDraft = (matchId: string): DraftTip => {
    if (drafts.has(matchId)) return drafts.get(matchId)!
    const existing = tips.get(matchId)
    return {
      home: existing?.home_tip?.toString() ?? '',
      away: existing?.away_tip?.toString() ?? '',
    }
  }

  const saveTip = async (matchId: string) => {
    if (groupLocked) return
    const draft = getDraft(matchId)
    if (draft.home === '' || draft.away === '') return
    const h = parseInt(draft.home)
    const a = parseInt(draft.away)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return

    setSaving(matchId)
    const { data } = await supabase
      .from('tips')
      .upsert({ user_id: user!.id, match_id: matchId, home_tip: h, away_tip: a, winner_tip: null },
        { onConflict: 'user_id,match_id' })
      .select().single()

    if (data) {
      setTips(prev => new Map(prev).set(matchId, data))
      setDrafts(prev => { const m = new Map(prev); m.delete(matchId); return m })
    }
    setSaving(null)
  }

  const rounds = [...new Set(groupMatches.map(m => m.round))]
    .sort((a, b) => GROUP_ROUNDS.indexOf(a) - GROUP_ROUNDS.indexOf(b))

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar...</div>
  if (groupMatches.length === 0) return <div className="text-gray-400 text-center py-12">Inga gruppspelsmatcher inlagda än.</div>

  return (
    <div>
      {/* Round tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {rounds.map(round => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeRound === round
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
                }`}
              >
                {ROUND_LABEL[round] ?? round}
              </button>
            ))}
          </div>

      {/* Match list */}
      <div className="space-y-3">
        {groupMatches
          .filter(m => m.round === activeRound)
          .map(match => {
            const savedTip = tips.get(match.id)
            const draft = getDraft(match.id)
            const hasResult = match.home_score !== null && match.away_score !== null
            const isSaving = saving === match.id

            let pointsEarned: number | null = null
            if (hasResult && savedTip) {
              pointsEarned = calcPoints(
                match.home_score!, match.away_score!, match.winner_team,
                savedTip.home_tip, savedTip.away_tip, savedTip.winner_tip,
                false,
              )
            }

            const isDirty = !groupLocked && (
              draft.home !== (savedTip?.home_tip?.toString() ?? '') ||
              draft.away !== (savedTip?.away_tip?.toString() ?? '')
            )

            return (
              <div key={match.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">
                    {new Date(match.starts_at).toLocaleString('sv-SE', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {pointsEarned !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      pointsEarned === 30 ? 'bg-amber-600 text-amber-100' :
                      pointsEarned! > 0 ? 'bg-cyan-800 text-cyan-200' :
                      'bg-red-900 text-red-300'
                    }`}>{pointsEarned}p</span>
                  )}
                </div>

                {/* Lag */}
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-white flex items-center gap-1.5"><Flag name={match.home_team} />{match.home_team}</span>
                  <span className="font-medium text-white flex items-center gap-1.5">{match.away_team}<Flag name={match.away_team} /></span>
                </div>

                {/* Resultat + tips */}
                <div className="flex items-center justify-center gap-3">
                  {hasResult && (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Resultat</div>
                      <span className="text-lg font-bold text-white tabular-nums">
                        {match.home_score}–{match.away_score}
                      </span>
                    </div>
                  )}

                  {!groupLocked ? (
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="numeric" pattern="[0-9]*"
                        value={draft.home}
                        onChange={e => setDraft(match.id, 'home', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="–"
                        className="w-14 bg-gray-800 text-white text-center rounded px-1 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none tabular-nums text-lg"
                      />
                      <span className="text-gray-500 font-bold">–</span>
                      <input type="text" inputMode="numeric" pattern="[0-9]*"
                        value={draft.away}
                        onChange={e => setDraft(match.id, 'away', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="–"
                        className="w-14 bg-gray-800 text-white text-center rounded px-1 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none tabular-nums text-lg"
                      />
                      <button
                        onClick={() => saveTip(match.id)}
                        disabled={isSaving || (!isDirty && !!savedTip)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          isDirty ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          : savedTip ? 'bg-gray-700 text-gray-400 cursor-default'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        } disabled:opacity-50`}
                      >
                        {isSaving ? '...' : savedTip && !isDirty ? 'Sparat' : 'Spara'}
                      </button>
                    </div>
                  ) : savedTip ? (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Mitt tips</div>
                      <span className={`text-lg font-bold tabular-nums ${
                        pointsEarned === 30 ? 'text-amber-400' :
                        pointsEarned! > 0 ? 'text-cyan-400' :
                        pointsEarned === 0 ? 'text-red-400' :
                        'text-gray-300'
                      }`}>
                        {savedTip.home_tip}–{savedTip.away_tip}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 italic">Ej tippat</span>
                  )}
                </div>
              </div>
            )
          })}
          </div>

      <p className="text-gray-600 text-xs mt-4 text-center">
        Exakt resultat = 30p &nbsp;·&nbsp; Rätt utfall = 10–20p &nbsp;·&nbsp; Fel = 0p
      </p>
    </div>
  )
}
