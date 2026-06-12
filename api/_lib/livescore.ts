// Placar ao vivo via football-data.org (free tier: Copa inclusa, 10 req/min).
// O chamador (api/live.ts) é responsável pelo cache em banco — aqui só busca e mapeia.

import type { Match } from './schema.js'

const FD_BASE = 'https://api.football-data.org/v4'
const WORLD_CUP_ID = 2000

// nomes do football-data → nomes do nosso banco (feed fixturedownload)
const FD_ALIASES: Record<string, string> = {
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Cape Verde Islands': 'Cabo Verde',
  Iran: 'IR Iran',
  'Ivory Coast': "Côte d'Ivoire",
  'South Korea': 'Korea Republic',
  Turkey: 'Türkiye',
  'United States': 'USA',
}

const DAY_MS = 86_400_000

interface FdMatch {
  utcDate: string
  status: string
  homeTeam: { name: string | null }
  awayTeam: { name: string | null }
  score: { fullTime: { home: number | null; away: number | null } }
}

export interface LiveScore {
  matchId: number
  status: 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  homeScore: number
  awayScore: number
}

function mapToOurMatch(fd: FdMatch, ours: Match[]): { matchId: number; swap: boolean } | null {
  const home = fd.homeTeam.name ? (FD_ALIASES[fd.homeTeam.name] ?? fd.homeTeam.name) : null
  const away = fd.awayTeam.name ? (FD_ALIASES[fd.awayTeam.name] ?? fd.awayTeam.name) : null
  const kickoff = new Date(fd.utcDate).getTime()
  const nearKickoff = (m: Match) => Math.abs(m.kickoffAt.getTime() - kickoff) < DAY_MS

  if (home && away) {
    const direct = ours.find((m) => m.homeTeam === home && m.awayTeam === away && nearKickoff(m))
    if (direct) return { matchId: direct.id, swap: false }
    const swapped = ours.find((m) => m.homeTeam === away && m.awayTeam === home && nearKickoff(m))
    if (swapped) return { matchId: swapped.id, swap: true }
  }
  // mata-mata ainda com placeholder no banco (admin não rodou o feed): casa pelo
  // horário exato, mas só quando não há jogo simultâneo que cause ambiguidade
  const sameTime = ours.filter((m) => m.kickoffAt.getTime() === kickoff)
  if (sameTime.length === 1) return { matchId: sameTime[0].id, swap: false }
  return null
}

export async function fetchLiveScores(ourMatches: Match[]): Promise<LiveScore[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN não configurado')

  const now = Date.now()
  const day = (t: number) => new Date(t).toISOString().slice(0, 10)
  const url = `${FD_BASE}/competitions/${WORLD_CUP_ID}/matches?dateFrom=${day(now - DAY_MS)}&dateTo=${day(now + DAY_MS)}`
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
  if (!res.ok) throw new Error(`football-data respondeu HTTP ${res.status}`)
  const data = (await res.json()) as { matches?: FdMatch[] }

  const scores: LiveScore[] = []
  for (const fd of data.matches ?? []) {
    if (fd.status !== 'IN_PLAY' && fd.status !== 'PAUSED' && fd.status !== 'FINISHED') continue
    const { home, away } = fd.score.fullTime
    if (home === null || away === null) continue
    const mapped = mapToOurMatch(fd, ourMatches)
    if (!mapped) continue
    scores.push({
      matchId: mapped.matchId,
      status: fd.status,
      homeScore: mapped.swap ? away : home,
      awayScore: mapped.swap ? home : away,
    })
  }
  return scores
}
