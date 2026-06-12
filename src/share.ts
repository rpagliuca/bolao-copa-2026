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

  // alerta de urgência quando o kickoff está chegando
  const msLeft = new Date(match.kickoffAt).getTime() - Date.now()
  const urgent = !match.started && msLeft <= 3 * 3_600_000
  if (urgent) {
    const h = Math.floor(msLeft / 3_600_000)
    const min = Math.floor((msLeft % 3_600_000) / 60_000)
    const left = h > 0 ? `${h}h${String(min).padStart(2, '0')}` : `${min} minutos`
    lines.push('')
    lines.push(
      msLeft <= 3_600_000
        ? `🚨🚨 *ÚLTIMA CHAMADA: a bola rola em ${left}!* 🚨🚨`
        : `🚨 *Corre! Faltam só ${left} para a bola rolar!*`,
    )
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
    if (match.started) {
      lines.push(`😴 Ficaram de fora: ${missing.join(', ')}`)
    } else if (urgent) {
      lines.push(`😱 *AINDA NÃO PALPITARAM:*`)
      for (const name of missing) lines.push(`   ‼️ ${name}`)
    } else {
      lines.push(`⏰ *Faltam palpitar:* ${missing.join(', ')}`)
    }
  }

  lines.push('')
  lines.push(urgent && missing.length > 0 ? `👉 corre lá: ${APP_URL}` : `👉 ${APP_URL}`)
  return lines.join('\n')
}
