// Carga/atualização dos 104 jogos da Copa 2026 a partir de db/matches-source.json
// (feed de https://fixturedownload.com/feed/json/fifa-world-cup-2026).
//
// Pode ser rodado várias vezes: atualiza times (placeholders do mata-mata viram
// seleções reais conforme a Copa avança), horários e placares vindos do feed.
// Placar já lançado no banco é mantido quando o feed ainda não o tem.
// ATENÇÃO: edições manuais de time/horário feitas via admin são sobrescritas.
//
// Uso: DATABASE_URL='postgres://...' npm run db:seed

import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import { buildFeedRows, type SourceMatch } from '../api/_lib/feed'
import { matches } from '../api/_lib/schema'

const source: SourceMatch[] = JSON.parse(
  readFileSync(new URL('../db/matches-source.json', import.meta.url), 'utf8'),
)

const db = drizzle(neon(process.env.DATABASE_URL!))

const rows = buildFeedRows(source)

await db
  .insert(matches)
  .values(rows)
  .onConflictDoUpdate({
    target: matches.id,
    set: {
      phase: sql`excluded.phase`,
      homeTeam: sql`excluded.home_team`,
      awayTeam: sql`excluded.away_team`,
      kickoffAt: sql`excluded.kickoff_at`,
      homeScore: sql`coalesce(excluded.home_score, ${matches.homeScore})`,
      awayScore: sql`coalesce(excluded.away_score, ${matches.awayScore})`,
    },
  })

console.log(`Seed concluído: ${rows.length} jogos inseridos/atualizados.`)
console.log(`Com placar no feed: ${rows.filter((r) => r.homeScore !== null).length}`)
