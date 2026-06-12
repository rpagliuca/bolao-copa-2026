import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { HistoryButton } from '../components/History'
import { fmtDateHeading, fmtDayKey, fmtTime } from '../format'
import { teamName } from '../teams'
import type { MatchView } from '../types'

function MatchBets({ match, player }: { match: MatchView; player: string }) {
  const label = `${teamName(match.homeTeam)} ${match.finished ? `${match.homeScore} x ${match.awayScore}` : 'x'} ${teamName(match.awayTeam)}`
  const status = match.finished ? 'Encerrado' : match.started ? 'Em andamento' : fmtTime(match.kickoffAt)

  const visibleBets = useMemo(() => {
    if (!match.bets) return null
    return player ? match.bets.filter((b) => b.userName === player) : match.bets
  }, [match.bets, player])

  const bettorNames = match.bettors.map((b) => b.userName)
  const playerBetPending = player && !match.started ? bettorNames.includes(player) : null

  // com filtro de jogador ativo, esconde jogos onde ele não aparece (exceto futuros, p/ mostrar pendência)
  if (player && match.started && (!visibleBets || visibleBets.length === 0)) return null

  return (
    <div className="card all-bets-match">
      <div className="match-meta">
        <span>
          <strong>#{match.id}</strong> {label}
        </span>
        <span>
          <span className={`chip ${match.started && !match.finished ? 'live' : 'time'}`}>{status}</span>
          <HistoryButton entityType="match" entityId={match.id} title={`Histórico — ${label}`} />
        </span>
      </div>

      {match.started ? (
        visibleBets && visibleBets.length > 0 ? (
          <ul className="all-bets-list">
            {visibleBets.map((b) => (
              <li key={b.userId} className={b.ignored ? 'ignored' : ''}>
                <span>{b.userName}</span>
                <span>
                  {b.homeScore} x {b.awayScore}
                  {b.ignored ? ' · ignorado' : b.points !== null ? ` · ${b.points} pts` : ''}
                  <HistoryButton entityType="bet" entityId={b.id} title={`Histórico — palpite de ${b.userName}`} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="footnote">Ninguém palpitou neste jogo.</p>
        )
      ) : player ? (
        <p className="footnote">{playerBetPending ? '✅ Já palpitou (placar visível após o início)' : '⏳ Ainda não palpitou'}</p>
      ) : (
        <p className="footnote">
          🔒 Placares visíveis após o início ·{' '}
          {bettorNames.length > 0 ? `Já palpitaram (${bettorNames.length}): ${bettorNames.join(', ')}` : 'Ninguém palpitou ainda'}
        </p>
      )}
    </div>
  )
}

type Filter = 'todos' | 'iniciados' | 'futuros'

export default function AllBets() {
  const [matches, setMatches] = useState<MatchView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [player, setPlayer] = useState('')
  const [filter, setFilter] = useState<Filter>('iniciados')

  useEffect(() => {
    api<{ matches: MatchView[] }>('/api/matches')
      .then((r) => setMatches(r.matches))
      .catch((e) => setError(e.message))
  }, [])

  const players = useMemo(() => {
    if (!matches) return []
    const names = new Set<string>()
    for (const m of matches) for (const b of m.bettors) names.add(b.userName)
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [matches])

  const visible = useMemo(() => {
    if (!matches) return []
    if (filter === 'iniciados') return matches.filter((m) => m.started)
    if (filter === 'futuros') return matches.filter((m) => !m.started)
    return matches
  }, [matches, filter])

  const byDay = useMemo(() => {
    const groups = new Map<string, MatchView[]>()
    for (const m of visible) {
      const key = fmtDayKey(m.kickoffAt)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(m)
    }
    return [...groups.values()]
  }, [visible])

  if (error) return <p className="error">Erro: {error}</p>
  if (!matches) return <div className="loading">Carregando palpites…</div>

  return (
    <div>
      <div className="filters">
        {(['iniciados', 'futuros', 'todos'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <select className="player-filter" value={player} onChange={(e) => setPlayer(e.target.value)}>
        <option value="">Todos os jogadores</option>
        {players.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {byDay.length === 0 && <p className="empty">Nenhum jogo aqui.</p>}
      {byDay.map((group) => (
        <section key={group[0].kickoffAt}>
          <h2 className="day-heading">{fmtDateHeading(group[0].kickoffAt)}</h2>
          {group.map((m) => (
            <MatchBets key={m.id} match={m} player={player} />
          ))}
        </section>
      ))}
      <p className="footnote">
        Palpites dos outros aparecem depois que o jogo começa. Antes disso, dá para ver quem já palpitou — cobre
        os atrasados! 😄
      </p>
    </div>
  )
}
