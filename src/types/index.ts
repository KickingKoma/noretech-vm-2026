export interface Match {
  id: string
  home_team: string | null
  away_team: string | null
  home_source_match_id: string | null
  away_source_match_id: string | null
  home_source_is_winner: boolean
  away_source_is_winner: boolean
  starts_at: string
  round: string
  home_score: number | null
  away_score: number | null
  winner_team: string | null
  status: string
  created_at: string
}

export interface UserTip {
  id: string
  user_id: string
  match_id: string
  home_tip: number
  away_tip: number
  winner_tip: string | null
  created_at: string
}

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface TournamentPrediction {
  id: string
  user_id: string
  first_place: string
  second_place: string
  third_place: string
  created_at: string
}

export const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf', '3rd', 'final']

export const GROUP_ROUNDS = [
  'group-A', 'group-B', 'group-C', 'group-D', 'group-E', 'group-F',
  'group-G', 'group-H', 'group-I', 'group-J', 'group-K', 'group-L',
]

export const ROUND_LABEL: Record<string, string> = {
  'group-A': 'Grupp A', 'group-B': 'Grupp B', 'group-C': 'Grupp C', 'group-D': 'Grupp D',
  'group-E': 'Grupp E', 'group-F': 'Grupp F', 'group-G': 'Grupp G', 'group-H': 'Grupp H',
  'group-I': 'Grupp I', 'group-J': 'Grupp J', 'group-K': 'Grupp K', 'group-L': 'Grupp L',
  'r32': '16-delsfinal', 'r16': 'Åttondelsfinal', 'qf': 'Kvartsfinaler',
  'sf': 'Semifinaler', '3rd': 'Bronsmatch', 'final': 'Finalen',
}

export function calcPoints(
  matchHome: number,
  matchAway: number,
  matchWinner: string | null,
  tipHome: number,
  tipAway: number,
  tipWinner: string | null,
  isKnockout: boolean,
): number {
  const diff = Math.abs(tipHome - matchHome) + Math.abs(tipAway - matchAway)
  const exactScore = diff === 0
  const correctOutcome = Math.sign(tipHome - tipAway) === Math.sign(matchHome - matchAway)

  if (!isKnockout) {
    if (exactScore) return 30
    if (correctOutcome) return Math.max(10, 20 - diff)
    return 0
  } else {
    return tipWinner === matchWinner ? 30 : 0
  }
}

export function getEffectiveTeam(
  match: Match,
  side: 'home' | 'away',
  matchMap: Map<string, Match>,
): string {
  const directTeam = side === 'home' ? match.home_team : match.away_team
  if (directTeam) return directTeam

  const sourceId = side === 'home' ? match.home_source_match_id : match.away_source_match_id
  if (!sourceId) return 'TBD'

  const sourceMatch = matchMap.get(sourceId)
  if (!sourceMatch || (!sourceMatch.home_team && !sourceMatch.away_team)) return 'TBD'
  return '?'
}
