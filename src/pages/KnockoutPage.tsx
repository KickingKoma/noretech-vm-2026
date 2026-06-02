import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeadlines } from '../hooks/useDeadlines'
import { getEffectiveTeam, calcPoints, KNOCKOUT_ROUNDS, ROUND_LABEL } from '../types'
import type { Match, UserTip } from '../types'
import { Flag } from '../components/Flag'

function formatDeadline(d: Date): string {
  return d.toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface DraftTip {
  home: string
  away: string
  winner: string
}

export function KnockoutPage() {
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, DraftTip>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { knockoutDeadline, knockoutLocked } = useDeadlines(allMatches)

  const knockoutMatches = useMemo(
    () => allMatches.filter(m => KNOCKOUT_ROUNDS.includes(m.round)),
    [allMatches],
  )

  const matchMap = useMemo(
    () => new Map(allMatches.map(m => [m.id, m])),
    [allMatches],
  )

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: matchData }, { data: tipData }] = await Promise.all([
        supabase.from('matches').select('*').order('starts_at'),
        supabase.from('tips').select('*').eq('user_id', user!.id),
      ])
      if (matchData) setAllMatches(matchData)
      if (tipData) {
        const map = new Map<string, UserTip>()
        tipData.forEach((t: UserTip) => map.set(t.match_id, t))
        setTips(map)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const getDraft = (match: Match, _homeTeam: string, _awayTeam: string): DraftTip => {
    if (drafts.has(match.id)) return drafts.get(match.id)!
    const saved = tips.get(match.id)
    return {
      home: saved?.home_tip?.toString() ?? '',
      away: saved?.away_tip?.toString() ?? '',
      winner: saved?.winner_tip ?? '',
    }
  }

  const updateDraft = (matchId: string, field: keyof DraftTip, value: string) => {
    setDrafts(prev => {
      const current = prev.get(matchId) ?? { home: '', away: '', winner: '' }
      const updated = { ...current, [field]: value }

      // Auto-set winner from score when unambiguous
      if (field === 'home' || field === 'away') {
        const h = parseInt(field === 'home' ? value : current.home)
        const a = parseInt(field === 'away' ? value : current.away)
        if (!isNaN(h) && !isNaN(a) && h !== a) {
          // winner will be set when we have team context — handled in save
        }
      }

      return new Map(prev).set(matchId, updated)
    })
  }

  const saveTip = async (match: Match, homeTeam: string, awayTeam: string) => {
    if (knockoutLocked) return
    const draft = getDraft(match, homeTeam, awayTeam)
    if (draft.home === '' || draft.away === '') return

    const h = parseInt(draft.home)
    const a = parseInt(draft.away)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return

    // Derive winner from score if not a draw
    let winner = draft.winner
    if (h !== a) {
      winner = h > a ? homeTeam : awayTeam
    }
    if (!winner) return // draw but no winner picked

    setSaving(match.id)
    const { data } = await supabase
      .from('tips')
      .upsert(
        { user_id: user!.id, match_id: match.id, home_tip: h, away_tip: a, winner_tip: winner },
        { onConflict: 'user_id,match_id' },
      )
      .select().single()

    if (data) {
      setTips(prev => new Map(prev).set(match.id, data))
      setDrafts(prev => { const m = new Map(prev); m.delete(match.id); return m })
    }
    setSaving(null)
  }

  const tippedCount = knockoutMatches.filter(m => tips.has(m.id)).length

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar...</div>
  if (knockoutMatches.length === 0) {
    return <div className="text-gray-400 text-center py-12">Slutspelsmatcherna läggs in av admin när grupper är klara.</div>
  }

  const rounds = [...new Set(knockoutMatches.map(m => m.round))]
    .sort((a, b) => KNOCKOUT_ROUNDS.indexOf(a) - KNOCKOUT_ROUNDS.indexOf(b))

  return (
    <div>
      {/* Deadline banner */}
      <div className={`rounded-xl p-4 mb-6 border ${
        knockoutLocked
          ? 'bg-gray-900 border-red-800 text-red-300'
          : 'bg-gray-900 border-cyan-800 text-cyan-300'
      }`}>
        {knockoutLocked ? (
          <p className="font-medium">Slutspelstipsningen är stängd — 16-delsfinalen har börjat.</p>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium">Tippa hela slutspelet innan deadline!</p>
              {knockoutDeadline && (
                <p className="text-sm opacity-75">Stänger: {formatDeadline(knockoutDeadline)}</p>
              )}
            </div>
            <span className="text-sm">{tippedCount}/{knockoutMatches.length} tippade</span>
          </div>
        )}
      </div>

      {rounds.map(round => {
        const roundMatches = knockoutMatches
          .filter(m => m.round === round)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

        return (
          <div key={round} className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">{ROUND_LABEL[round] ?? round}</h2>
            <div className="space-y-3">
              {roundMatches.map(match => {
                const homeTeam = getEffectiveTeam(match, 'home', matchMap, tips)
                const awayTeam = getEffectiveTeam(match, 'away', matchMap, tips)
                const teamsKnown = homeTeam !== '?' && homeTeam !== 'TBD'
                  && awayTeam !== '?' && awayTeam !== 'TBD'

                const savedTip = tips.get(match.id)
                const draft = getDraft(match, homeTeam, awayTeam)
                const isSaving = saving === match.id
                const hasResult = match.home_score !== null && match.away_score !== null

                let pointsEarned: number | null = null
                if (hasResult && savedTip && match.winner_team) {
                  pointsEarned = calcPoints(
                    match.home_score!, match.away_score!, match.winner_team,
                    savedTip.home_tip, savedTip.away_tip, savedTip.winner_tip,
                    true,
                  )
                }

                const draftHome = parseInt(draft.home)
                const draftAway = parseInt(draft.away)
                const isDraw = !isNaN(draftHome) && !isNaN(draftAway) && draftHome === draftAway
                const impliedWinner = (!isNaN(draftHome) && !isNaN(draftAway) && draftHome !== draftAway)
                  ? (draftHome > draftAway ? homeTeam : awayTeam)
                  : null

                const savedOrDraftWinner = impliedWinner ?? draft.winner

                const hasSavedTip = !!savedTip
                const isDirty = !knockoutLocked && teamsKnown && (
                  draft.home !== (savedTip?.home_tip?.toString() ?? '') ||
                  draft.away !== (savedTip?.away_tip?.toString() ?? '') ||
                  savedOrDraftWinner !== (savedTip?.winner_tip ?? '')
                )

                return (
                  <div key={match.id} className={`bg-gray-900 rounded-xl p-4 border ${
                    !teamsKnown ? 'border-gray-700 opacity-60' : 'border-gray-700'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">
                        {new Date(match.starts_at).toLocaleString('sv-SE', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {pointsEarned !== null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            pointsEarned === 30 ? 'bg-amber-600 text-amber-100' :
                            pointsEarned > 0 ? 'bg-cyan-800 text-cyan-200' :
                            'bg-red-900 text-red-300'
                          }`}>{pointsEarned}p</span>
                        )}
                        {!teamsKnown && (
                          <span className="text-xs text-gray-500">Fyll i tidigare rundor först</span>
                        )}
                      </div>
                    </div>

                    {/* Lag */}
                    <div className="flex justify-between mb-2">
                      <span className={`font-medium flex items-center gap-1.5 ${teamsKnown ? 'text-white' : 'text-gray-500'}`}><Flag name={homeTeam} />{homeTeam}</span>
                      <span className={`font-medium flex items-center gap-1.5 ${teamsKnown ? 'text-white' : 'text-gray-500'}`}>{awayTeam}<Flag name={awayTeam} /></span>
                    </div>

                    {/* Resultat + tips */}
                    <div className="flex items-center justify-center gap-3 mb-3">
                      {hasResult && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Resultat</div>
                          <span className="text-lg font-bold text-white tabular-nums">
                            {match.home_score}–{match.away_score}
                          </span>
                          {match.winner_team && (
                            <div className="text-xs text-green-400 mt-0.5">{match.winner_team} vidare</div>
                          )}
                        </div>
                      )}

                      {!knockoutLocked && teamsKnown ? (
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" pattern="[0-9]*"
                            value={draft.home}
                            onChange={e => updateDraft(match.id, 'home', e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="–"
                            className="w-14 bg-gray-800 text-white text-center rounded px-1 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none tabular-nums text-lg"
                          />
                          <span className="text-gray-500 font-bold">–</span>
                          <input type="text" inputMode="numeric" pattern="[0-9]*"
                            value={draft.away}
                            onChange={e => updateDraft(match.id, 'away', e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="–"
                            className="w-14 bg-gray-800 text-white text-center rounded px-1 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none tabular-nums text-lg"
                          />
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
                      ) : null}
                    </div>

                    {/* Winner picker */}
                    {!knockoutLocked && teamsKnown && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500 shrink-0">Vinnare:</span>
                        {[homeTeam, awayTeam].map(team => {
                          const isSelected = savedOrDraftWinner === team
                          const isImplied = impliedWinner === team
                          return (
                            <button
                              key={team}
                              onClick={() => updateDraft(match.id, 'winner', team)}
                              disabled={!!impliedWinner}
                              className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors truncate px-2 ${
                                isSelected && !isDraw
                                  ? 'bg-cyan-700 text-white'
                                  : 'bg-gray-800 text-gray-400 hover:text-white'
                              } ${isImplied ? 'opacity-70 cursor-default' : ''}`}
                            >
                              {team}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Locked: show saved winner */}
                    {(knockoutLocked || !teamsKnown) && savedTip?.winner_tip && (
                      <div className="mt-2 text-xs text-gray-500">
                        Vinnartips: <span className={`font-medium ${
                          hasResult && match.winner_team === savedTip.winner_tip ? 'text-green-400' :
                          hasResult ? 'text-red-400' : 'text-gray-300'
                        }`}>{savedTip.winner_tip}</span>
                      </div>
                    )}

                    {/* Save button */}
                    {!knockoutLocked && teamsKnown && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => saveTip(match, homeTeam, awayTeam)}
                          disabled={isSaving || (!isDirty && hasSavedTip) || (isDraw && !draft.winner)}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                            isDirty
                              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                              : hasSavedTip
                              ? 'bg-gray-700 text-gray-400 cursor-default'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          } disabled:opacity-50`}
                        >
                          {isSaving ? '...' : hasSavedTip && !isDirty ? 'Sparat' : 'Spara'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-gray-600 text-xs mt-4 text-center">
        Exakt = 30p &nbsp;·&nbsp; Rätt vinnare + utfall = 10–19p &nbsp;·&nbsp; Rätt vinnare = 5p &nbsp;·&nbsp; Fel = 0p
      </p>
    </div>
  )
}
