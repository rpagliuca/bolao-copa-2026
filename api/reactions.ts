import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { betReactions, bets } from './_lib/schema.js'

// aceita qualquer emoji único (incl. sequências com tom de pele, bandeiras, ZWJ)
// RegExp construída em runtime porque \p{RGI_Emoji} + flag v exigem target ES2024
const EMOJI_RE = new RegExp('^\\p{RGI_Emoji}$', 'v')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireApproved(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { betId, emoji } = req.body ?? {}
  if (!Number.isInteger(betId) || typeof emoji !== 'string' || emoji.length > 20 || !EMOJI_RE.test(emoji)) {
    return res.status(400).json({ error: 'betId e emoji válidos são obrigatórios' })
  }
  const [bet] = await db.select().from(bets).where(eq(bets.id, betId))
  if (!bet) return res.status(404).json({ error: 'Palpite não encontrado' })

  // toggle: reagir de novo com o mesmo emoji remove a reação
  const [existing] = await db
    .select()
    .from(betReactions)
    .where(and(eq(betReactions.betId, betId), eq(betReactions.userId, user.id), eq(betReactions.emoji, emoji)))
  if (existing) {
    await db.delete(betReactions).where(eq(betReactions.id, existing.id))
    return res.json({ reacted: false })
  }
  await db.insert(betReactions).values({ betId, userId: user.id, emoji })
  return res.json({ reacted: true })
}
