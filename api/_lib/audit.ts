import { db } from './db.js'
import { auditLogs, type User } from './schema.js'

interface AuditEntry {
  action: string
  entityType: 'match' | 'bet' | 'user'
  entityId: number
  matchId?: number | null
  summary: string
  before?: unknown
  after?: unknown
}

// actor null = ação automática do sistema (sem usuário)
export async function audit(actor: User | null, entry: AuditEntry) {
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    matchId: entry.matchId ?? null,
    summary: entry.summary,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })
}

export function fmtScore(home: number | null, away: number | null): string {
  return home == null || away == null ? 'sem placar' : `${home}x${away}`
}
