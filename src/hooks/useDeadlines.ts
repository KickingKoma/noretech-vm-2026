import { useMemo } from 'react'
import type { Match } from '../types'
import { GROUP_ROUNDS, KNOCKOUT_ROUNDS } from '../types'

export function useDeadlines(matches: Match[]) {
  return useMemo(() => {
    const groupMatches = matches.filter(m => GROUP_ROUNDS.includes(m.round))
    const r32Matches = matches.filter(m => m.round === 'r32')

    const groupDeadline = groupMatches.length
      ? new Date(Math.min(...groupMatches.map(m => new Date(m.starts_at).getTime())))
      : null

    const knockoutDeadline = r32Matches.length
      ? new Date(Math.min(...r32Matches.map(m => new Date(m.starts_at).getTime())))
      : null

    const now = new Date()

    return {
      groupDeadline,
      knockoutDeadline,
      groupLocked: groupDeadline ? now >= groupDeadline : false,
      knockoutLocked: knockoutDeadline ? now >= knockoutDeadline : false,
    }
  }, [matches])
}
