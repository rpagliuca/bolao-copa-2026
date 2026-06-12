import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { audit } from '../_lib/audit.js'
import { publicUser, requireAdmin } from '../_lib/auth.js'
import { db } from '../_lib/db.js'
import { users } from '../_lib/schema.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const all = await db.select().from(users).orderBy(asc(users.createdAt))
    return res.json({ users: all.map(publicUser) })
  }

  if (req.method === 'PUT') {
    const { id, status, isAdmin } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' })
    const set: Record<string, unknown> = {}
    if (status === 'pending' || status === 'approved') set.status = status
    if (typeof isAdmin === 'boolean') set.isAdmin = isAdmin
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada para atualizar' })
    if (id === admin.id && (set.isAdmin === false || set.status === 'pending')) {
      return res.status(400).json({ error: 'Você não pode remover seu próprio acesso' })
    }
    // promover a admin implica aprovar o usuário
    if (set.isAdmin === true) set.status = 'approved'
    const [before] = await db.select().from(users).where(eq(users.id, id))
    if (!before) return res.status(404).json({ error: 'Usuário não encontrado' })
    const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning()
    const parts: string[] = []
    let action = 'user.update'
    if (before.status !== updated.status) {
      parts.push(updated.status === 'approved' ? 'aprovou o acesso' : 'suspendeu o acesso')
      action = updated.status === 'approved' ? 'user.approve' : 'user.suspend'
    }
    if (before.isAdmin !== updated.isAdmin) {
      parts.push(updated.isAdmin ? 'promoveu a admin' : 'removeu o acesso de admin')
      action = updated.isAdmin ? 'user.promote' : 'user.demote'
    }
    if (parts.length > 0) {
      await audit(admin, {
        action,
        entityType: 'user',
        entityId: updated.id,
        summary: `${parts.join(' e ')} de ${updated.name} (${updated.email})`,
        before: publicUser(before),
        after: publicUser(updated),
      })
    }
    return res.json({ user: publicUser(updated) })
  }

  res.status(405).json({ error: 'Método não permitido' })
}
