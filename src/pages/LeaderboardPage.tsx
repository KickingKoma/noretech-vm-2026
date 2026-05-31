import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calcPoints, KNOCKOUT_ROUNDS } from '../types'
import type { Match, UserTip, Profile } from '../types'

interface Entry {
  userId: string
  displayName: string
  points: number
  exact: number
  outcome: number
  tipped: number
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: tips }, { data: matches }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('tips').select('*'),
        supabase.from('matches').select('*').not('home_score', 'is', null),
      ])

      if (!profiles || !tips || !matches) return

      const matchMap = new Map<string, Match>(matches.map((m: Match) => [m.id, m]))

      const result: Entry[] = profiles.map((profile: Profile) => {
        const userTips = tips.filter((t: UserTip) => t.user_id === profile.id)
        let points = 0, exact = 0, outcome = 0, tipped = 0

        for (const tip of userTips) {
          const match = matchMap.get(tip.match_id)
          if (!match || match.home_score === null || match.away_score === null) continue
          tipped++
          const p = calcPoints(
            match.home_score, match.away_score, match.winner_team,
            tip.home_tip, tip.away_tip, tip.winner_tip,
            KNOCKOUT_ROUNDS.includes(match.round),
          )
          points += p
          if (p === 30) exact++
          else if (p > 0) outcome++
        }

        return { userId: profile.id, displayName: profile.display_name, points, exact, outcome, tipped }
      })

      result.sort((a, b) => b.points - a.points || b.exact - a.exact || b.outcome - a.outcome)
      setEntries(result)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-gray-400 text-center py-12">Laddar topplista...</div>

  if (entries.length === 0) {
    return <div className="text-gray-400 text-center py-12">Inga resultat inlagda än.</div>
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
              <th className="text-right px-4 py-3 hidden sm:table-cell" title="Exakt rätt resultat">Exakt</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell" title="Rätt 1/X/2">Utfall</th>
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
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
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
                  <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{entry.tipped}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-bold text-lg">{entry.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 text-xs mt-2 text-right">
        Exakt = 30p &nbsp;·&nbsp; Rätt utfall = 10–20p &nbsp;·&nbsp; Fel = 0p
      </p>
    </div>
  )
}
