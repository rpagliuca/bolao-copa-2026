import type { Bet, Match } from './schema.js'

export const POINTS_EXACT = 5
export const POINTS_OUTCOME = 2

// Palpite feito após o início do jogo (ou invalidado pelo admin) é "ignorado" a posteriori.
export function isIgnored(bet: Pick<Bet, 'betAt' | 'invalidatedByAdmin'>, match: Pick<Match, 'kickoffAt'>): boolean {
  return bet.invalidatedByAdmin || bet.betAt.getTime() >= match.kickoffAt.getTime()
}

// Retorna null se o jogo ainda não tem resultado. Placar considera prorrogação, não pênaltis;
// empate é palpite válido em qualquer fase.
export function betPoints(
  bet: Pick<Bet, 'betAt' | 'invalidatedByAdmin' | 'homeScore' | 'awayScore'>,
  match: Match,
): number | null {
  if (match.homeScore == null || match.awayScore == null) return null
  if (isIgnored(bet, match)) return 0
  if (bet.homeScore === match.homeScore && bet.awayScore === match.awayScore) return POINTS_EXACT
  if (Math.sign(bet.homeScore - bet.awayScore) === Math.sign(match.homeScore - match.awayScore)) return POINTS_OUTCOME
  return 0
}
