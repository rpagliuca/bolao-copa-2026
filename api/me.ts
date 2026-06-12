import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUser, publicUser } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Não autenticado' })
  res.json({ user: publicUser(user) })
}
