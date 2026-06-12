// Placar ao vivo + resultado final via API pública da ESPN (não-documentada,
// sem chave, tempo real — decisão do Rafael 12/06 após o free tier do
// football-data se mostrar ~10min atrasado).
// O `score` da ESPN segue exatamente a regra do bolão: inclui prorrogação e
// NÃO inclui pênaltis (shootout vem separado em `shootoutScore`).
// O chamador (api/live.ts) é responsável pelo cache em banco — aqui só busca e mapeia.

import type { Match } from './schema.js'

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

// nomes da ESPN → nomes do nosso banco (feed fixturedownload)
const ESPN_ALIASES: Record<string, string> = {
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Cape Verde': 'Cabo Verde',
  Iran: 'IR Iran',
  'Ivory Coast': "Côte d'Ivoire",
  'South Korea': 'Korea Republic',
  'United States': 'USA',
}

const DAY_MS = 86_400_000

interface EspnEvent {
  id: string
  date: string
  competitions: {
    status: { displayClock?: string; type: { name: string; state: string; completed: boolean } }
    competitors: {
      homeAway: 'home' | 'away'
      score?: string
      team: { displayName: string }
    }[]
  }[]
}

export interface LiveScore {
  matchId: number
  status: 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  homeScore: number
  awayScore: number
  // relógio da ESPN, ex.: "88'" ou "45'+4'" (só em jogo rolando)
  clock?: string | null
}

function mapToOurMatch(
  home: string,
  away: string,
  kickoff: number,
  ours: Match[],
): { matchId: number; swap: boolean } | null {
  const nearKickoff = (m: Match) => Math.abs(m.kickoffAt.getTime() - kickoff) < DAY_MS
  const direct = ours.find((m) => m.homeTeam === home && m.awayTeam === away && nearKickoff(m))
  if (direct) return { matchId: direct.id, swap: false }
  const swapped = ours.find((m) => m.homeTeam === away && m.awayTeam === home && nearKickoff(m))
  if (swapped) return { matchId: swapped.id, swap: true }
  // mata-mata ainda com placeholder no banco (admin não rodou o feed): casa pelo
  // horário exato, mas só quando não há jogo simultâneo que cause ambiguidade
  const sameTime = ours.filter((m) => m.kickoffAt.getTime() === kickoff)
  if (sameTime.length === 1) return { matchId: sameTime[0].id, swap: false }
  return null
}

async function fetchDay(day: string): Promise<EspnEvent[]> {
  const res = await fetch(`${ESPN_SCOREBOARD}?dates=${day}`)
  if (!res.ok) throw new Error(`ESPN respondeu HTTP ${res.status}`)
  const data = (await res.json()) as { events?: EspnEvent[] }
  return data.events ?? []
}

export async function fetchLiveScores(ourMatches: Match[]): Promise<LiveScore[]> {
  // ontem + hoje (UTC): cobre jogos da madrugada e o cron diário de varredura
  const now = Date.now()
  const day = (t: number) => new Date(t).toISOString().slice(0, 10).replaceAll('-', '')
  const [yesterday, today] = await Promise.all([fetchDay(day(now - DAY_MS)), fetchDay(day(now))])
  const events = new Map<string, EspnEvent>()
  for (const ev of [...yesterday, ...today]) events.set(ev.id, ev)

  const scores: LiveScore[] = []
  for (const ev of events.values()) {
    const comp = ev.competitions?.[0]
    if (!comp) continue
    const { state, name, completed } = comp.status.type
    let status: LiveScore['status']
    if (state === 'in') status = name === 'STATUS_HALFTIME' ? 'PAUSED' : 'IN_PLAY'
    else if (state === 'post' && completed) status = 'FINISHED'
    else continue // pré-jogo, adiado, cancelado…

    const home = comp.competitors.find((c) => c.homeAway === 'home')
    const away = comp.competitors.find((c) => c.homeAway === 'away')
    if (!home?.score || !away?.score) continue
    const homeScore = Number(home.score)
    const awayScore = Number(away.score)
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) continue

    const mapped = mapToOurMatch(
      ESPN_ALIASES[home.team.displayName] ?? home.team.displayName,
      ESPN_ALIASES[away.team.displayName] ?? away.team.displayName,
      new Date(ev.date).getTime(),
      ourMatches,
    )
    if (!mapped) continue
    scores.push({
      matchId: mapped.matchId,
      status,
      homeScore: mapped.swap ? awayScore : homeScore,
      awayScore: mapped.swap ? homeScore : awayScore,
      clock: status === 'IN_PLAY' ? (comp.status.displayClock ?? null) : null,
    })
  }
  return scores
}
