import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useDeadlines } from '../hooks/useDeadlines'
import { GROUP_ROUNDS, KNOCKOUT_ROUNDS } from '../types'
import type { Match, UserTip } from '../types'
import { Flag } from '../components/Flag'

function formatDeadline(d: Date): string {
  return d.toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}

export function StartsidaPage() {
  const { user } = useAuth()
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [tips, setTips] = useState<Map<string, UserTip>>(new Map())

  const { groupDeadline, groupLocked, nextKnockoutDeadline, allKnockoutLocked } = useDeadlines(allMatches)

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: matchData }, { data: tipData }] = await Promise.all([
        supabase.from('matches').select('*'),
        supabase.from('tips').select('*').eq('user_id', user!.id),
      ])
      if (matchData) setAllMatches(matchData)
      if (tipData) {
        const map = new Map<string, UserTip>()
        tipData.forEach((t: UserTip) => map.set(t.match_id, t))
        setTips(map)
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  const groupMatches = allMatches.filter(m => GROUP_ROUNDS.includes(m.round))
  const knockoutMatches = allMatches.filter(m => KNOCKOUT_ROUNDS.includes(m.round))

  const now = new Date()
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const todayStr = toDateStr(now)

  const todayMatches = allMatches
    .filter(m => toDateStr(new Date(m.starts_at)) === todayStr)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  const nextMatches = todayMatches.length === 0
    ? (() => {
        const future = allMatches
          .filter(m => new Date(m.starts_at) > now)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        if (future.length === 0) return []
        const nextDateStr = toDateStr(new Date(future[0].starts_at))
        return future.filter(m => toDateStr(new Date(m.starts_at)) === nextDateStr)
      })()
    : []

  const displayMatches = todayMatches.length > 0 ? todayMatches : nextMatches
  const isToday = todayMatches.length > 0
  const displayHeading = isToday
    ? 'Dagens matcher'
    : displayMatches.length > 0
      ? `Nästa matchdag · ${new Date(displayMatches[0].starts_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
      : ''
  const groupTipped = groupMatches.filter(m => tips.has(m.id)).length
  const knockoutTipped = knockoutMatches.filter(m => tips.has(m.id)).length

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Deadlines */}
      {(groupMatches.length > 0 || knockoutMatches.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Deadlines</h2>

          {groupMatches.length > 0 && (
            <div className={`rounded-xl p-4 border ${groupLocked ? 'border-red-900 text-red-300' : 'border-cyan-900 text-cyan-300'} bg-gray-900`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold">{groupLocked ? '🔒 Gruppspel — stängt' : '⏳ Gruppspel'}</p>
                  {!groupLocked && groupDeadline && (
                    <p className="text-sm opacity-75 mt-0.5">Stänger {formatDeadline(groupDeadline)}</p>
                  )}
                </div>
                {groupMatches.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold">{groupTipped}/{groupMatches.length}</p>
                    <p className="text-xs opacity-60">tippade</p>
                  </div>
                )}
              </div>
              {!groupLocked && groupMatches.length > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.round((groupTipped / groupMatches.length) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {knockoutMatches.length > 0 && (
            <div className={`rounded-xl p-4 border ${allKnockoutLocked ? 'border-red-900 text-red-300' : 'border-cyan-900 text-cyan-300'} bg-gray-900`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold">{allKnockoutLocked ? '🔒 Slutspel — stängt' : '⏳ Slutspel'}</p>
                  {!allKnockoutLocked && nextKnockoutDeadline && (
                    <p className="text-sm opacity-75 mt-0.5">Nästa deadline: {formatDeadline(nextKnockoutDeadline)}</p>
                  )}
                </div>
                {knockoutMatches.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold">{knockoutTipped}/{knockoutMatches.length}</p>
                    <p className="text-xs opacity-60">tippade</p>
                  </div>
                )}
              </div>
              {!allKnockoutLocked && knockoutMatches.length > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.round((knockoutTipped / knockoutMatches.length) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dagens / nästkommande matcher */}
      {displayMatches.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{displayHeading}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {displayMatches.map(m => {
              const tip = tips.get(m.id)
              const hasResult = m.home_score !== null && m.away_score !== null && (m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED')
              const time = new Date(m.starts_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <div className="w-10 shrink-0 text-xs text-center">
                    {m.status === 'IN_PLAY' && (
                      <span className="inline-block bg-green-500 text-white font-bold px-1 py-0.5 rounded text-[10px] leading-none animate-pulse">LIVE</span>
                    )}
                    {m.status === 'PAUSED' && (
                      <span className="inline-block bg-yellow-500 text-black font-bold px-1 py-0.5 rounded text-[10px] leading-none">HT</span>
                    )}
                    {m.status !== 'IN_PLAY' && m.status !== 'PAUSED' && (
                      <span className="text-gray-500">{time}</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-gray-200">
                      <Flag name={m.home_team} />
                      {m.home_team}
                    </span>
                    <span className={`font-bold shrink-0 tabular-nums ${m.status === 'IN_PLAY' ? 'text-green-400' : m.status === 'PAUSED' ? 'text-yellow-400' : 'text-white'}`}>
                      {hasResult ? `${m.home_score} – ${m.away_score}` : '–'}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-gray-200 justify-end">
                      {m.away_team}
                      <Flag name={m.away_team} />
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {tip ? (
                      <span className="text-xs text-cyan-400">{tip.home_tip}–{tip.away_tip}</span>
                    ) : (
                      <span className="text-xs text-gray-600">ej tippat</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-600 text-right">tider i lokal tid</p>
        </div>
      )}

      {/* Snabblänkar */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/matches" className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-xl p-4 transition-colors text-center">
          <div className="text-2xl mb-1">⚽</div>
          <div className="font-semibold text-white text-sm">Gruppspel</div>
          <div className="text-xs text-gray-500 mt-0.5">72 matcher</div>
        </Link>
        <Link to="/knockout" className="bg-gray-900 border border-gray-800 hover:border-cyan-700 rounded-xl p-4 transition-colors text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-semibold text-white text-sm">Slutspel</div>
          <div className="text-xs text-gray-500 mt-0.5">{knockoutMatches.length} matcher</div>
        </Link>
      </div>

      {/* Konto */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Ditt konto</h2>
        <p className="text-sm text-gray-400 mb-3">
          Du kan byta visningsnamn och lösenord under kontoinställningar.
        </p>
        <Link
          to="/account"
          className="inline-block text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Gå till kontoinställningar →
        </Link>
      </div>

      {/* Regler */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Regler</h2>

        <div>
          <h3 className="font-semibold text-white mb-1">Så funkar det</h3>
          <ul className="text-sm text-gray-400 space-y-1.5">
            <li>• Tippa alla 72 gruppspelsmatcher innan turneringen startar</li>
            <li>• Gissa vinnare, tvåa och trea (Topp 3) — också innan turneringen startar</li>
            <li>• Slutspelet tippar du omgång för omgång — varje omgång har en egen deadline</li>
            <li>• 16-delsfinalen tippar du innan den börjar, sedan 8-delsfinalen osv.</li>
            <li>• Finalen och matchen om tredje pris räknas som samma omgång</li>
            <li>• I slutspelet anger du endast vilket lag som går vidare</li>
            <li>• Tips kan ändras hur många gånger som helst innan deadline</li>
            <li>• Efter deadline går det inte att ändra — inte ens för admin</li>
          </ul>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <h3 className="font-semibold text-white mb-2">Prispott</h3>
          <p className="text-sm text-gray-400 mb-3">Insats: <span className="text-white font-semibold">100 kalleankapengar</span> per person. Totalpotten fördelas på topplistan:</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">🥇 1:a plats</span>
              <span className="font-bold text-amber-400">50%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">🥈 2:a plats</span>
              <span className="font-bold text-cyan-400">30%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">🥉 3:e plats</span>
              <span className="font-bold text-cyan-400">20%</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-2">Poängsystem</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Gruppspel</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Exakt rätt resultat</span>
                  <span className="font-bold text-amber-400">30p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Rätt utfall (1/X/2), nära</span>
                  <span className="font-bold text-cyan-400">10–19p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Fel utfall</span>
                  <span className="font-bold text-red-400">0p</span>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Topp 3</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Rätt VM-etta</span>
                  <span className="font-bold text-amber-400">200p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Rätt VM-tvåa</span>
                  <span className="font-bold text-cyan-400">100p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Rätt VM-trea</span>
                  <span className="font-bold text-cyan-400">50p</span>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Slutspel</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Rätt lag går vidare</span>
                  <span className="font-bold text-amber-400">30p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Fel lag</span>
                  <span className="font-bold text-red-400">0p</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-3 text-xs text-gray-500">
          Poäng för "nära" i gruppspelet räknas som: 20 − (antal mål fel), med golv på 10p.
          Exempel: du tippar 3–1, resultatet blir 5–2 → diff = 3 → 20−3 = 17p.
        </div>

        <div className="border-t border-gray-800 pt-4">
          <h3 className="font-semibold text-white mb-2">Vem vinner?</h3>
          <p className="text-sm text-gray-400 mb-2">Placering avgörs i följande ordning:</p>
          <ol className="text-sm text-gray-400 space-y-1.5 list-none">
            <li><span className="text-gray-500 mr-2">1.</span>Högst totalpoäng</li>
            <li><span className="text-gray-500 mr-2">2.</span>Rätt VM-etta</li>
            <li><span className="text-gray-500 mr-2">3.</span>Rätt VM-tvåa</li>
            <li><span className="text-gray-500 mr-2">4.</span>Rätt VM-trea</li>
            <li><span className="text-gray-500 mr-2">5.</span>Flest rätta tippningar</li>
            <li><span className="text-gray-500 mr-2">6.</span>Tippat ett lag som spelade finalen (som VM-etta eller VM-tvåa)</li>
            <li><span className="text-gray-500 mr-2">7.</span>Tippat ett lag som spelade bronsmatchen (som VM-trea)</li>
            <li><span className="text-gray-500 mr-2">8.</span>Rätt tippat resultat i finalen</li>
          </ol>
        </div>
      </div>

    </div>
  )
}
