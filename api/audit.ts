import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, desc, eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { auditLogs, bets, matches, users, type AuditLog } from './_lib/schema.js'

const ENTITY_TYPES = ['match', 'bet', 'user'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

// quando o db:seed da carga inicial rodou (12/06/2026 ~10h de Brasília)
const SEED_AT = '2026-06-12T13:00:00.000Z'

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

// evento sintético de criação para objetos que nasceram fora da trilha de
// auditoria (seed inicial, palpite do próprio jogador, login)
async function creationEvent(entityType: EntityType, entityId: number, originalBetAt?: string) {
  const base = { id: 0, entityType, entityId, before: null, after: null, matchId: null as number | null }

  if (entityType === 'match') {
    const [match] = await db.select().from(matches).where(eq(matches.id, entityId))
    if (!match) return null
    return {
      ...base,
      matchId: match.id,
      actorName: 'Sistema',
      action: 'match.seed',
      summary: '📌 Jogo inserido automaticamente na carga inicial do bolão (horário aproximado)',
      createdAt: SEED_AT,
    }
  }

  if (entityType === 'bet') {
    const [bet] = await db.select().from(bets).where(eq(bets.id, entityId))
    if (!bet) return null
    const [owner] = await db.select().from(users).where(eq(users.id, bet.userId))
    const ownerName = owner?.name ?? `usuário #${bet.userId}`
    return {
      ...base,
      matchId: bet.matchId,
      actorName: bet.origin === 'app' ? ownerName : 'Admin',
      action: 'bet.origin',
      summary:
        bet.origin === 'app'
          ? `📌 Palpite original registrado pelo próprio jogador no app`
          : `📌 Palpite lançado por admin em nome de ${ownerName}`,
      // originalBetAt = betAt do before do log mais antigo (antes de qualquer alteração)
      createdAt: originalBetAt ?? bet.betAt.toISOString(),
    }
  }

  const [u] = await db.select().from(users).where(eq(users.id, entityId))
  if (!u) return null
  return {
    ...base,
    actorName: u.name,
    action: 'user.signup',
    summary: '📌 Entrou no bolão fazendo login com Google',
    createdAt: u.createdAt.toISOString(),
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
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId!)))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    // palpites são públicos, então o histórico deles também é
    const logs = rows.map((r) => serialize(r.log, r.actorName ?? '🤖 Sistema'))
    // criação real já registrada (match.create / bet.create) dispensa o evento sintético
    const hasCreate = rows.some((r) => r.log.action === `${entityType}.create`)
    if (!hasCreate) {
      // Para palpites com histórico: recupera betAt original do before do log mais antigo
      // (rows está em desc; o último elemento é o registro mais antigo)
      let originalBetAt: string | undefined
      if (entityType === 'bet' && rows.length > 0) {
        const b = rows[rows.length - 1].log.before as Record<string, unknown> | null
        if (b?.betAt) originalBetAt = new Date(b.betAt as string).toISOString()
      }
      const creation = await creationEvent(entityType, entityId!, originalBetAt)
      if (creation) logs.push(creation) // lista está em ordem decrescente; criação é o mais antigo
    }
    return res.json({ logs })
  }

  // visão centralizada: só admin
  if (!user.isAdmin) return res.status(403).json({ error: 'Apenas administradores' })
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
  const rows = await db
    .select({ log: auditLogs, actorName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit)
  res.json({ logs: rows.map((r) => serialize(r.log, r.actorName ?? '🤖 Sistema')) })
}
