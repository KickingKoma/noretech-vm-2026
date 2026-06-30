import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY')

const EN_TO_SE: Record<string, string> = {
  'Czech Republic': 'Tjeckien', 'Czechia': 'Tjeckien',
  'Bosnia-Herzegovina': 'Bosnien-Hercegovina', 'Bosnia and Herzegovina': 'Bosnien-Hercegovina',
  'Brazil': 'Brasilien',
  'Scotland': 'Skottland',
  'Australia': 'Australien',
  'Türkiye': 'Turkiet', 'Turkey': 'Turkiet',
  "Côte d'Ivoire": 'Elfenbenskusten', 'Ivory Coast': 'Elfenbenskusten',
  'Netherlands': 'Nederländerna',
  'Tunisia': 'Tunisien',
  'Sweden': 'Sverige',
  'Belgium': 'Belgien',
  'New Zealand': 'Nya Zeeland',
  'Egypt': 'Egypten',
  'Spain': 'Spanien',
  'Cape Verde Islands': 'Kap Verde', 'Cape Verde': 'Kap Verde',
  'Switzerland': 'Schweiz',
  'United States': 'USA',
  'Saudi Arabia': 'Saudiarabien',
  'France': 'Frankrike',
  'Iraq': 'Irak',
  'Norway': 'Norge',
  'Algeria': 'Algeriet',
  'Austria': 'Österrike',
  'Jordan': 'Jordanien',
  'DR Congo': 'DR Kongo', 'Congo DR': 'DR Kongo',
  'Croatia': 'Kroatien',
  'Germany': 'Tyskland',
  'Morocco': 'Marocko',
  'Serbia': 'Serbien',
  'Slovenia': 'Slovenien',
  'Slovakia': 'Slovakien',
  'Hungary': 'Ungern',
  'Romania': 'Rumänien',
  'Greece': 'Grekland',
  'Denmark': 'Danmark',
  'Poland': 'Polen',
  'Ukraine': 'Ukraina',
  'Russia': 'Ryssland',
  'China PR': 'Kina', 'China': 'Kina',
  'Venezuela': 'Venezuela',
  'Chile': 'Chile',
  'Peru': 'Peru',
  'Bolivia': 'Bolivia',
  'Ecuador': 'Ecuador',
}

const KNOCKOUT_STAGES = new Set(['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'])

function toSv(name: string): string {
  return EN_TO_SE[name] ?? name
}

Deno.serve(async (_req) => {
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'Saknar FOOTBALL_DATA_API_KEY' }), { status: 500 })
  }

  try {
    const result = await sync()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})

