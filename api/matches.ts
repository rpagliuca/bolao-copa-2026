import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { requireApproved } from './_lib/auth.js'
import { db } from './_lib/db.js'
import { betReactions, bets, matches, users } from './_lib/schema.js'
import { betPoints, isIgnored } from './_lib/scoring.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireApproved(req, res)
  if (!user) return

  const [allMatches, allBets, allReactions] = await Promise.all([
    db.select().from(matches).orderBy(asc(matches.kickoffAt), asc(matches.id)),
    db
      .select({ bet: bets, userName: users.name, userPhoto: users.photoUrl })
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id)),
    db
      .select({ r: betReactions, userName: users.name })
      .from(betReactions)
      .innerJoin(users, eq(betReactions.userId, users.id)),
  ])

  // agrega reações por palpite: [{ emoji, count, mine, names }]
  const reactionsByBet = new Map<number, { emoji: string; count: number; mine: boolean; names: string[] }[]>()
  for (const { r, userName } of allReactions) {
    let list = reactionsByBet.get(r.betId)
    if (!list) reactionsByBet.set(r.betId, (list = []))
    let entry = list.find((e) => e.emoji === r.emoji)
    if (!entry) list.push((entry = { emoji: r.emoji, count: 0, mine: false, names: [] }))
    entry.count++
    entry.names.push(userName)
    if (r.userId === user.id) entry.mine = true
  }

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
            id: mine.bet.id,
            homeScore: mine.bet.homeScore,
            awayScore: mine.bet.awayScore,
            betAt: mine.bet.betAt.toISOString(),
            ignored: isIgnored(mine.bet, m),
            points: betPoints(mine.bet, m),
          }
        : null,
      // palpites são sempre públicos — bolão sem segredo, é brincadeira de família
      bets: matchBets.map((b) => ({
        id: b.bet.id,
        userId: b.bet.userId,
        userName: b.userName,
        userPhoto: b.userPhoto,
        homeScore: b.bet.homeScore,
        awayScore: b.bet.awayScore,
        origin: b.bet.origin,
        ignored: isIgnored(b.bet, m),
        points: betPoints(b.bet, m),
        reactions: reactionsByBet.get(b.bet.id) ?? [],
      })),
    }
  })

  res.json({ matches: result })
}
