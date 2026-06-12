import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { audit, fmtScore } from '../_lib/audit.js'
import { requireAdmin } from '../_lib/auth.js'
import { db } from '../_lib/db.js'
import { computeFeedDiff, fetchFeed, type FeedChange, type FeedField, type FieldChange } from '../_lib/feed.js'
import { matches, type Match } from '../_lib/schema.js'

const FIELDS: FeedField[] = ['phase', 'homeTeam', 'awayTeam', 'kickoffAt', 'homeScore', 'awayScore']

function validToValue(field: FeedField, to: unknown): boolean {
  if (field === 'homeScore' || field === 'awayScore') {
    return to === null || (typeof to === 'number' && Number.isInteger(to) && to >= 0 && to <= 99)
  }
  if (field === 'kickoffAt') return typeof to === 'string' && !Number.isNaN(new Date(to).getTime())
  return typeof to === 'string' && to.length > 0
}

// a prévia mostrada ao admin só pode ser aplicada se o banco ainda estiver como na prévia
function matchesCurrent(field: FeedField, cur: Match, from: unknown): boolean {
  if (field === 'kickoffAt') return typeof from === 'string' && cur.kickoffAt.getTime() === new Date(from).getTime()
  return cur[field] === from
}

function describeFields(cur: Match | undefined, fields: FieldChange[]): string {
  const get = (f: FeedField) => fields.find((c) => c.field === f)
  const parts: string[] = []
  const home = get('homeTeam')
  const away = get('awayTeam')
  if (home || away) {
    const fromHome = (home?.from ?? cur?.homeTeam) as string
    const fromAway = (away?.from ?? cur?.awayTeam) as string
    const toHome = (home?.to ?? cur?.homeTeam) as string
    const toAway = (away?.to ?? cur?.awayTeam) as string
    parts.push(cur ? `times ${fromHome} x ${fromAway} → ${toHome} x ${toAway}` : `times ${toHome} x ${toAway}`)
  }
  const kickoff = get('kickoffAt')
  if (kickoff) parts.push(cur ? `início ${kickoff.from} → ${kickoff.to}` : `início ${kickoff.to}`)
  const phase = get('phase')
  if (phase) parts.push(cur ? `fase "${phase.from}" → "${phase.to}"` : `fase "${phase.to}"`)
  const hs = get('homeScore')
  const as = get('awayScore')
  if (hs || as) {
    parts.push(`placar ${fmtScore((hs?.to ?? null) as number | null, (as?.to ?? null) as number | null)}`)
  }
  return parts.join('; ')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  // GET: baixa o feed e devolve a prévia dos ajustes, sem tocar no banco
  if (req.method === 'GET') {
    let rows
    try {
      rows = await fetchFeed()
    } catch (e: any) {
      return res.status(502).json({ error: `Não consegui baixar o feed de jogos: ${e.message}` })
    }
    const existing = await db.select().from(matches)
    const changes = computeFeedDiff(rows, existing)
    return res.json({ changes, feedCount: rows.length })
  }

  // POST: aplica os ajustes aprovados pelo admin (o diff exibido volta no body)
  if (req.method === 'POST') {
    const changes = req.body?.changes
    if (!Array.isArray(changes) || changes.length === 0 || changes.length > 300) {
      return res.status(400).json({ error: 'Envie a lista de ajustes aprovados (changes)' })
    }
    for (const c of changes as FeedChange[]) {
      if (!Number.isInteger(c?.matchId) || !Array.isArray(c?.fields) || c.fields.length === 0) {
        return res.status(400).json({ error: 'Ajuste inválido na lista' })
      }
      for (const f of c.fields) {
        if (!FIELDS.includes(f?.field) || !validToValue(f.field, f.to)) {
          return res.status(400).json({ error: `Campo inválido no jogo #${c.matchId}` })
        }
      }
    }

    let applied = 0
    const skipped: { matchId: number; reason: string }[] = []

    for (const c of changes as FeedChange[]) {
      const [cur] = await db.select().from(matches).where(eq(matches.id, c.matchId))

      if (!cur) {
        const get = (f: FeedField) => c.fields.find((x) => x.field === f)?.to
        const phase = get('phase')
        const homeTeam = get('homeTeam')
        const awayTeam = get('awayTeam')
        const kickoffAt = get('kickoffAt')
        if (typeof phase !== 'string' || typeof homeTeam !== 'string' || typeof awayTeam !== 'string' || typeof kickoffAt !== 'string') {
          skipped.push({ matchId: c.matchId, reason: 'jogo novo sem dados completos' })
          continue
        }
        const [created] = await db
          .insert(matches)
          .values({
            id: c.matchId,
            phase,
            homeTeam,
            awayTeam,
            kickoffAt: new Date(kickoffAt),
            homeScore: (get('homeScore') ?? null) as number | null,
            awayScore: (get('awayScore') ?? null) as number | null,
          })
          .returning()
        await audit(admin, {
          action: 'match.feed-sync',
          entityType: 'match',
          entityId: created.id,
          matchId: created.id,
          summary: `Criou via feed o jogo #${created.id} ${created.homeTeam} x ${created.awayTeam} (${created.phase})`,
          after: created,
        })
        applied++
        continue
      }

      // se o jogo mudou no banco depois da prévia (outro admin, outro feed), não aplica às cegas
      const conflict = c.fields.some((f) => !matchesCurrent(f.field, cur, f.from))
      if (conflict) {
        skipped.push({ matchId: c.matchId, reason: 'o jogo mudou desde a prévia — busque as atualizações de novo' })
        continue
      }

      const set: Record<string, unknown> = {}
      for (const f of c.fields) {
        set[f.field] = f.field === 'kickoffAt' ? new Date(f.to as string) : f.to
      }
      const [updated] = await db.update(matches).set(set).where(eq(matches.id, c.matchId)).returning()
      await audit(admin, {
        action: 'match.feed-sync',
        entityType: 'match',
        entityId: updated.id,
        matchId: updated.id,
        summary: `Atualizou via feed o jogo #${updated.id}: ${describeFields(cur, c.fields)}`,
        before: cur,
        after: updated,
      })
      applied++
    }

    return res.json({ applied, skipped })
  }

  res.status(405).json({ error: 'Método não permitido' })
}
