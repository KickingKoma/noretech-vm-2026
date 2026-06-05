import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calcPoints, KNOCKOUT_ROUNDS } from '../types'
import type { Match, UserTip, Profile, TournamentPrediction } from '../types'

type Trend = 'up' | 'down' | 'same' | 'none'

interface Entry {
  userId: string
  displayName: string
  points: number
  exact: number
  outcome: number
  tipped: number
  top3: number
  trend: Trend
}

function buildPositionMap(
  profiles: Profile[],
  tips: UserTip[],
  matches: Match[],
  predictions: TournamentPrediction[] | null,
): Map<string, number> {
  const matchMap = new Map<string, Match>(matches.map(m => [m.id, m]))

  const finalMatch = matches.find(m => m.round === 'final' && m.winner_team)
  const thirdMatch = matches.find(m => m.round === '3rd' && m.winner_team)
  const actualFirst = finalMatch?.winner_team ?? null
  const actualSecond = finalMatch
    ? (finalMatch.winner_team === finalMatch.home_team ? finalMatch.away_team : finalMatch.home_team)
    : null
  const actualThird = thirdMatch?.winner_team ?? null

  const scored = profiles.map(profile => {
    const userTips = tips.filter(t => t.user_id === profile.id)
    let points = 0, exact = 0, outcome = 0

    for (const tip of userTips) {
      const match = matchMap.get(tip.match_id)
      if (!match || match.home_score === null || match.away_score === null) continue
      const isKnockout = KNOCKOUT_ROUNDS.includes(match.round)
      const p = calcPoints(
        match.home_score, match.away_score, match.winner_team,
        tip.home_tip, tip.away_tip, tip.winner_tip,
        isKnockout,
      )
      points += p
      if (!isKnockout && p === 30) exact++
      else if (p > 0) outcome++
    }

    const pred = predictions?.find(p => p.user_id === profile.id)
    if (pred) {
      if (actualFirst && pred.first_place === actualFirst) points += 200
      if (actualSecond && pred.second_place === actualSecond) points += 100
      if (actualThird && pred.third_place === actualThird) points += 50
    }

    return { userId: profile.id, points, exact, outcome }
  })

  scored.sort((a, b) => b.points - a.points || b.exact - a.exact || b.outcome - a.outcome)

  const posMap = new Map<string, number>()
  scored.forEach((e, i) => {
    const prev = scored[i - 1]
    const rank = i === 0 || e.points !== prev.points || e.exact !== prev.exact || e.outcome !== prev.outcome
      ? i + 1
      : posMap.get(prev.userId)!
    posMap.set(e.userId, rank)
  })

  return posMap
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: tips }, { data: matches }, { data: predictions }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('tips').select('*'),
        supabase.from('matches').select('*').eq('status', 'FINISHED'),
        supabase.from('tournament_predictions').select('*'),
      ])

      if (!profiles || !tips || !matches) {
        setLoading(false)
        return
      }

      const matchMap = new Map<string, Match>(matches.map((m: Match) => [m.id, m]))

      const finalMatch = matches.find((m: Match) => m.round === 'final' && m.winner_team)
      const thirdMatch = matches.find((m: Match) => m.round === '3rd' && m.winner_team)
      const actualFirst = finalMatch?.winner_team ?? null
      const actualSecond = finalMatch
        ? (finalMatch.winner_team === finalMatch.home_team ? finalMatch.away_team : finalMatch.home_team)
        : null
      const actualThird = thirdMatch?.winner_team ?? null

      // Find latest starts_at among scored matches and build "previous" snapshot without them
      const latestTime = matches.reduce((max: string, m: Match) => m.starts_at > max ? m.starts_at : max, '')
      const previousMatches = matches.filter((m: Match) => m.starts_at < latestTime)
      const currentPositions = matches.length > 0 ? buildPositionMap(profiles, tips, matches, predictions) : null
      const previousPositions = previousMatches.length > 0 ? buildPositionMap(profiles, tips, previousMatches, predictions) : null

      const result: Entry[] = profiles.map((profile: Profile) => {
        const userTips = tips.filter((t: UserTip) => t.user_id === profile.id)
        let points = 0, exact = 0, outcome = 0, tipped = 0

        for (const tip of userTips) {
          const match = matchMap.get(tip.match_id)
          if (!match || match.home_score === null || match.away_score === null) continue
          tipped++
          const isKnockout = KNOCKOUT_ROUNDS.includes(match.round)
          const p = calcPoints(
            match.home_score, match.away_score, match.winner_team,
            tip.home_tip, tip.away_tip, tip.winner_tip,
            isKnockout,
          )
          points += p
          if (!isKnockout && p === 30) exact++
          else if (p > 0) outcome++
        }

        const pred = predictions?.find((p: TournamentPrediction) => p.user_id === profile.id)
        let top3 = 0
        if (pred) {
          if (actualFirst && pred.first_place === actualFirst) top3 += 200
          if (actualSecond && pred.second_place === actualSecond) top3 += 100
          if (actualThird && pred.third_place === actualThird) top3 += 50
        }
        points += top3

        const curPos = currentPositions?.get(profile.id)
        const prevPos = previousPositions?.get(profile.id)
        let trend: Trend = 'none'
        if (curPos !== undefined && prevPos !== undefined) {
          trend = curPos < prevPos ? 'up' : curPos > prevPos ? 'down' : 'same'
        }

        return { userId: profile.id, displayName: profile.display_name, points, exact, outcome, tipped, top3, trend }
      })

      result.sort((a, b) => b.points - a.points || b.exact - a.exact || b.outcome - a.outcome)
      setEntries(result)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar topplista...</div>

  if (entries.length === 0) {
    return <div className="text-gray-400 text-center py-12">Inga deltagare än.</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Topplista</h2>
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="text-left px-4 py-3 w-8">#</th>
              <th className="text-left px-4 py-3">Spelare</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell" title="Exakt rätt resultat (gruppspel)">Exakt</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell" title="Rätt utfall (gruppspel) eller rätt lag vidare (slutspel)">Utfall</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell" title="Topp 3-tippning: 200p/100p/50p">Topp 3</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Tippade</th>
              <th className="text-right px-4 py-3 text-amber-400 font-bold">Poäng</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isMe = entry.userId === user?.id
              return (
                <tr
                  key={entry.userId}
                  className={`border-b border-gray-700/40 last:border-0 ${isMe ? 'bg-cyan-900/20' : ''}`}
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                      {entry.trend === 'up' && <span className="text-green-400 text-xs">▲</span>}
                      {entry.trend === 'down' && <span className="text-red-400 text-xs">▼</span>}
                      {entry.trend === 'same' && <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/player/${entry.userId}`}
                      className="text-white hover:text-cyan-400 transition-colors"
                    >
                      {entry.displayName}
                    </Link>
                    {isMe && <span className="text-xs text-gray-500 ml-2">(du)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">{entry.exact}</td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">{entry.outcome}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className={entry.top3 > 0 ? 'text-purple-400 font-medium' : 'text-gray-600'}>
                      {entry.top3 > 0 ? `+${entry.top3}` : '–'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{entry.tipped}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-bold text-lg">{entry.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 text-xs mt-2 text-right">
        Exakt = 30p &nbsp;·&nbsp; Utfall = 10–19p / rätt lag vidare &nbsp;·&nbsp; Topp 3 = 200/100/50p
      </p>
    </div>
  )
}
