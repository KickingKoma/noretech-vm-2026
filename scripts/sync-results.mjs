#!/usr/bin/env node
// Synkar avgjorda matcher från football-data.org → Supabase
// Miljövariabler: FOOTBALL_DATA_API_KEY, SUPABASE_SERVICE_ROLE_KEY
// SUPABASE_URL är valfri (defaultar till projektets URL)
// Kör: node scripts/sync-results.mjs

import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ibprecowlcrrtvofayul.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!API_KEY) { console.error('Saknar FOOTBALL_DATA_API_KEY'); process.exit(1) }
if (!SUPABASE_SERVICE_KEY) { console.error('Saknar SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

// Engelska API-namn → svenska DB-namn
const EN_TO_SE = {
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
}

function toSv(name) {
  return EN_TO_SE[name] ?? name
}

const KNOCKOUT_STAGES = new Set(['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'])

async function fetchFinishedMatches() {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) throw new Error(`API-fel ${res.status}: ${await res.text()}`)
  const { matches } = await res.json()
  return matches ?? []
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('Hämtar avgjorda matcher från football-data.org...')
  const apiMatches = await fetchFinishedMatches()
  console.log(`${apiMatches.length} avgjorda matcher i API:t`)

  if (apiMatches.length === 0) {
    console.log('Inget att uppdatera.')
    return
  }

  // Hämta alla matcher från Supabase
  const { data: dbMatches, error } = await supabase.from('matches').select('id, home_team, away_team, home_score, away_score, winner_team, round')
  if (error) throw new Error(`Supabase-fel: ${error.message}`)

  // Bygg lookup: "hemmalag|bortalag" → DB-match
  const dbByTeams = new Map(
    dbMatches.map(m => [`${m.home_team}|${m.away_team}`, m])
  )

  let updated = 0, skipped = 0, notFound = 0

  for (const api of apiMatches) {
    const homeEn = api.homeTeam?.name ?? ''
    const awayEn = api.awayTeam?.name ?? ''
    const homeSv = toSv(homeEn)
    const awaySv = toSv(awayEn)

    const db = dbByTeams.get(`${homeSv}|${awaySv}`)
    if (!db) {
      console.warn(`  Ej hittad: ${homeEn} (${homeSv}) – ${awayEn} (${awaySv})`)
      notFound++
      continue
    }

    const homeScore = api.score?.fullTime?.home ?? null
    const awayScore = api.score?.fullTime?.away ?? null
    const isKnockout = KNOCKOUT_STAGES.has(api.stage)

    let winnerTeam = null
    if (isKnockout && api.score?.winner) {
      winnerTeam = api.score.winner === 'HOME_TEAM' ? homeSv
                 : api.score.winner === 'AWAY_TEAM' ? awaySv
                 : null
    }

    // Hoppa över om inget har ändrats
    if (db.home_score === homeScore && db.away_score === awayScore && db.winner_team === winnerTeam) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, winner_team: winnerTeam })
      .eq('id', db.id)

    if (updateError) {
      console.error(`  Fel vid uppdatering av ${homeSv} – ${awaySv}: ${updateError.message}`)
    } else {
      console.log(`  ✓ ${homeSv} ${homeScore}–${awayScore} ${awaySv}${winnerTeam ? ` (vinnare: ${winnerTeam})` : ''}`)
      updated++
    }
  }

  console.log(`\nKlart: ${updated} uppdaterade, ${skipped} oförändrade, ${notFound} ej hittade`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
