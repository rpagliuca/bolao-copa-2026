export interface Me {
  id: number
  name: string
  email: string
  photoUrl: string | null
  status: 'pending' | 'approved'
  isAdmin: boolean
}

export interface BetView {
  id: number
  homeScore: number
  awayScore: number
  betAt: string
  ignored: boolean
  points: number | null
}

export interface ReactionSummary {
  emoji: string
  count: number
  mine: boolean
  names: string[]
}

export interface OtherBet extends BetView {
  userId: number
  userName: string
  userPhoto: string | null
  origin: 'app' | 'admin'
  reactions: ReactionSummary[]
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
  bets: OtherBet[]
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

export interface LiveScore {
  matchId: number
  status: 'IN_PLAY' | 'PAUSED' | 'FINISHED'
  homeScore: number
  awayScore: number
}

export interface FeedFieldChange {
  field: 'phase' | 'homeTeam' | 'awayTeam' | 'kickoffAt' | 'homeScore' | 'awayScore'
  from: string | number | null
  to: string | number | null
}

export interface FeedChange {
  matchId: number
  kind: 'create' | 'update'
  phase: string
  homeTeam: string
  awayTeam: string
  fields: FeedFieldChange[]
}

export interface AuditLog {
  id: number
  actorName: string
  action: string
  entityType: 'match' | 'bet' | 'user'
  entityId: number
  matchId: number | null
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  createdAt: string
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
