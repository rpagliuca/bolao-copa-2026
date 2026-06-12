import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  photoUrl: text('photo_url'),
  status: text('status', { enum: ['pending', 'approved'] }).notNull().default('pending'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const matches = pgTable('matches', {
  // número oficial da partida na Copa (1-104)
  id: integer('id').primaryKey(),
  phase: text('phase').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
  // placar final incluindo prorrogação, SEM pênaltis
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
})

export const bets = pgTable(
  'bets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id),
    matchId: integer('match_id').notNull().references(() => matches.id),
    homeScore: integer('home_score').notNull(),
    awayScore: integer('away_score').notNull(),
    betAt: timestamp('bet_at', { withTimezone: true }).notNull().defaultNow(),
    origin: text('origin', { enum: ['app', 'admin'] }).notNull().default('app'),
    invalidatedByAdmin: boolean('invalidated_by_admin').notNull().default(false),
  },
  (t) => [uniqueIndex('bets_user_match_idx').on(t.userId, t.matchId)],
)

// reações de emoji nos palpites (zoeira liberada)
export const betReactions = pgTable(
  'bet_reactions',
  {
    id: serial('id').primaryKey(),
    betId: integer('bet_id')
      .notNull()
      .references(() => bets.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bet_reactions_unique_idx').on(t.betId, t.userId, t.emoji)],
)

// cache do placar ao vivo (football-data.org) — linha única (id=1) compartilhada
// por todas as functions para nunca estourar o limite gratuito da API externa
export const liveCache = pgTable('live_cache', {
  id: integer('id').primaryKey(),
  payload: jsonb('payload').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
})

// trilha de auditoria das ações administrativas
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    // null = ação automática do sistema (ex.: resultado via football-data)
    actorId: integer('actor_id').references(() => users.id),
    action: text('action').notNull(), // ex.: match.update, bet.create, user.promote
    entityType: text('entity_type', { enum: ['match', 'bet', 'user'] }).notNull(),
    entityId: integer('entity_id').notNull(),
    // para logs de palpite: jogo relacionado (regra de visibilidade e histórico por jogo)
    matchId: integer('match_id'),
    summary: text('summary').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_entity_idx').on(t.entityType, t.entityId)],
)

export type User = typeof users.$inferSelect
export type Match = typeof matches.$inferSelect
export type Bet = typeof bets.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type BetReaction = typeof betReactions.$inferSelect
