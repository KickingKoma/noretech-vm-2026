#!/usr/bin/env node
// Verifierar att våra gruppspelsmatcher i seed_group_stage.sql stämmer mot football-data.org
// Användning: node scripts/verify-matches.mjs <API_KEY>

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API_KEY = process.argv[2] || process.env.FOOTBALL_DATA_API_KEY
if (!API_KEY) {
  console.error('Ange API-nyckel: node scripts/verify-matches.mjs <API_KEY>')
  process.exit(1)
}

// Namn-mapping: våra svenska namn → engelska API-namn
const SE_TO_EN = {
  'Tjeckien': 'Czech Republic',
  'Bosnien-Hercegovina': 'Bosnia-Herzegovina',
  'Brasilien': 'Brazil',
  'Skottland': 'Scotland',
  'Australien': 'Australia',
  'Turkiet': 'Türkiye',
  'Elfenbenskusten': "Côte d'Ivoire",
  'Curaçao': 'Curaçao',
  'Nederländerna': 'Netherlands',
  'Tunisien': 'Tunisia',
  'Sverige': 'Sweden',
  'Belgien': 'Belgium',
  'Nya Zeeland': 'New Zealand',
  'Egypten': 'Egypt',
  'Spanien': 'Spain',
  'Kap Verde': 'Cape Verde Islands',
  'Schweiz': 'Switzerland',
  'USA': 'United States',
  'Saudiarabien': 'Saudi Arabia',
  'Frankrike': 'France',
  'Irak': 'Iraq',
  'Norge': 'Norway',
  'Algeriet': 'Algeria',
  'Österrike': 'Austria',
  'Jordanien': 'Jordan',
  'DR Kongo': 'DR Congo',
  'Kroatien': 'Croatia',
  'Tyskland': 'Germany',
  'Marocko': 'Morocco',
}

function toEn(name) {
  return SE_TO_EN[name] ?? name
}

// Parsa seed_group_stage.sql
function parseSeedSql() {
  const sql = readFileSync(join(__dirname, '../supabase/seed_group_stage.sql'), 'utf8')
  const matches = []
  const lineRe = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'(group-[A-L])'\)/g
  let m
  while ((m = lineRe.exec(sql)) !== null) {
    const [, home, away, startsAt, round] = m
    matches.push({
      home: toEn(home),
      away: toEn(away),
      startsAt: new Date(startsAt),
      round,
      homeSv: home,
      awaySv: away,
    })
  }
  return matches
}

// Hämta alla matcher från football-data.org
async function fetchApiMatches() {
  const url = 'https://api.football-data.org/v4/competitions/WC/matches'
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API-fel ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.matches ?? []
}

function fmtDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

// Normalisera API-teamnamn (kan variera lite)
function normalizeApiName(name) {
  const overrides = {
    'Czechia': 'Czech Republic',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
    'Congo DR': 'DR Congo',
    "Côte d'Ivoire": "Côte d'Ivoire",
    'Ivory Coast': "Côte d'Ivoire",
    'Turkey': 'Türkiye',
  }
  return overrides[name] ?? name
}

async function main() {
  console.log('Hämtar matcher från football-data.org...')
  const apiMatches = await fetchApiMatches()
  const groupApiMatches = apiMatches.filter(m => m.stage === 'GROUP_STAGE')
  console.log(`API: ${groupApiMatches.length} gruppspelsmatcher\n`)

  const ourMatches = parseSeedSql()
  console.log(`Vår SQL: ${ourMatches.length} gruppspelsmatcher\n`)

  // Bygg två lookups från API:
//   apiByExact:    "home vs away" → match  (korrekt ordning)
//   apiByReversed: "away vs home" → match  (omvänd ordning)
  const apiByExact = new Map()
  const apiByReversed = new Map()
  for (const m of groupApiMatches) {
    const home = normalizeApiName(m.homeTeam?.name ?? '')
    const away = normalizeApiName(m.awayTeam?.name ?? '')
    apiByExact.set(`${home} vs ${away}`, { home, away, utcDate: new Date(m.utcDate), group: m.group })
    apiByReversed.set(`${away} vs ${home}`, { home, away, utcDate: new Date(m.utcDate), group: m.group })
  }

  let ok = 0
  const dateDiffs = []
  const swapped = []
  const notFound = []

  for (const our of ourMatches) {
    const key = `${our.home} vs ${our.away}`
    const api = apiByExact.get(key)

    if (api) {
      apiByExact.delete(key)
      apiByReversed.delete(`${our.away} vs ${our.home}`)
      const diffMs = Math.abs(our.startsAt - api.utcDate)
      const diffMin = diffMs / 60000
      if (diffMin > 1) {
        dateDiffs.push({ our, api, diffMin: Math.round(diffMin) })
      } else {
        ok++
      }
      continue
    }

    // Kolla om paret finns men med hemma/borta omvänt
    const reversedApi = apiByReversed.get(key)
    if (reversedApi) {
      apiByExact.delete(`${reversedApi.home} vs ${reversedApi.away}`)
      apiByReversed.delete(key)
      swapped.push({ our, api: reversedApi })
      continue
    }

    notFound.push(our)
  }

  const notInOurs = [...apiByExact.values()]

  // Rapport
  console.log('='.repeat(60))
  console.log(`OK (lag, ordning och tid stämmer): ${ok}`)
  console.log(`Hemma/borta omvänt:                ${swapped.length}`)
  console.log(`Tidsskillnad (rätt ordning):        ${dateDiffs.length}`)
  console.log(`Ej hittade i API:                   ${notFound.length}`)
  console.log(`I API men ej i vår SQL:             ${notInOurs.length}`)
  console.log('='.repeat(60))

  if (swapped.length > 0) {
    console.log('\nHEMMA/BORTA OMVÄNT (vår SQL vs API):')
    for (const { our, api } of swapped) {
      console.log(`  Vår SQL: ${our.homeSv} (H) – ${our.awaySv} (B)`)
      console.log(`  API:     ${api.home} (H) – ${api.away} (B)`)
    }
  }

  if (dateDiffs.length > 0) {
    console.log('\nTIDSSKILLNADER:')
    for (const { our, api, diffMin } of dateDiffs) {
      console.log(`  ${our.homeSv} vs ${our.awaySv}`)
      console.log(`    Vår:  ${fmtDate(our.startsAt)}`)
      console.log(`    API:  ${fmtDate(api.utcDate)}  (${diffMin} min skillnad)`)
    }
  }

  if (notFound.length > 0) {
    console.log('\nEJ HITTADE I API (kontrollera teamnamn-mappning):')
    for (const m of notFound) {
      console.log(`  ${m.homeSv} (${m.home}) vs ${m.awaySv} (${m.away})  [${m.round}]`)
    }
  }

  if (notInOurs.length > 0) {
    console.log('\nI API MEN EJ I VÅR SQL:')
    for (const m of notInOurs) {
      console.log(`  ${m.home} vs ${m.away}  ${fmtDate(m.utcDate)}  [${m.group}]`)
    }
  }

  if (swapped.length === 0 && dateDiffs.length === 0 && notFound.length === 0 && notInOurs.length === 0) {
    console.log('\nAlla 72 matcher stämmer perfekt!')
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
