import type { VercelRequest, VercelResponse } from '@vercel/node'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '../_lib/auth.js'
import { db } from '../_lib/db.js'
import { bets, matches, users } from '../_lib/schema.js'
import { isIgnored } from '../_lib/scoring.js'

function validScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const matchId = req.query.matchId ? Number(req.query.matchId) : null
    const base = db
      .select({ bet: bets, userName: users.name, match: matches })
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id))
      .innerJoin(matches, eq(bets.matchId, matches.id))
      .orderBy(desc(bets.betAt))
    const rows = matchId ? await base.where(eq(bets.matchId, matchId)) : await base
    return res.json({
      bets: rows.map((r) => ({
        id: r.bet.id,
        userId: r.bet.userId,
        userName: r.userName,
        matchId: r.bet.matchId,
        matchLabel: `${r.match.homeTeam} x ${r.match.awayTeam}`,
        homeScore: r.bet.homeScore,
        awayScore: r.bet.awayScore,
        betAt: r.bet.betAt.toISOString(),
        origin: r.bet.origin,
        invalidatedByAdmin: r.bet.invalidatedByAdmin,
        ignored: isIgnored(r.bet, r.match),
      })),
    })
  }

  // POST: palpite avulso em nome de um jogador (importação de palpites do WhatsApp etc.).
  // betAt opcional permite registrar o momento real em que o palpite foi feito.
  if (req.method === 'POST') {
    const { userId, matchId, homeScore, awayScore, betAt } = req.body ?? {}
    if (!Number.isInteger(userId) || !Number.isInteger(matchId) || !validScore(homeScore) || !validScore(awayScore)) {
      return res.status(400).json({ error: 'Campos obrigatórios: userId, matchId, homeScore, awayScore' })
    }
    const when = betAt ? new Date(betAt) : new Date()
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'betAt inválido' })
    const [target] = await db.select().from(users).where(eq(users.id, userId))
    if (!target) return res.status(404).json({ error: 'Jogador não encontrado (precisa ter feito login ao menos uma vez)' })
    const [saved] = await db
      .insert(bets)
      .values({ userId, matchId, homeScore, awayScore, betAt: when, origin: 'admin' })
      .onConflictDoUpdate({
        target: [bets.userId, bets.matchId],
        set: { homeScore, awayScore, betAt: when, origin: 'admin', invalidatedByAdmin: false },
      })
      .returning()
    return res.status(201).json({ bet: saved })
  }

  if (req.method === 'PUT') {
    const { id, invalidatedByAdmin, homeScore, awayScore, betAt } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' })
    const set: Record<string, unknown> = {}
    if (typeof invalidatedByAdmin === 'boolean') set.invalidatedByAdmin = invalidatedByAdmin
    if (homeScore !== undefined) {
      if (!validScore(homeScore)) return res.status(400).json({ error: 'homeScore inválido' })
      set.homeScore = homeScore
    }
    if (awayScore !== undefined) {
      if (!validScore(awayScore)) return res.status(400).json({ error: 'awayScore inválido' })
      set.awayScore = awayScore
    }
    if (betAt !== undefined) {
      const when = new Date(betAt)
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'betAt inválido' })
      set.betAt = when
    }
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada para atualizar' })
    const [updated] = await db.update(bets).set(set).where(eq(bets.id, id)).returning()
    if (!updated) return res.status(404).json({ error: 'Palpite não encontrado' })
    return res.json({ bet: updated })
  }

  if (req.method === 'DELETE') {
    const id = Number(req.query.id ?? (req.body ?? {}).id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' })
    await db.delete(bets).where(eq(bets.id, id))
    return res.status(204).end()
  }

  res.status(405).json({ error: 'Método não permitido' })
}
