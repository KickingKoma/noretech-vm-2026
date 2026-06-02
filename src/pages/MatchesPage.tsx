import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeadlines } from '../hooks/useDeadlines'
import { calcPoints, GROUP_ROUNDS, ROUND_LABEL } from '../types'
import type { Match, UserTip, TournamentPrediction } from '../types'
import { Flag } from '../components/Flag'

interface DraftTip { home: string; away: string }

interface Standing {
  team: string
  s: number
  v: number
  o: number
  f: number
  diff: number
  pts: number
}

function computeStandings(
  matches: Match[],
  getScore: (m: Match) => { home: number; away: number } | null,
): Standing[] {
  const map = new Map<string, Standing>()
  for (const m of matches) {
    if (m.home_team && !map.has(m.home_team))
      map.set(m.home_team, { team: m.home_team, s: 0, v: 0, o: 0, f: 0, diff: 0, pts: 0 })
    if (m.away_team && !map.has(m.away_team))
      map.set(m.away_team, { team: m.away_team, s: 0, v: 0, o: 0, f: 0, diff: 0, pts: 0 })
  }
  for (const match of matches) {
    if (!match.home_team || !match.away_team) continue
    const score = getScore(match)
    if (!score) continue
    const home = map.get(match.home_team)!
    const away = map.get(match.away_team)!
    home.s++; away.s++
    home.diff += score.home - score.away
    away.diff += score.away - score.home
    if (score.home > score.away) {
      home.v++; home.pts += 3; away.f++
    } else if (score.home < score.away) {
      away.v++; away.pts += 3; home.f++
    } else {
      home.o++; home.pts++; away.o++; away.pts++
    }
  }
  return [...map.values()].sort((a, b) =>
    b.pts - a.pts || b.diff - a.diff || a.team.localeCompare(b.team),
  )
}

