import type { Match, UserTip } from '../types'
import { GROUP_ROUNDS } from '../types'

export interface TeamStanding {
  team: string
  group: string
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  gd: number
  points: number
}

export interface GroupResult {
  group: string
  standings: TeamStanding[]
  completedMatches: number
  totalMatches: number
}

export interface QualificationResult {
  groups: GroupResult[]
  rankedThirds: TeamStanding[]
}

type ScoreFn = (match: Match) => { home: number; away: number } | null

export function calculateQualification(
  groupMatches: Match[],
  scoreFn: ScoreFn,
): QualificationResult {
  const groups: GroupResult[] = []

  for (const groupRound of GROUP_ROUNDS) {
    const matches = groupMatches.filter(m => m.round === groupRound)
    if (matches.length === 0) continue

    const teamSet = new Set<string>()
    for (const m of matches) {
      if (m.home_team) teamSet.add(m.home_team)
      if (m.away_team) teamSet.add(m.away_team)
    }
    if (teamSet.size === 0) continue

    const standings = new Map<string, TeamStanding>()
    for (const team of teamSet) {
      standings.set(team, {
        team, group: groupRound,
        played: 0, wins: 0, draws: 0, losses: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      })
    }

    let completedMatches = 0
    for (const match of matches) {
      if (!match.home_team || !match.away_team) continue
      const score = scoreFn(match)
      if (!score) continue
      completedMatches++

      const { home, away } = score
      const h = standings.get(match.home_team)!
      const a = standings.get(match.away_team)!

      h.played++; h.gf += home; h.ga += away; h.gd += home - away
      a.played++; a.gf += away; a.ga += home; a.gd += away - home

      if (home > away) {
        h.wins++; h.points += 3; a.losses++
      } else if (home < away) {
        a.wins++; a.points += 3; h.losses++
      } else {
        h.draws++; h.points++; a.draws++; a.points++
      }
    }

    groups.push({
      group: groupRound,
      standings: Array.from(standings.values()).sort(compareStandings),
      completedMatches,
      totalMatches: matches.filter(m => m.home_team && m.away_team).length,
    })
  }

  const rankedThirds = groups
    .filter(g => g.standings.length >= 3)
    .map(g => g.standings[2])
    .sort(compareStandings)

  return { groups, rankedThirds }
}

function compareStandings(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.gd !== a.gd) return b.gd - a.gd
  if (b.gf !== a.gf) return b.gf - a.gf
  return b.wins - a.wins
}

export function resultScoreFn(match: Match): { home: number; away: number } | null {
  return match.home_score !== null && match.away_score !== null
    ? { home: match.home_score, away: match.away_score }
    : null
}

export function tipsScoreFn(tips: Map<string, UserTip>) {
  return (match: Match): { home: number; away: number } | null => {
    const tip = tips.get(match.id)
    return tip != null ? { home: tip.home_tip, away: tip.away_tip } : null
  }
}
