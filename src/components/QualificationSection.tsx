import { useMemo, useState } from 'react'
import { calculateQualification, resultScoreFn, tipsScoreFn } from '../utils/qualification'
import type { Match, UserTip } from '../types'
import { GROUP_ROUNDS, ROUND_LABEL } from '../types'
import { Flag } from './Flag'

interface Props {
  allMatches: Match[]
  tips: Map<string, UserTip>
}

type Tab = 'results' | 'tips'

export function QualificationSection({ allMatches, tips }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('results')
  const [expanded, setExpanded] = useState(false)

  const groupMatches = useMemo(
    () => allMatches.filter(m => GROUP_ROUNDS.includes(m.round)),
    [allMatches],
  )

  const resultQual = useMemo(
    () => calculateQualification(groupMatches, resultScoreFn),
    [groupMatches],
  )

  const tipsQual = useMemo(
    () => calculateQualification(groupMatches, tipsScoreFn(tips)),
    [groupMatches, tips],
  )

  if (groupMatches.length === 0) return null

  const qual = activeTab === 'results' ? resultQual : tipsQual
  const thirds = qual.rankedThirds

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl mb-6">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-white font-bold text-sm">Vilka lag går vidare till r32?</span>
        <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800">
          <div className="flex gap-2 mt-3 mb-4">
            {(['results', 'tips'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-cyan-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'results' ? 'Resultat' : 'Dina tips'}
              </button>
            ))}
          </div>

          {/* Groups grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
            {qual.groups.map(g => (
              <div key={g.group} className="bg-gray-800 rounded-lg p-2">
                <div className="text-xs font-semibold text-gray-400 mb-1.5">
                  {ROUND_LABEL[g.group]}
                  {g.completedMatches < g.totalMatches && (
                    <span className="text-gray-600 font-normal ml-1">
                      {g.completedMatches}/{g.totalMatches}
                    </span>
                  )}
                </div>
                {g.standings.map((s, i) => (
                  <div
                    key={s.team}
                    className={`flex items-center gap-1 py-0.5 text-xs ${
                      i < 2 ? 'text-white' : i === 2 ? 'text-yellow-400' : 'text-gray-600'
                    }`}
                  >
                    <span className="w-3 text-gray-600 shrink-0">{i + 1}</span>
                    <Flag name={s.team} />
                    <span className="truncate flex-1">{s.team}</span>
                    <span className="tabular-nums text-gray-500 shrink-0">{s.points}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Ranked thirds */}
          {thirds.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">
                Bästa treor — 8 av {thirds.length} går vidare
              </div>
              <div className="space-y-0.5">
                {thirds.map((s, i) => (
                  <div key={s.team}>
                    {i === 8 && <div className="border-t border-dashed border-gray-700 my-1.5" />}
                    <div className={`flex items-center gap-2 text-xs px-1 py-0.5 rounded ${
                      i < 8 ? 'text-white' : 'text-gray-600'
                    }`}>
                      <span className="w-4 tabular-nums text-gray-600 shrink-0 text-right">{i + 1}</span>
                      <Flag name={s.team} />
                      <span className="flex-1 truncate">{s.team}</span>
                      <span className="tabular-nums text-gray-500 w-5 text-right">{s.points}p</span>
                      <span className="tabular-nums text-gray-500 w-10 text-right">
                        {s.gd >= 0 ? '+' : ''}{s.gd} ms
                      </span>
                      <span className="tabular-nums text-gray-500 w-8 text-right">{s.gf} gm</span>
                      <span className={`w-4 text-center shrink-0 ${i < 8 ? 'text-green-400' : 'text-red-500'}`}>
                        {i < 8 ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-2">
              {activeTab === 'results'
                ? 'Inga gruppspelsresultat än'
                : 'Tippa gruppspelet för att se din prognos'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
