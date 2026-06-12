import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { audit, fmtScore } from '../_lib/audit.js'
import { requireAdmin } from '../_lib/auth.js'
import { db } from '../_lib/db.js'
import { matches, type Match } from '../_lib/schema.js'

function parseScore(v: unknown): number | null | undefined {
  if (v === null || v === '') return null
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99) return v
  return undefined
}

function describeMatchChange(before: Match, after: Match): string {
  const parts: string[] = []
  if (before.homeScore !== after.homeScore || before.awayScore !== after.awayScore) {
    parts.push(`placar ${fmtScore(before.homeScore, before.awayScore)} → ${fmtScore(after.homeScore, after.awayScore)}`)
  }
  if (before.kickoffAt.getTime() !== after.kickoffAt.getTime()) {
    parts.push(`início ${before.kickoffAt.toISOString()} → ${after.kickoffAt.toISOString()}`)
  }
  if (before.phase !== after.phase) parts.push(`fase "${before.phase}" → "${after.phase}"`)
  if (before.homeTeam !== after.homeTeam || before.awayTeam !== after.awayTeam) {
    parts.push(`times ${before.homeTeam} x ${before.awayTeam} → ${after.homeTeam} x ${after.awayTeam}`)
  }
  return parts.join('; ')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const all = await db.select().from(matches).orderBy(asc(matches.kickoffAt), asc(matches.id))
    return res.json({ matches: all })
  }

  if (req.method === 'POST') {
    const { id, phase, homeTeam, awayTeam, kickoffAt } = req.body ?? {}
    if (!Number.isInteger(id) || !phase || !homeTeam || !awayTeam || !kickoffAt) {
      return res.status(400).json({ error: 'Campos obrigatórios: id, phase, homeTeam, awayTeam, kickoffAt' })
    }
    const kickoff = new Date(kickoffAt)
    if (Number.isNaN(kickoff.getTime())) return res.status(400).json({ error: 'kickoffAt inválido' })
    const [created] = await db
      .insert(matches)
      .values({ id, phase, homeTeam, awayTeam, kickoffAt: kickoff })
      .returning()
    await audit(admin, {
      action: 'match.create',
      entityType: 'match',
      entityId: created.id,
      matchId: created.id,
      summary: `Criou o jogo #${created.id} ${created.homeTeam} x ${created.awayTeam} (${created.phase})`,
      after: created,
    })
    return res.status(201).json({ match: created })
  }

  // PUT: atualiza dados do jogo e/ou lança resultado (hora de início sempre presente no registro)
  if (req.method === 'PUT') {
    const body = req.body ?? {}
    if (!Number.isInteger(body.id)) return res.status(400).json({ error: 'id inválido' })
    const set: Record<string, unknown> = {}
    if (typeof body.phase === 'string' && body.phase) set.phase = body.phase
    if (typeof body.homeTeam === 'string' && body.homeTeam) set.homeTeam = body.homeTeam
    if (typeof body.awayTeam === 'string' && body.awayTeam) set.awayTeam = body.awayTeam
    if (body.kickoffAt !== undefined) {
      const kickoff = new Date(body.kickoffAt)
      if (Number.isNaN(kickoff.getTime())) return res.status(400).json({ error: 'kickoffAt inválido' })
      set.kickoffAt = kickoff
    }
    if ('homeScore' in body) {
      const v = parseScore(body.homeScore)
      if (v === undefined) return res.status(400).json({ error: 'homeScore inválido' })
      set.homeScore = v
    }
    if ('awayScore' in body) {
      const v = parseScore(body.awayScore)
      if (v === undefined) return res.status(400).json({ error: 'awayScore inválido' })
      set.awayScore = v
    }
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada para atualizar' })
    const [before] = await db.select().from(matches).where(eq(matches.id, body.id))
    if (!before) return res.status(404).json({ error: 'Jogo não encontrado' })
    const [updated] = await db.update(matches).set(set).where(eq(matches.id, body.id)).returning()
    const changes = describeMatchChange(before, updated)
    if (changes) {
      await audit(admin, {
        action: 'match.update',
        entityType: 'match',
        entityId: updated.id,
        matchId: updated.id,
        summary: `Jogo #${updated.id} ${updated.homeTeam} x ${updated.awayTeam}: ${changes}`,
        before,
        after: updated,
      })
    }
    return res.json({ match: updated })
  }

  res.status(405).json({ error: 'Método não permitido' })
}
