import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { requireAdmin } from '../_lib/auth'
import { db } from '../_lib/db'
import { matches } from '../_lib/schema'

function parseScore(v: unknown): number | null | undefined {
  if (v === null || v === '') return null
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99) return v
  return undefined
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
    const [updated] = await db.update(matches).set(set).where(eq(matches.id, body.id)).returning()
    if (!updated) return res.status(404).json({ error: 'Jogo não encontrado' })
    return res.json({ match: updated })
  }

  res.status(405).json({ error: 'Método não permitido' })
}
