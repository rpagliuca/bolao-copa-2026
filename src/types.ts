export interface Me {
  id: number
  name: string
  email: string
  photoUrl: string | null
  status: 'pending' | 'approved'
  isAdmin: boolean
}

export interface BetView {
  homeScore: number
  awayScore: number
  betAt: string
  ignored: boolean
  points: number | null
}

export interface OtherBet extends BetView {
  userId: number
  userName: string
  userPhoto: string | null
  origin: 'app' | 'admin'
}

export interface MatchView {
  id: number
  phase: string
  homeTeam: string
  awayTeam: string
  kickoffAt: string
  homeScore: number | null
  awayScore: number | null
  started: boolean
  finished: boolean
  myBet: BetView | null
  bets: OtherBet[] | null
}

export interface RankingRow {
  position: number
  userId: number
  name: string
  photoUrl: string | null
  points: number
  exact: number
  outcome: number
  counted: number
}

export interface AdminMatch {
  id: number
  phase: string
  homeTeam: string
  awayTeam: string
  kickoffAt: string
  homeScore: number | null
  awayScore: number | null
}

export interface AdminBet {
  id: number
  userId: number
  userName: string
  matchId: number
  matchLabel: string
  homeScore: number
  awayScore: number
  betAt: string
  origin: 'app' | 'admin'
  invalidatedByAdmin: boolean
  ignored: boolean
}
