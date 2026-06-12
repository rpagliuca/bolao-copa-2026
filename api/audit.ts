import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, desc, eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { auditLogs, matches, users, type AuditLog } from './_lib/schema.js'

const ENTITY_TYPES = ['match', 'bet', 'user'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

function serialize(log: AuditLog, actorName: string) {
  return {
    id: log.id,
    actorName,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    matchId: log.matchId,
    summary: log.summary,
    before: log.before,
    after: log.after,
    createdAt: log.createdAt.toISOString(),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireApproved(req, res)
  if (!user) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const entityType = req.query.entityType as EntityType | undefined
  const entityId = req.query.entityId ? Number(req.query.entityId) : undefined

  // histórico de um objeto específico
  if (entityType !== undefined || entityId !== undefined) {
    if (!entityType || !ENTITY_TYPES.includes(entityType) || !Number.isInteger(entityId)) {
      return res.status(400).json({ error: 'entityType e entityId inválidos' })
    }
    if (entityType === 'user' && !user.isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores' })
    }
    const rows = await db
      .select({ log: auditLogs, actorName: users.name })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId!)))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    if (rows.length === 0) return res.json({ logs: [] })

    // palpites seguem a mesma regra de visibilidade do app:
    // só o dono (ou admin) vê antes de a bola rolar
    if (entityType === 'bet' && !user.isAdmin) {
      const snapshot = (rows[0].log.after ?? rows[0].log.before) as { userId?: number } | null
      const ownerId = snapshot?.userId
      if (ownerId !== user.id) {
        const matchId = rows[0].log.matchId
        const [match] = matchId
          ? await db.select().from(matches).where(eq(matches.id, matchId))
          : []
        if (!match || match.kickoffAt.getTime() > Date.now()) {
          return res.status(403).json({ error: 'Histórico disponível após o início do jogo' })
        }
      }
    }
    return res.json({ logs: rows.map((r) => serialize(r.log, r.actorName)) })
  }

  // visão centralizada: só admin
  if (!user.isAdmin) return res.status(403).json({ error: 'Apenas administradores' })
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
  const rows = await db
    .select({ log: auditLogs, actorName: users.name })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit)
  res.json({ logs: rows.map((r) => serialize(r.log, r.actorName)) })
}
