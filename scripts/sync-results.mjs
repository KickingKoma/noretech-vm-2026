#!/usr/bin/env node
// Synkar matcher från football-data.org → Supabase
// - Uppdaterar resultat (poäng, vinnare) för avgjorda matcher
// - Uppdaterar lagnamn för slutspelsmatcher när de blir kända
// - Backfyllar api_match_id för gruppspelsmatcher
// Miljövariabler: FOOTBALL_DATA_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (valfri)
// Kör: node scripts/sync-results.mjs

import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ibprecowlcrrtvofayul.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!API_KEY) { console.error('Saknar FOOTBALL_DATA_API_KEY'); process.exit(1) }
if (!SUPABASE_SERVICE_KEY) { console.error('Saknar SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

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

function toSv(name) {
  return EN_TO_SE[name] ?? name
}

const KNOCKOUT_STAGES = new Set(['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'])

async function fetchAllMatches() {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) throw new Error(`API-fel ${res.status}: ${await res.text()}`)
  const { matches } = await res.json()
  return matches ?? []
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('Hämtar matcher från football-data.org...')
  const apiMatches = await fetchAllMatches()
  console.log(`${apiMatches.length} matcher i API:t`)

  const { data: dbMatches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, winner_team, status, round, api_match_id')
  if (error) throw new Error(`Supabase-fel: ${error.message}`)

  // Primär lookup: api_match_id
  const dbById = new Map(
    dbMatches
      .filter(m => m.api_match_id)
      .map(m => [m.api_match_id, m])
  )
  // Fallback: lagnamn (för gruppspelsmatcher utan api_match_id ännu)
  const dbByTeams = new Map(
    dbMatches
      .filter(m => m.home_team && m.away_team)
      .map(m => [`${m.home_team}|${m.away_team}`, m])
  )

  let updated = 0, skipped = 0, notFound = 0

  for (const api of apiMatches) {
    const homeEn = api.homeTeam?.name ?? ''
    const awayEn = api.awayTeam?.name ?? ''
    const homeSv = homeEn ? toSv(homeEn) : null
    const awaySv = awayEn ? toSv(awayEn) : null

    // Hitta DB-match: api_match_id i första hand, annars lagnamn
    let db = dbById.get(api.id) ?? null
    if (!db && homeSv && awaySv) {
      db = dbByTeams.get(`${homeSv}|${awaySv}`) ?? null
    }

    if (!db) {
      if (homeEn) console.warn(`  Ej hittad: ${homeEn} (${homeSv}) – ${awayEn} (${awaySv})`)
      notFound++
      continue
    }

    const updates = {}

    // Backfyll api_match_id om det saknas
    if (!db.api_match_id) updates.api_match_id = api.id

    // Uppdatera lagnamn för slutspelsmatcher när API:et får dem
    if (!db.home_team && homeSv) updates.home_team = homeSv
    if (!db.away_team && awaySv) updates.away_team = awaySv

    // Uppdatera resultat och status
    const isLive = api.status === 'IN_PLAY' || api.status === 'PAUSED'
    const isFinished = api.status === 'FINISHED'

    if (isFinished || isLive) {
      const homeScore = api.score?.fullTime?.home ?? null
      const awayScore = api.score?.fullTime?.away ?? null
      const isKnockout = KNOCKOUT_STAGES.has(api.stage)

      let winnerTeam = null
      if (isFinished && isKnockout && api.score?.winner) {
        const homeTeamSv = db.home_team || homeSv
        const awayTeamSv = db.away_team || awaySv
        winnerTeam = api.score.winner === 'HOME_TEAM' ? homeTeamSv
                   : api.score.winner === 'AWAY_TEAM' ? awayTeamSv
                   : null
      }

      if (db.home_score !== homeScore) updates.home_score = homeScore
      if (db.away_score !== awayScore) updates.away_score = awayScore
      if (isFinished && db.winner_team !== winnerTeam) updates.winner_team = winnerTeam
    }

    const newStatus = isFinished ? 'FINISHED' : (api.status === 'IN_PLAY' || api.status === 'PAUSED') ? api.status : 'SCHEDULED'
    if (db.status !== newStatus) updates.status = newStatus

    if (Object.keys(updates).length === 0) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', db.id)

    if (updateError) {
      console.error(`  Fel: ${homeEn} – ${awayEn}: ${updateError.message}`)
    } else {
      const parts = []
      if (updates.home_team || updates.away_team) parts.push(`lag: ${updates.home_team} – ${updates.away_team}`)
      if (updates.home_score !== undefined) parts.push(`${updates.home_score}–${updates.away_score}`)
      if (updates.api_match_id) parts.push(`api_id=${updates.api_match_id}`)
      console.log(`  ✓ ${db.home_team || homeSv} – ${db.away_team || awaySv}: ${parts.join(', ')}`)
      updated++
    }
  }

  console.log(`\nKlart: ${updated} uppdaterade, ${skipped} oförändrade, ${notFound} ej hittade`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
