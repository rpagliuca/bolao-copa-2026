import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { audit } from './_lib/audit.js'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { auditLogs, bets, matches } from './_lib/schema.js'
import { isIgnored } from './_lib/scoring.js'

function validScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }
  const user = await requireApproved(req, res)
  if (!user) return

  const { matchId, homeScore, awayScore } = req.body ?? {}
  if (!Number.isInteger(matchId) || !validScore(homeScore) || !validScore(awayScore)) {
    return res.status(400).json({ error: 'Palpite inválido' })
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return res.status(404).json({ error: 'Jogo não encontrado' })

  const [existing] = await db
    .select()
    .from(bets)
    .where(and(eq(bets.userId, user.id), eq(bets.matchId, matchId)))

  // Alteração de palpite existente após o kickoff é bloqueada.
  // Primeiro palpite após o kickoff ainda é permitido (ficará "ignorado").
  if (existing && new Date() >= match.kickoffAt) {
    return res.status(403).json({ error: 'Não é possível alterar palpite após o início do jogo' })
  }

  const [saved] = await db
    .insert(bets)
    .values({ userId: user.id, matchId, homeScore, awayScore, betAt: new Date(), origin: 'app' })
    .onConflictDoUpdate({
      target: [bets.userId, bets.matchId],
      set: { homeScore, awayScore, betAt: new Date(), origin: 'app', invalidatedByAdmin: false },
    })
    .returning()

  if (existing) {
    // Na primeira alteração: grava um log bet.origin backdatado com a data original do palpite
    const [priorUpdate] = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'bet'), eq(auditLogs.entityId, saved.id), eq(auditLogs.action, 'bet.update')))
      .limit(1)
    if (!priorUpdate) {
      await audit(null, {
        action: 'bet.origin',
        entityType: 'bet',
        entityId: saved.id,
        matchId,
        summary: `📌 Palpite original registrado pelo próprio jogador no app`,
        createdAt: existing.betAt,
      })
    }

    await audit(user, {
      action: 'bet.update',
      entityType: 'bet',
      entityId: saved.id,
      matchId,
      summary: `Alterou o palpite: ${existing.homeScore}x${existing.awayScore} → ${homeScore}x${awayScore}`,
      before: existing,
      after: saved,
    })
  }

  res.json({
    bet: {
      homeScore: saved.homeScore,
      awayScore: saved.awayScore,
      betAt: saved.betAt.toISOString(),
      ignored: isIgnored(saved, match),
    },
  })
}
