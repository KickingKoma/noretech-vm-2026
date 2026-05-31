import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcPoints, getEffectiveTeam, KNOCKOUT_ROUNDS, GROUP_ROUNDS, ROUND_LABEL } from '../types'
import type { Match, UserTip, Profile } from '../types'
import { Flag } from '../components/Flag'

export function PlayerPage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())
  const [activeRound, setActiveRound] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const [{ data: profileData }, { data: matchData }, { data: tipData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('matches').select('*').order('starts_at'),
        supabase.from('tips').select('*').eq('user_id', userId),
      ])
      if (profileData) setProfile(profileData)
      if (matchData) {
        setAllMatches(matchData)
        const rounds = [...new Set(
          matchData
            .filter((m: Match) => GROUP_ROUNDS.includes(m.round))
            .map((m: Match) => m.round),
        )].sort((a: string, b: string) => GROUP_ROUNDS.indexOf(a) - GROUP_ROUNDS.indexOf(b))
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
  }, [userId])

  const matchMap = useMemo(() => new Map(allMatches.map(m => [m.id, m])), [allMatches])
  const groupMatches = useMemo(() => allMatches.filter(m => GROUP_ROUNDS.includes(m.round)), [allMatches])
  const knockoutMatches = useMemo(() => allMatches.filter(m => KNOCKOUT_ROUNDS.includes(m.round)), [allMatches])

  const groupRounds = [...new Set(groupMatches.map(m => m.round))]
    .sort((a, b) => GROUP_ROUNDS.indexOf(a) - GROUP_ROUNDS.indexOf(b))
  const knockoutRounds = [...new Set(knockoutMatches.map(m => m.round))]
    .sort((a, b) => KNOCKOUT_ROUNDS.indexOf(a) - KNOCKOUT_ROUNDS.indexOf(b))

  const totalPoints = useMemo(() => {
    let pts = 0
    for (const [matchId, tip] of tips) {
      const match = matchMap.get(matchId)
      if (!match || match.home_score === null || match.away_score === null) continue
      pts += calcPoints(
        match.home_score, match.away_score, match.winner_team,
        tip.home_tip, tip.away_tip, tip.winner_tip,
        KNOCKOUT_ROUNDS.includes(match.round),
      )
    }
    return pts
  }, [tips, matchMap])

  function renderMatch(match: Match, isKnockout: boolean) {
    const homeTeam = isKnockout
      ? getEffectiveTeam(match, 'home', matchMap, tips)
      : (match.home_team ?? '?')
    const awayTeam = isKnockout
      ? getEffectiveTeam(match, 'away', matchMap, tips)
      : (match.away_team ?? '?')
    const tip = tips.get(match.id)
    const hasResult = match.home_score !== null && match.away_score !== null

    let pts: number | null = null
    if (hasResult && tip) {
      pts = calcPoints(
        match.home_score!, match.away_score!, match.winner_team,
        tip.home_tip, tip.away_tip, tip.winner_tip,
        isKnockout,
      )
    }

    return (
      <div key={match.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">
            {new Date(match.starts_at).toLocaleString('sv-SE', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {pts !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              pts === 30 ? 'bg-amber-600 text-amber-100' :
              pts > 0 ? 'bg-cyan-800 text-cyan-200' :
              'bg-red-900 text-red-300'
            }`}>{pts}p</span>
          )}
        </div>

        <div className="flex justify-between mb-3">
          <span className="font-medium text-white flex items-center gap-1.5"><Flag name={homeTeam} />{homeTeam}</span>
          <span className="font-medium text-white flex items-center gap-1.5">{awayTeam}<Flag name={awayTeam} /></span>
        </div>

        <div className="flex items-center justify-center gap-6">
          {hasResult && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Resultat</div>
              <span className="text-lg font-bold text-white tabular-nums">
                {match.home_score}–{match.away_score}
              </span>
              {isKnockout && match.winner_team && (
                <div className="text-xs text-green-400 mt-0.5">{match.winner_team} vidare</div>
              )}
            </div>
          )}
          {tip ? (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Tips</div>
              <span className={`text-lg font-bold tabular-nums ${
                pts === 30 ? 'text-amber-400' :
                pts !== null && pts > 0 ? 'text-cyan-400' :
                pts === 0 ? 'text-red-400' :
                'text-gray-300'
              }`}>
                {tip.home_tip}–{tip.away_tip}
              </span>
              {isKnockout && tip.winner_tip && (
                <div className={`text-xs mt-0.5 ${
                  hasResult && match.winner_team === tip.winner_tip ? 'text-green-400' :
                  hasResult ? 'text-red-400' : 'text-gray-400'
                }`}>{tip.winner_tip} vidare</div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-600 italic">Ej tippat</span>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar...</div>
  if (!profile) return <div className="text-gray-400 text-center py-12">Spelare hittades inte.</div>

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/leaderboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-1 block">
            ← Topplista
          </Link>
          <h1 className="text-2xl font-bold text-white">{profile.display_name}</h1>
        </div>
        {tips.size > 0 && (
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">Totalt</div>
            <div className="text-3xl font-bold text-amber-400">{totalPoints}p</div>
          </div>
        )}
      </div>

      {tips.size === 0 && (
        <div className="text-gray-500 text-center py-12 text-sm">
          Tipsen visas efter att tipsningsdeadline passerat.
        </div>
      )}

      {tips.size > 0 && groupRounds.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">Gruppspel</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {groupRounds.map(round => (
              <button
                key={round}
                onClick={() => setActiveRound(round)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeRound === round
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                }`}
              >
                {ROUND_LABEL[round] ?? round}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {groupMatches
              .filter(m => m.round === activeRound)
              .map(m => renderMatch(m, false))}
          </div>
        </div>
      )}

      {tips.size > 0 && knockoutRounds.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Slutspel</h2>
          {knockoutRounds.map(round => (
            <div key={round} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">{ROUND_LABEL[round] ?? round}</h3>
              <div className="space-y-3">
                {knockoutMatches
                  .filter(m => m.round === round)
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                  .map(m => renderMatch(m, true))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
