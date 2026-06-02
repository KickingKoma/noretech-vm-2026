import { useMemo } from 'react'
import type { Match } from '../types'
import { GROUP_ROUNDS, KNOCKOUT_ROUNDS } from '../types'

export function useDeadlines(matches: Match[]) {
  return useMemo(() => {
    const now = new Date()

    const groupMatches = matches.filter(m => GROUP_ROUNDS.includes(m.round))
    const groupDeadline = groupMatches.length
      ? new Date(Math.min(...groupMatches.map(m => new Date(m.starts_at).getTime())))
      : null

    const roundDeadlines = new Map<string, Date | null>()
    for (const round of KNOCKOUT_ROUNDS) {
      const roundMatches = matches.filter(m => m.round === round)
      roundDeadlines.set(
        round,
        roundMatches.length
          ? new Date(Math.min(...roundMatches.map(m => new Date(m.starts_at).getTime())))
          : null,
      )
    }

    // Bronsmatch och final delar deadline — båda låser när bronsmatchen startar
    const thirdOrFinalDeadline = [roundDeadlines.get('3rd'), roundDeadlines.get('final')]
      .filter((d): d is Date => d !== null && d !== undefined)
      .reduce((min, d) => d < min ? d : min, new Date(8640000000000000))
    const sharedDeadline = thirdOrFinalDeadline.getTime() === 8640000000000000 ? null : thirdOrFinalDeadline
    roundDeadlines.set('3rd', sharedDeadline)
    roundDeadlines.set('final', sharedDeadline)

    const isRoundLocked = (round: string): boolean => {
      const d = roundDeadlines.get(round)
      return d ? now >= d : false
    }

    const upcomingDeadlines = KNOCKOUT_ROUNDS
      .map(r => roundDeadlines.get(r))
      .filter((d): d is Date => d !== null && d !== undefined && now < d)
    const nextKnockoutDeadline = upcomingDeadlines.length
      ? new Date(Math.min(...upcomingDeadlines.map(d => d.getTime())))
      : null

    const knockoutDeadline = roundDeadlines.get('r32') ?? null
    const knockoutLocked = isRoundLocked('r32')
    const allKnockoutLocked = KNOCKOUT_ROUNDS
      .filter(r => roundDeadlines.get(r) !== null)
      .every(r => isRoundLocked(r))

    return {
      groupDeadline,
      groupLocked: groupDeadline ? now >= groupDeadline : false,
      knockoutDeadline,
      knockoutLocked,
      roundDeadlines,
      isRoundLocked,
      nextKnockoutDeadline,
      allKnockoutLocked,
    }
  }, [matches])
}
