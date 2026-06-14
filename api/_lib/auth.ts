import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { db } from './db.js'
import { users, type User } from './schema.js'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').toLowerCase()

export function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? process.env.VITE_GOOGLE_CLIENT_ID ?? 'bolao-2026'
  return new TextEncoder().encode(secret)
}

export async function getUser(req: VercelRequest): Promise<User | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const alg = JSON.parse(Buffer.from(parts[0], 'base64url').toString()).alg
    if (alg === 'HS256') {
      // Sessão própria de longa duração
      const { payload } = await jwtVerify(token, getSessionKey(), { issuer: 'bolao' })
      if (!payload.sub) return null
      const userId = parseInt(String(payload.sub), 10)
      if (isNaN(userId)) return null
      const [user] = await db.select().from(users).where(eq(users.id, userId))
      return user ?? null
    }
    // ID token do Google (retrocompatibilidade com sessões abertas antes do fix)
    return await verifyGoogleToken(token)
  } catch {
    return null
  }
}

async function verifyGoogleToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
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
