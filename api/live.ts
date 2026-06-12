import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from './_lib/db.js'
import { fetchLiveScores, type LiveScore } from './_lib/livescore.js'
import { liveCache, matches } from './_lib/schema.js'

// Placar ao vivo, público (não expõe nada além do placar dos jogos).
// Camadas de proteção do limite gratuito do football-data (10 req/min):
// 1. CDN da Vercel cacheia a resposta por 20s (s-maxage)
// 2. cache em banco compartilhado entre todas as functions, renovado a cada 25s
const FRESH_MS = 25_000

interface Payload {
  scores: LiveScore[]
}

function serve(res: VercelResponse, payload: Payload, fetchedAt: Date) {
  res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60')
  res.json({ ...payload, fetchedAt: fetchedAt.toISOString() })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const [cached] = await db.select().from(liveCache).where(eq(liveCache.id, 1))
  if (cached && Date.now() - cached.fetchedAt.getTime() < FRESH_MS) {
    return serve(res, cached.payload as Payload, cached.fetchedAt)
  }

  try {
    const ourMatches = await db.select().from(matches)
    const scores = await fetchLiveScores(ourMatches)
    const payload: Payload = { scores }
    const fetchedAt = new Date()
    await db
      .insert(liveCache)
      .values({ id: 1, payload, fetchedAt })
      .onConflictDoUpdate({ target: liveCache.id, set: { payload, fetchedAt } })
    return serve(res, payload, fetchedAt)
  } catch (e: any) {
    // upstream falhou: melhor servir o último placar conhecido do que erro
    if (cached) return serve(res, cached.payload as Payload, cached.fetchedAt)
    return res.status(502).json({ error: `Placar ao vivo indisponível: ${e.message}` })
  }
}
