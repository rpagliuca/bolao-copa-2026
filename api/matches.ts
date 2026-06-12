import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth'
import { db } from './_lib/db'
import { bets, matches, users } from './_lib/schema'
import { betPoints, isIgnored } from './_lib/scoring'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireApproved(req, res)
  if (!user) return

  const [allMatches, allBets] = await Promise.all([
    db.select().from(matches).orderBy(asc(matches.kickoffAt), asc(matches.id)),
    db
      .select({ bet: bets, userName: users.name, userPhoto: users.photoUrl })
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id)),
  ])

  const now = Date.now()
  const result = allMatches.map((m) => {
    const matchBets = allBets.filter((b) => b.bet.matchId === m.id)
    const mine = matchBets.find((b) => b.bet.userId === user.id)
    const started = m.kickoffAt.getTime() <= now
    return {
      id: m.id,
      phase: m.phase,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoffAt: m.kickoffAt.toISOString(),
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      started,
      finished: m.homeScore != null && m.awayScore != null,
      myBet: mine
        ? {
            homeScore: mine.bet.homeScore,
            awayScore: mine.bet.awayScore,
            betAt: mine.bet.betAt.toISOString(),
            ignored: isIgnored(mine.bet, m),
            points: betPoints(mine.bet, m),
          }
        : null,
      // palpites dos outros só ficam visíveis depois que a bola rola
      bets: started
        ? matchBets.map((b) => ({
            userId: b.bet.userId,
            userName: b.userName,
            userPhoto: b.userPhoto,
            homeScore: b.bet.homeScore,
            awayScore: b.bet.awayScore,
            origin: b.bet.origin,
            ignored: isIgnored(b.bet, m),
            points: betPoints(b.bet, m),
          }))
        : null,
    }
  })

  res.json({ matches: result })
}
