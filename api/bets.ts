import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { bets, matches } from './_lib/schema.js'
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

  // Palpite é permitido a qualquer momento; se feito após o início do jogo,
  // será marcado como "ignorado" a posteriori (modelo decidido com o Rafael).
  const [saved] = await db
    .insert(bets)
    .values({ userId: user.id, matchId, homeScore, awayScore, betAt: new Date(), origin: 'app' })
    .onConflictDoUpdate({
      target: [bets.userId, bets.matchId],
      set: { homeScore, awayScore, betAt: new Date(), origin: 'app', invalidatedByAdmin: false },
    })
    .returning()

  res.json({
    bet: {
      homeScore: saved.homeScore,
      awayScore: saved.awayScore,
      betAt: saved.betAt.toISOString(),
      ignored: isIgnored(saved, match),
    },
  })
}
