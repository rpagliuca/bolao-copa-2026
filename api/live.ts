import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, isNull } from 'drizzle-orm'
import { audit } from './_lib/audit.js'
import { db } from './_lib/db.js'
import { fetchLiveScores, type LiveScore } from './_lib/livescore.js'
import { liveCache, matches, type Match } from './_lib/schema.js'

// Placar ao vivo, público (não expõe nada além do placar dos jogos).
// Fonte: ESPN (sem rate limit conhecido, mas educadamente cacheado igual):
// 1. CDN da Vercel cacheia a resposta por 20s (s-maxage)
// 2. cache em banco compartilhado entre todas as functions, renovado a cada 25s
const FRESH_MS = 25_000

interface Payload {
  scores: LiveScore[]
}

// jogo encerrado no football-data + sem placar no banco → pré-popula o resultado
// como "sistema" (audit log com actor null); admin ajusta depois se necessário.
// Placar já existente (lançado por admin) nunca é tocado.
async function autoFillFinished(scores: LiveScore[], ourMatches: Match[]) {
  for (const s of scores) {
    if (s.status !== 'FINISHED') continue
    const m = ourMatches.find((x) => x.id === s.matchId)
    if (!m || m.homeScore !== null || m.awayScore !== null) continue
    // condição repetida no WHERE: refreshes concorrentes não gravam/auditam em dobro
    const [updated] = await db
      .update(matches)
      .set({ homeScore: s.homeScore, awayScore: s.awayScore })
      .where(and(eq(matches.id, m.id), isNull(matches.homeScore), isNull(matches.awayScore)))
      .returning()
    if (!updated) continue
    await audit(null, {
      action: 'match.result-auto',
      entityType: 'match',
      entityId: m.id,
      matchId: m.id,
      summary: `🤖 Resultado preenchido automaticamente pelo placar ao vivo (ESPN): ${m.homeTeam} ${s.homeScore}x${s.awayScore} ${m.awayTeam} — admins podem ajustar se necessário`,
      before: m,
      after: updated,
    })
  }
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
    try {
      await autoFillFinished(scores, ourMatches)
    } catch {
      // falha no auto-preenchimento não pode derrubar o placar ao vivo; o
      // próximo refresh (ou o cron diário) tenta de novo
    }
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
