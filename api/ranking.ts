import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { bets, matches, users } from './_lib/schema.js'
import { betPoints, isIgnored, POINTS_EXACT } from './_lib/scoring.js'

function isGrupo(phase: string) {
  return phase.startsWith('Grupo')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireApproved(req, res)
  if (!user) return

  const fase = (req.query.fase as string) || 'matamata'

  const [approvedUsers, allMatches, allBets] = await Promise.all([
    db.select().from(users).where(eq(users.status, 'approved')),
    db.select().from(matches),
    db.select().from(bets),
  ])

  const filteredMatches = allMatches.filter((m) => {
    if (fase === 'grupos') return isGrupo(m.phase)
    if (fase === 'matamata') return !isGrupo(m.phase)
    return true
  })

  const matchById = new Map(filteredMatches.map((m) => [m.id, m]))

  const rows = approvedUsers.map((u) => {
    let points = 0
    let exact = 0
    let outcome = 0
    let counted = 0
    for (const b of allBets) {
      if (b.userId !== u.id) continue
      const m = matchById.get(b.matchId)
      if (!m) continue
      const p = betPoints(b, m)
      if (p === null) continue
      if (!isIgnored(b, m)) counted++
      points += p
      if (p === POINTS_EXACT) exact++
      else if (p > 0) outcome++
    }
    return { userId: u.id, name: u.name, photoUrl: u.photoUrl, points, exact, outcome, counted, position: 0 }
  })

  // desempate: mais placares exatos fica na frente; persistindo o empate, dividem a posição
  rows.sort((a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name))
  rows.forEach((row, i) => {
    const prev = rows[i - 1]
    row.position = prev && prev.points === row.points && prev.exact === row.exact ? prev.position : i + 1
  })

  res.json({ ranking: rows })
}
