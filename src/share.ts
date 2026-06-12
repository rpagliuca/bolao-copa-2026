import { fmtDateTime } from './format'
import { teamName } from './teams'
import type { MatchView } from './types'

const APP_URL = 'https://copa.eleprograma.com.br'

// texto formatado para colar no WhatsApp (*negrito*, emojis)
export function buildMatchShareText(match: MatchView, players: string[]): string {
  const home = teamName(match.homeTeam)
  const away = teamName(match.awayTeam)
  const lines: string[] = []

  if (match.finished) {
    lines.push(`⚽ *${home} ${match.homeScore} x ${match.awayScore} ${away}* (encerrado)`)
  } else if (match.started) {
    lines.push(`⚽ *${home} x ${away}* (em andamento 🔴)`)
  } else {
    lines.push(`⚽ *${home} x ${away}* — ${fmtDateTime(match.kickoffAt)}`)
  }

  lines.push('')
  if (match.bets.length > 0) {
    lines.push('🎲 *Palpites da galera:*')
    for (const b of match.bets) {
      let line = `• ${b.userName}: ${b.homeScore}x${b.awayScore}`
      if (b.ignored) line += ' ⏱ (fora do prazo)'
      else if (match.finished && b.points !== null) {
        line += b.points === 5 ? ' — *5 pts, cravou!* 🎯' : ` — ${b.points} ${b.points === 1 ? 'pt' : 'pts'}`
      }
      lines.push(line)
    }
  } else {
    lines.push('🎲 Ninguém palpitou ainda! 🦗')
  }

  const bettors = new Set(match.bets.map((b) => b.userName))
  const missing = players.filter((p) => !bettors.has(p))
  if (missing.length > 0) {
    lines.push('')
    lines.push(
      match.started
        ? `😴 Ficaram de fora: ${missing.join(', ')}`
        : `⏰ *Faltam palpitar:* ${missing.join(', ')}`,
    )
  }

  lines.push('')
  lines.push(`👉 ${APP_URL}`)
  return lines.join('\n')
}