async function sync() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const [allRes, finishedRes, liveRes, pausedRes] = await Promise.all([
    fetch('https://api.football-data.org/v4/competitions/WC/matches', { headers: { 'X-Auth-Token': API_KEY! } }),
    fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', { headers: { 'X-Auth-Token': API_KEY! } }),
    fetch('https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY', { headers: { 'X-Auth-Token': API_KEY! } }),
    fetch('https://api.football-data.org/v4/competitions/WC/matches?status=PAUSED', { headers: { 'X-Auth-Token': API_KEY! } }),
  ])
  if (!allRes.ok) throw new Error(`API-fel ${allRes.status}`)
  const { matches: apiMatches } = await allRes.json()

  // FINISHED-endpoint har tillförlitliga slutresultat (bulk-endpointen returnerar null)
  const finishedScores = new Map<number, { home: number | null; away: number | null; winner: string | null; duration: string | null }>()
  if (finishedRes.ok) {
    const { matches: finishedMatches } = await finishedRes.json()
    for (const m of (finishedMatches ?? [])) {
      finishedScores.set(m.id, {
        home: m.score?.fullTime?.home ?? null,
        away: m.score?.fullTime?.away ?? null,
        winner: m.score?.winner ?? null,
        duration: m.score?.duration ?? null,
      })
    }
  }

  // IN_PLAY-endpoint för live-poäng (logga score-objektet för felsökning)
  // Hämtar även PAUSED separat för att fånga halvtidsresultat
  const liveScores = new Map<number, Record<string, unknown>>()
  if (liveRes.ok) {
    const { matches: liveMatches } = await liveRes.json()
    for (const m of (liveMatches ?? [])) {
      liveScores.set(m.id, m.score)
      console.log(`LIVE score obj [${m.id}] ${m.homeTeam?.name} – ${m.awayTeam?.name}:`, JSON.stringify(m.score))
    }
  }
  if (pausedRes.ok) {
    const { matches: pausedMatches } = await pausedRes.json()
    for (const m of (pausedMatches ?? [])) {
      liveScores.set(m.id, m.score)
      console.log(`PAUSED score obj [${m.id}] ${m.homeTeam?.name} – ${m.awayTeam?.name}:`, JSON.stringify(m.score))
    }
  }

  const { data: dbMatches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, winner_team, status, round, api_match_id')
  if (error) throw new Error(`Supabase-fel: ${error.message}`)

  const dbById = new Map(
    dbMatches.filter((m: Record<string, unknown>) => m.api_match_id).map((m: Record<string, unknown>) => [m.api_match_id, m])
  )
  const dbByTeams = new Map(
    dbMatches.filter((m: Record<string, unknown>) => m.home_team && m.away_team).map((m: Record<string, unknown>) => [`${m.home_team}|${m.away_team}`, m])
  )

  let updated = 0, skipped = 0, notFound = 0

  for (const api of apiMatches) {
    const homeEn = api.homeTeam?.name ?? ''
    const awayEn = api.awayTeam?.name ?? ''
    const homeSv = homeEn ? toSv(homeEn) : null
    const awaySv = awayEn ? toSv(awayEn) : null

    let db = dbById.get(api.id) ?? null
    if (!db && homeSv && awaySv) {
      db = dbByTeams.get(`${homeSv}|${awaySv}`) ?? null
    }

    if (!db) {
      if (homeEn) notFound++
      continue
    }

    const updates: Record<string, unknown> = {}

    if (!db.api_match_id) updates.api_match_id = api.id
    if (!db.home_team && homeSv) updates.home_team = homeSv
    if (!db.away_team && awaySv) updates.away_team = awaySv

    const isLive = api.status === 'IN_PLAY' || api.status === 'PAUSED' || api.status === 'LIVE'
    const isFinished = api.status === 'FINISHED'

    if (isFinished) {
      const scored = finishedScores.get(api.id)
      const homeScore = scored?.home ?? null
      const awayScore = scored?.away ?? null
      const isKnockout = KNOCKOUT_STAGES.has(api.stage)

      let winnerTeam = null
      if (isKnockout && scored) {
        const homeTeamSv = db.home_team || homeSv
        const awayTeamSv = db.away_team || awaySv
        if (scored.winner === 'HOME_TEAM') {
          winnerTeam = homeTeamSv
        } else if (scored.winner === 'AWAY_TEAM') {
          winnerTeam = awayTeamSv
        } else if (scored.duration === 'PENALTY_SHOOTOUT' && scored.home != null && scored.away != null) {
          winnerTeam = scored.home > scored.away ? homeTeamSv : awayTeamSv
        }
      }

      if (homeScore !== null && db.home_score !== homeScore) updates.home_score = homeScore
      if (awayScore !== null && db.away_score !== awayScore) updates.away_score = awayScore
      if (db.winner_team !== winnerTeam) updates.winner_team = winnerTeam
    } else if (isLive) {
      // Prioritera dedikerade IN_PLAY/PAUSED-endpoints; fall tillbaka på bulk-endpointens score
      // när API returnerar status "LIVE" som inte matchas av ?status=IN_PLAY-filtret
      const liveScore = liveScores.get(api.id) ?? api.score
      const homeScore = (liveScore?.fullTime as Record<string, number> | null)?.home
        ?? (liveScore?.halfTime as Record<string, number> | null)?.home
        ?? null
      const awayScore = (liveScore?.fullTime as Record<string, number> | null)?.away
        ?? (liveScore?.halfTime as Record<string, number> | null)?.away
        ?? null

      if (homeScore !== null && db.home_score !== homeScore) updates.home_score = homeScore
      if (awayScore !== null && db.away_score !== awayScore) updates.away_score = awayScore
    }

    const newStatus = isFinished ? 'FINISHED'
      : (api.status === 'IN_PLAY' || api.status === 'LIVE') ? 'IN_PLAY'
      : api.status === 'PAUSED' ? 'PAUSED'
      : 'SCHEDULED'
    if (db.status !== newStatus && db.status !== 'FINISHED') updates.status = newStatus

    if (Object.keys(updates).length === 0) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', db.id)

    if (updateError) {
      console.error(`Fel: ${homeEn} – ${awayEn}: ${updateError.message}`)
    } else {
      updated++
    }
  }

  return { updated, skipped, notFound }
}