function StandingsTable({ standings, title }: { standings: Standing[]; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-600 border-b border-gray-800">
            <th className="text-left font-normal pb-1.5 w-5">#</th>
            <th className="text-left font-normal pb-1.5">Lag</th>
            <th className="text-center font-normal pb-1.5 w-7">S</th>
            <th className="text-center font-normal pb-1.5 w-7">V</th>
            <th className="text-center font-normal pb-1.5 w-7">O</th>
            <th className="text-center font-normal pb-1.5 w-7">F</th>
            <th className="text-center font-normal pb-1.5 w-8">+/-</th>
            <th className="text-center font-normal pb-1.5 w-7">P</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {standings.map((s, i) => (
            <tr key={s.team} className={i < 2 ? 'text-white' : 'text-gray-500'}>
              <td className="py-1.5 text-gray-600 text-xs">{i + 1}</td>
              <td className="py-1.5">
                <span className="flex items-center gap-1.5">
                  <Flag name={s.team} />
                  <span className="truncate">{s.team}</span>
                </span>
              </td>
              <td className="py-1.5 text-center tabular-nums">{s.s}</td>
              <td className="py-1.5 text-center tabular-nums">{s.v}</td>
              <td className="py-1.5 text-center tabular-nums">{s.o}</td>
              <td className="py-1.5 text-center tabular-nums">{s.f}</td>
              <td className="py-1.5 text-center tabular-nums">{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
              <td className="py-1.5 text-center tabular-nums font-bold">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Topp3ViewProps {
  allTeams: string[]
  prediction: TournamentPrediction | null
  groupLocked: boolean
  allMatches: Match[]
  onSave: (first: string, second: string, third: string) => Promise<void>
  saving: boolean
}

function Topp3View({ allTeams, prediction, groupLocked, allMatches, onSave, saving }: Topp3ViewProps) {
  const [draft, setDraft] = useState({
    first: prediction?.first_place ?? '',
    second: prediction?.second_place ?? '',
    third: prediction?.third_place ?? '',
  })

  const finalMatch = allMatches.find(m => m.round === 'final')
  const bronzeMatch = allMatches.find(m => m.round === '3rd')

  const actual: Record<'first' | 'second' | 'third', string | null> = {
    first: finalMatch?.winner_team ?? null,
    second: finalMatch?.winner_team
      ? (finalMatch.winner_team === finalMatch.home_team ? finalMatch.away_team : finalMatch.home_team) ?? null
      : null,
    third: bronzeMatch?.winner_team ?? null,
  }

  const saved: Record<'first' | 'second' | 'third', string> = {
    first: prediction?.first_place ?? '',
    second: prediction?.second_place ?? '',
    third: prediction?.third_place ?? '',
  }

  const resultsKnown = !!(actual.first && actual.second && actual.third)

  const totalPts = resultsKnown && prediction
    ? (['first', 'second', 'third'] as const).reduce((sum, pos) => {
        const maxPts = pos === 'first' ? 50 : pos === 'second' ? 30 : 20
        return sum + (saved[pos] && saved[pos] === actual[pos] ? maxPts : 0)
      }, 0)
    : null

  const isDirty = !groupLocked && (
    draft.first !== saved.first || draft.second !== saved.second || draft.third !== saved.third
  )
  const canSave = !!(
    draft.first && draft.second && draft.third &&
    draft.first !== draft.second && draft.first !== draft.third && draft.second !== draft.third
  )

  const positions: { pos: 'first' | 'second' | 'third'; label: string; maxPts: number }[] = [
    { pos: 'first', label: 'Vinnare', maxPts: 50 },
    { pos: 'second', label: 'Tvåa', maxPts: 30 },
    { pos: 'third', label: 'Trea', maxPts: 20 },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        {resultsKnown && totalPts !== null && (
          <div className="flex justify-end mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              totalPts > 0 ? 'bg-cyan-800 text-cyan-200' : 'bg-red-900 text-red-300'
            }`}>{totalPts}p</span>
          </div>
        )}

        <div className="space-y-4">
          {positions.map(({ pos, label, maxPts }) => {
            const isCorrect = !!(actual[pos] && saved[pos] && saved[pos] === actual[pos])
            const isWrong = !!(actual[pos] && saved[pos] && saved[pos] !== actual[pos])
            return (
              <div key={pos}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-400">
                    {label} <span className="text-gray-600 text-xs">({maxPts}p)</span>
                  </span>
                  {actual[pos] && (
                    <span className="text-xs text-gray-500">
                      Verklig: <span className="text-white">{actual[pos]}</span>
                    </span>
                  )}
                </div>
                {!groupLocked ? (
                  <select
                    value={draft[pos]}
                    onChange={e => setDraft(prev => ({ ...prev, [pos]: e.target.value }))}
                    className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:border-cyan-500 focus:outline-none text-sm"
                  >
                    <option value="">— Välj lag —</option>
                    {allTeams.map(team => (
                      <option
                        key={team}
                        value={team}
                        disabled={
                          (pos !== 'first' && draft.first === team) ||
                          (pos !== 'second' && draft.second === team) ||
                          (pos !== 'third' && draft.third === team)
                        }
                      >
                        {team}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={`px-3 py-2 rounded border text-sm font-medium flex items-center gap-1.5 ${
                    isCorrect ? 'border-green-700 bg-green-900/20 text-green-400' :
                    isWrong ? 'border-red-800 bg-red-900/20 text-red-400' :
                    'border-gray-700 bg-gray-800 text-gray-300'
                  }`}>
                    {saved[pos]
                      ? <><Flag name={saved[pos]} />{saved[pos]}</>
                      : <span className="text-gray-600 italic">Ej tippat</span>
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!groupLocked && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => onSave(draft.first, draft.second, draft.third)}
              disabled={saving || !isDirty || !canSave}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                isDirty && canSave
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : prediction ? 'bg-gray-700 text-gray-400 cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              } disabled:opacity-50`}
            >
              {saving ? '...' : prediction && !isDirty ? 'Sparat' : 'Spara'}
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-xs text-center">
        Vinnare rätt = 50p &nbsp;·&nbsp; Tvåa rätt = 30p &nbsp;·&nbsp; Trea rätt = 20p
      </p>
    </div>
  )
}

export function MatchesPage() {
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, DraftTip>>(new Map())
  const [activeRound, setActiveRound] = useState('topp3')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [slumping, setSlumping] = useState(false)
  const [prediction, setPrediction] = useState<TournamentPrediction | null>(null)
  const [predSaving, setPredSaving] = useState(false)

  const { groupLocked } = useDeadlines(allMatches)

  const groupMatches = allMatches.filter(m => GROUP_ROUNDS.includes(m.round))

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: matchData }, { data: tipData }, { data: predData }] = await Promise.all([
        supabase.from('matches').select('*').order('starts_at'),
        supabase.from('tips').select('*').eq('user_id', user!.id),
        supabase.from('tournament_predictions').select('*').eq('user_id', user!.id).maybeSingle(),
      ])

      if (matchData) {
        setAllMatches(matchData)
        // activeRound behåller sitt defaultvärde 'topp3'
      }

      if (tipData) {
        const map = new Map<string, UserTip>()
        tipData.forEach((t: UserTip) => map.set(t.match_id, t))
        setTips(map)
      }

      if (predData) setPrediction(predData)

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

  const deleteTip = async (matchId: string) => {
    setSaving(matchId)
    await supabase.from('tips').delete().eq('user_id', user!.id).eq('match_id', matchId)
    setTips(prev => { const m = new Map(prev); m.delete(matchId); return m })
    setDrafts(prev => { const m = new Map(prev); m.delete(matchId); return m })
    setSaving(null)
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

  const slumpaTips = async () => {
    if (groupLocked || slumping) return
    const untipped = activeGroupMatches.filter(m => !tips.has(m.id))
    if (untipped.length === 0) return

    setSlumping(true)
    const newTips = untipped.map(m => ({
      user_id: user!.id,
      match_id: m.id,
      home_tip: Math.floor(Math.random() * 6),
      away_tip: Math.floor(Math.random() * 6),
      winner_tip: null,
    }))

    const { data } = await supabase
      .from('tips')
      .upsert(newTips, { onConflict: 'user_id,match_id' })
      .select()

    if (data) {
      setTips(prev => {
        const m = new Map(prev)
        data.forEach((t: UserTip) => m.set(t.match_id, t))
        return m
      })
      setDrafts(prev => {
        const m = new Map(prev)
        untipped.forEach(match => m.delete(match.id))
        return m
      })
    }
    setSlumping(false)
  }

  const savePrediction = async (first: string, second: string, third: string) => {
    if (groupLocked || !first || !second || !third) return
    setPredSaving(true)
    const { data } = await supabase
      .from('tournament_predictions')
      .upsert(
        { user_id: user!.id, first_place: first, second_place: second, third_place: third },
        { onConflict: 'user_id' },
      )
      .select().single()
    if (data) setPrediction(data)
    setPredSaving(false)
  }

  const allTeams = [...new Set(
    groupMatches.flatMap(m => [m.home_team, m.away_team].filter(Boolean) as string[])
  )].sort((a, b) => a.localeCompare(b, 'sv'))

  const rounds = [...new Set(groupMatches.map(m => m.round))]
    .sort((a, b) => GROUP_ROUNDS.indexOf(a) - GROUP_ROUNDS.indexOf(b))

  const activeGroupMatches = groupMatches.filter(m => m.round === activeRound)

  const tipStandings = computeStandings(activeGroupMatches, m => {
    const tip = tips.get(m.id)
    return tip ? { home: tip.home_tip, away: tip.away_tip } : null
  })

  const realStandings = computeStandings(activeGroupMatches, m =>
    m.home_score !== null && m.away_score !== null
      ? { home: m.home_score, away: m.away_score }
      : null,
  )

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar...</div>
  if (groupMatches.length === 0) return <div className="text-gray-400 text-center py-12">Inga gruppspelsmatcher inlagda än.</div>

  return (
    <div>
      {/* Round tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['topp3', ...rounds].map(round => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeRound === round
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
                }`}
              >
                {round === 'topp3' ? 'Topp 3' : (ROUND_LABEL[round] ?? round)}
              </button>
            ))}
          </div>

      {activeRound === 'topp3' ? (
        <Topp3View
          allTeams={allTeams}
          prediction={prediction}
          groupLocked={groupLocked}
          allMatches={allMatches}
          onSave={savePrediction}
          saving={predSaving}
        />
      ) : (<>

      {/* Grupptabeller */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <StandingsTable standings={tipStandings} title="Din tippning" />
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <StandingsTable standings={realStandings} title="Verklig tabell" />
        </div>
      </div>

      {/* Slumpa-knapp */}
      {!groupLocked && activeGroupMatches.some(m => !tips.has(m.id)) && (
        <div className="flex justify-end mb-3">
          <button
            onClick={slumpaTips}
            disabled={slumping}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {slumping ? '...' : 'Slumpa resultat'}
          </button>
        </div>
      )}

      {/* Match list */}
      <div className="space-y-3">
        {activeGroupMatches.map(match => {
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
                      {savedTip && (
                        <button
                          onClick={() => deleteTip(match.id)}
                          disabled={isSaving}
                          title="Återställ tips"
                          className="text-gray-600 hover:text-red-400 text-xs px-1 transition-colors disabled:opacity-50"
                        >
                          ✕
                        </button>
                      )}
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
      </>)}
    </div>
  )
}
