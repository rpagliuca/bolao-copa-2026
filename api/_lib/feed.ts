// Feed oficial de jogos da Copa 2026 (fixturedownload.com) — fonte compartilhada
// entre o seed (scripts/seed.ts) e a sincronização via painel admin (api/admin/feed-sync.ts).

import type { Match } from './schema.js'

export const FEED_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026'

export interface SourceMatch {
  MatchNumber: number
  RoundNumber: number
  DateUtc: string
  HomeTeam: string
  AwayTeam: string
  Group: string | null
  HomeTeamScore: number | null
  AwayTeamScore: number | null
}

export interface FeedRow {
  id: number
  phase: string
  homeTeam: string
  awayTeam: string
  kickoffAt: Date
  homeScore: number | null
  awayScore: number | null
}

export function buildFeedRows(source: SourceMatch[]): FeedRow[] {
  const round8 = source.filter((m) => m.RoundNumber === 8).sort((a, b) => a.DateUtc.localeCompare(b.DateUtc))
  const finalMatchNumber = round8.at(-1)?.MatchNumber

  function phaseOf(m: SourceMatch): string {
    if (m.Group) return m.Group.replace('Group', 'Grupo')
    switch (m.RoundNumber) {
      case 4: return 'Dezesseis avos'
      case 5: return 'Oitavas de final'
      case 6: return 'Quartas de final'
      case 7: return 'Semifinal'
      case 8: return m.MatchNumber === finalMatchNumber ? 'Final' : 'Disputa do 3º lugar'
      default: return `Rodada ${m.RoundNumber}`
    }
  }

  return source.map((m) => ({
    id: m.MatchNumber,
    phase: phaseOf(m),
    homeTeam: m.HomeTeam,
    awayTeam: m.AwayTeam,
    kickoffAt: new Date(m.DateUtc.replace(' ', 'T')),
    homeScore: m.HomeTeamScore,
    awayScore: m.AwayTeamScore,
  }))
}

export async function fetchFeed(): Promise<FeedRow[]> {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`feed respondeu HTTP ${res.status}`)
  const data: unknown = await res.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error('feed vazio ou em formato inesperado')
  for (const m of data) {
    if (
      !Number.isInteger(m?.MatchNumber) ||
      typeof m?.DateUtc !== 'string' ||
      typeof m?.HomeTeam !== 'string' ||
      typeof m?.AwayTeam !== 'string'
    ) {
      throw new Error('feed em formato inesperado')
    }
  }
  return buildFeedRows(data as SourceMatch[])
}

export type FeedField = 'phase' | 'homeTeam' | 'awayTeam' | 'kickoffAt' | 'homeScore' | 'awayScore'

export interface FieldChange {
  field: FeedField
  // kickoffAt viaja como ISO string; demais campos no tipo nativo
  from: string | number | null
  to: string | number | null
}

export interface FeedChange {
  matchId: number
  kind: 'create' | 'update'
  // estado final do jogo segundo o feed, para exibição no diff
  phase: string
  homeTeam: string
  awayTeam: string
  fields: FieldChange[]
}

// Placar já lançado no banco NUNCA é alterado pelo feed (resultados são manuais e
// incluem prorrogação); o feed só preenche placar onde ainda não há nenhum.
export function computeFeedDiff(rows: FeedRow[], existing: Match[]): FeedChange[] {
  const byId = new Map(existing.map((m) => [m.id, m]))
  const changes: FeedChange[] = []

  for (const row of rows) {
    const cur = byId.get(row.id)
    const fields: FieldChange[] = []

    if (!cur) {
      fields.push(
        { field: 'phase', from: null, to: row.phase },
        { field: 'homeTeam', from: null, to: row.homeTeam },
        { field: 'awayTeam', from: null, to: row.awayTeam },
        { field: 'kickoffAt', from: null, to: row.kickoffAt.toISOString() },
      )
      if (row.homeScore !== null) fields.push({ field: 'homeScore', from: null, to: row.homeScore })
      if (row.awayScore !== null) fields.push({ field: 'awayScore', from: null, to: row.awayScore })
      changes.push({ matchId: row.id, kind: 'create', phase: row.phase, homeTeam: row.homeTeam, awayTeam: row.awayTeam, fields })
      continue
    }

    if (cur.phase !== row.phase) fields.push({ field: 'phase', from: cur.phase, to: row.phase })
    if (cur.homeTeam !== row.homeTeam) fields.push({ field: 'homeTeam', from: cur.homeTeam, to: row.homeTeam })
    if (cur.awayTeam !== row.awayTeam) fields.push({ field: 'awayTeam', from: cur.awayTeam, to: row.awayTeam })
    if (cur.kickoffAt.getTime() !== row.kickoffAt.getTime()) {
      fields.push({ field: 'kickoffAt', from: cur.kickoffAt.toISOString(), to: row.kickoffAt.toISOString() })
    }
    if (cur.homeScore === null && cur.awayScore === null && row.homeScore !== null && row.awayScore !== null) {
      fields.push(
        { field: 'homeScore', from: null, to: row.homeScore },
        { field: 'awayScore', from: null, to: row.awayScore },
      )
    }

    if (fields.length > 0) {
      changes.push({ matchId: row.id, kind: 'update', phase: row.phase, homeTeam: row.homeTeam, awayTeam: row.awayTeam, fields })
    }
  }

  return changes
}
