import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
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
    const [updated] = await db.update(users).set(set).where(eq(users.id, id)).returning()
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado' })
    return res.json({ user: publicUser(updated) })
  }

  res.status(405).json({ error: 'Método não permitido' })
}
