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

// trilha de auditoria das ações administrativas
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').notNull().references(() => users.id),
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
