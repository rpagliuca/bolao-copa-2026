import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { db } from './db'
import { users, type User } from './schema'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').toLowerCase()

export async function getUser(req: VercelRequest): Promise<User | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: CLIENT_ID,
    })
    if (!payload.sub || !payload.email) return null
    const email = String(payload.email).toLowerCase()
    const isAdmin = ADMIN_EMAIL !== '' && email === ADMIN_EMAIL
    const [user] = await db
      .insert(users)
      .values({
        googleSub: payload.sub,
        email,
        name: String(payload.name ?? email),
        photoUrl: (payload.picture as string | undefined) ?? null,
        status: isAdmin ? 'approved' : 'pending',
        isAdmin,
      })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: {
          name: String(payload.name ?? email),
          photoUrl: (payload.picture as string | undefined) ?? null,
          // garante que o admin definido por env nunca fique trancado para fora
          ...(isAdmin ? { isAdmin: true, status: 'approved' as const } : {}),
        },
      })
      .returning()
    return user
  } catch {
    return null
  }
}

export async function requireApproved(req: VercelRequest, res: VercelResponse): Promise<User | null> {
  const user = await getUser(req)
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  if (user.status !== 'approved') {
    res.status(403).json({ error: 'Usuário aguardando aprovação' })
    return null
  }
  return user
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<User | null> {
  const user = await requireApproved(req, res)
  if (!user) return null
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Apenas administradores' })
    return null
  }
  return user
}

export function publicUser(u: User) {
  const { id, name, email, photoUrl, status, isAdmin } = u
  return { id, name, email, photoUrl, status, isAdmin }
}
