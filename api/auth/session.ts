import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose'
import { db } from '../_lib/db.js'
import { users } from '../_lib/schema.js'
import { getSessionKey } from '../_lib/auth.js'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').toLowerCase()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body as { idToken?: string }
  if (!body?.idToken) return res.status(400).json({ error: 'idToken obrigatório' })

  try {
    const { payload } = await jwtVerify(body.idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: CLIENT_ID,
    })

    if (!payload.sub || !payload.email) return res.status(401).json({ error: 'Token inválido' })

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
          ...(isAdmin ? { isAdmin: true, status: 'approved' as const } : {}),
        },
      })
      .returning()

    const token = await new SignJWT({ sub: String(user.id) })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('bolao')
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(getSessionKey())

    return res.status(200).json({ token })
  } catch {
    return res.status(401).json({ error: 'Token Google inválido' })
  }
}
