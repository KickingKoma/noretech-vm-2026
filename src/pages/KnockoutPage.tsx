import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeadlines } from '../hooks/useDeadlines'
import { getEffectiveTeam, KNOCKOUT_ROUNDS, ROUND_LABEL } from '../types'
import type { Match, UserTip } from '../types'
import { Flag } from '../components/Flag'
import { QualificationSection } from '../components/QualificationSection'

function formatDeadline(d: Date): string {
  return d.toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface DraftTip {
  winner: string
}

export function KnockoutPage() {
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, DraftTip>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { nextKnockoutDeadline, allKnockoutLocked, isRoundLocked, roundDeadlines } = useDeadlines(allMatches)

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

  const getDraft = (match: Match): DraftTip => {
    if (drafts.has(match.id)) return drafts.get(match.id)!
    const saved = tips.get(match.id)
    return { winner: saved?.winner_tip ?? '' }
  }

  const updateDraft = (matchId: string, winner: string) => {
    setDrafts(prev => new Map(prev).set(matchId, { winner }))
  }

  const saveTip = async (match: Match) => {
    if (isRoundLocked(match.round)) return
    const draft = getDraft(match)
    if (!draft.winner) return

    setSaving(match.id)
    const { data } = await supabase
      .from('tips')
      .upsert(
        { user_id: user!.id, match_id: match.id, home_tip: 0, away_tip: 0, winner_tip: draft.winner },
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
  const openMatches = knockoutMatches.filter(m => !isRoundLocked(m.round)).length

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar...</div>

  const rounds = [...new Set(knockoutMatches.map(m => m.round))]
    .sort((a, b) => KNOCKOUT_ROUNDS.indexOf(a) - KNOCKOUT_ROUNDS.indexOf(b))

  return (
    <div>
      <QualificationSection allMatches={allMatches} tips={tips} />

      {knockoutMatches.length === 0 ? (
        <div className="text-gray-400 text-center py-12">Slutspelsmatcherna dyker upp när gruppspelet är klart.</div>
      ) : (
      <>
      {/* Deadline banner */}
      <div className={`rounded-xl p-4 mb-6 border ${
        allKnockoutLocked
          ? 'bg-gray-900 border-red-800 text-red-300'
          : 'bg-gray-900 border-cyan-800 text-cyan-300'
      }`}>
        {allKnockoutLocked ? (
          <p className="font-medium">Slutspelstipsningen är stängd.</p>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium">Tippa slutspelet — varje omgång låser sig separat!</p>
              {nextKnockoutDeadline && (
                <p className="text-sm opacity-75">Nästa deadline: {formatDeadline(nextKnockoutDeadline)}</p>
              )}
            </div>
            <span className="text-sm">{tippedCount}/{openMatches} öppna tippade</span>
          </div>
        )}
      </div>

      {rounds.map(round => {
        const roundMatches = knockoutMatches
          .filter(m => m.round === round)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

        return (
          <div key={round} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">{ROUND_LABEL[round] ?? round}</h2>
              {isRoundLocked(round) ? (
                <span className="text-xs text-red-400">🔒 Stängd</span>
              ) : roundDeadlines.get(round) ? (
                <span className="text-xs text-gray-500">Stänger: {formatDeadline(roundDeadlines.get(round)!)}</span>
              ) : null}
            </div>
            <div className="space-y-3">
              {roundMatches.map(match => {
                const homeTeam = getEffectiveTeam(match, 'home', matchMap, tips)
                const awayTeam = getEffectiveTeam(match, 'away', matchMap, tips)
                const isTBD = homeTeam === 'TBD' || awayTeam === 'TBD'
                const needsTip = homeTeam === '?' || awayTeam === '?'
                const teamsKnown = !isTBD && !needsTip

                const savedTip = tips.get(match.id)
                const draft = getDraft(match)
                const isSaving = saving === match.id
                const hasResult = match.winner_team !== null

                let pointsEarned: number | null = null
                if (hasResult && savedTip?.winner_tip) {
                  pointsEarned = savedTip.winner_tip === match.winner_team ? 30 : 0
                }

                const roundLocked = isRoundLocked(match.round)
                const hasSavedTip = !!savedTip
                const isDirty = !roundLocked && teamsKnown &&
                  draft.winner !== (savedTip?.winner_tip ?? '')

                return (
                  <div key={match.id} className={`bg-gray-900 rounded-xl p-4 border ${
                    needsTip ? 'border-gray-800 opacity-50' : 'border-gray-700'
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
                            pointsEarned === 30 ? 'bg-amber-600 text-amber-100' : 'bg-red-900 text-red-300'
                          }`}>{pointsEarned}p</span>
                        )}
                        {needsTip && (
                          <span className="text-xs text-gray-600">Tippa tidigare omgång</span>
                        )}
                      </div>
                    </div>

                    {/* Lag */}
                    <div className="flex justify-between mb-3">
                      <span className={`font-medium flex items-center gap-1.5 ${teamsKnown ? 'text-white' : isTBD ? 'text-gray-500 italic' : 'text-gray-600'}`}>
                        <Flag name={homeTeam} />{isTBD ? 'TBD' : homeTeam}
                      </span>
                      <span className="text-gray-600 self-center text-sm">vs</span>
                      <span className={`font-medium flex items-center gap-1.5 ${teamsKnown ? 'text-white' : isTBD ? 'text-gray-500 italic' : 'text-gray-600'}`}>
                        {isTBD ? 'TBD' : awayTeam}<Flag name={awayTeam} />
                      </span>
                    </div>

                    {/* Faktiskt resultat */}
                    {hasResult && (
                      <div className="text-center mb-3">
                        <div className="text-xs text-gray-500 mb-1">Resultat</div>
                        <span className="text-lg font-bold text-white tabular-nums">
                          {match.home_score}–{match.away_score}
                        </span>
                        <div className="text-xs text-green-400 mt-0.5">{match.winner_team} vidare</div>
                      </div>
                    )}

                    {/* Vinnarpick — öppen */}
                    {!roundLocked && teamsKnown && (
                      <div className="flex gap-2">
                        {[homeTeam, awayTeam].map(team => (
                          <button
                            key={team}
                            onClick={() => updateDraft(match.id, team)}
                            className={`flex-1 py-2 rounded text-sm font-medium transition-colors truncate px-2 flex items-center justify-center gap-1.5 ${
                              draft.winner === team
                                ? 'bg-cyan-700 text-white'
                                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                          >
                            <Flag name={team} />{team}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sparat vinnartips — låst eller ej kända lag */}
                    {(roundLocked || !teamsKnown) && savedTip?.winner_tip && (
                      <div className={`text-center py-1.5 rounded text-sm font-medium flex items-center justify-center gap-1.5 ${
                        hasResult && match.winner_team === savedTip.winner_tip ? 'text-green-400' :
                        hasResult ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        <Flag name={savedTip.winner_tip} />{savedTip.winner_tip} vidare
                      </div>
                    )}

                    {/* Ej tippat — låst */}
                    {(roundLocked || !teamsKnown) && !savedTip && teamsKnown && (
                      <div className="text-center text-xs text-gray-600 italic">Ej tippat</div>
                    )}

                    {/* Save button */}
                    {!roundLocked && teamsKnown && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => saveTip(match)}
                          disabled={isSaving || !draft.winner || (!isDirty && hasSavedTip)}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                            isDirty || (!hasSavedTip && draft.winner)
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
        Rätt lag går vidare = 30p &nbsp;·&nbsp; Fel = 0p
      </p>
      </>
      )}
    </div>
  )
}
