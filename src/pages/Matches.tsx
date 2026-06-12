import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { HistoryButton } from '../components/History'
import { fmtDateHeading, fmtDayKey, fmtDateTime, fmtTime } from '../format'
import { teamName } from '../teams'
import type { MatchView } from '../types'

type Filter = 'abertos' | 'todos' | 'encerrados'

function BetForm({ match, onSaved }: { match: MatchView; onSaved: () => void }) {
  const [home, setHome] = useState(match.myBet?.homeScore?.toString() ?? '')
  const [away, setAway] = useState(match.myBet?.awayScore?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    if (home === '' || away === '') {
      setMsg('Preencha os dois placares')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const r = await api('/api/bets', {
        method: 'PUT',
        body: JSON.stringify({ matchId: match.id, homeScore: Number(home), awayScore: Number(away) }),
      })
      setMsg(r.bet.ignored ? '⚠️ Salvo, mas o jogo já começou — palpite será ignorado' : '✅ Palpite salvo!')
      onSaved()
    } catch (e: any) {
      setMsg(`Erro: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bet-form">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={home}
        onChange={(e) => setHome(e.target.value)}
        aria-label={`Gols ${teamName(match.homeTeam)}`}
      />
      <span>x</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={away}
        onChange={(e) => setAway(e.target.value)}
        aria-label={`Gols ${teamName(match.awayTeam)}`}
      />
      <button className="btn small" onClick={save} disabled={saving}>
        {saving ? '…' : match.myBet ? 'Alterar' : 'Palpitar'}
      </button>
      {msg && <span className="bet-msg">{msg}</span>}
    </div>
  )
}

function MatchCard({ match, onSaved }: { match: MatchView; onSaved: () => void }) {
  const status = match.finished ? 'Encerrado' : match.started ? 'Em andamento' : fmtTime(match.kickoffAt)
  return (
    <div className={`card match ${match.finished ? 'finished' : ''}`}>
      <div className="match-meta">
        <span className="chip">{match.phase}</span>
        <span>
          <span className={`chip ${match.started && !match.finished ? 'live' : 'time'}`}>{status}</span>
          <HistoryButton
            entityType="match"
            entityId={match.id}
            title={`Histórico — ${teamName(match.homeTeam)} x ${teamName(match.awayTeam)}`}
          />
        </span>
      </div>
      <div className="match-teams">
        <span className="team home">{teamName(match.homeTeam)}</span>
        <span className="score">
          {match.finished ? `${match.homeScore} x ${match.awayScore}` : 'x'}
        </span>
        <span className="team away">{teamName(match.awayTeam)}</span>
      </div>

      {match.myBet && (
        <div className={`my-bet ${match.myBet.ignored ? 'ignored' : ''}`}>
          Seu palpite: <strong>{match.myBet.homeScore} x {match.myBet.awayScore}</strong>
          {match.myBet.ignored && ' (ignorado — feito após o início)'}
          {match.myBet.points !== null && !match.myBet.ignored && ` → ${match.myBet.points} pts`}
          <HistoryButton entityType="bet" entityId={match.myBet.id} title="Histórico — seu palpite" />
        </div>
      )}

      {!match.finished && <BetForm match={match} onSaved={onSaved} />}

      {match.bets && match.bets.length > 0 && (
        <details className="others">
          <summary>Palpites da galera ({match.bets.length})</summary>
          <ul>
            {match.bets.map((b) => (
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
        </details>
      )}
    </div>
  )
}

export default function Matches() {
  const [matches, setMatches] = useState<MatchView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('abertos')

  const load = () =>
    api<{ matches: MatchView[] }>('/api/matches')
      .then((r) => setMatches(r.matches))
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    if (!matches) return []
    if (filter === 'abertos') return matches.filter((m) => !m.finished)
    if (filter === 'encerrados') return matches.filter((m) => m.finished)
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
  if (!matches) return <div className="loading">Carregando jogos…</div>

  return (
    <div>
      <div className="filters">
        {(['abertos', 'todos', 'encerrados'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {byDay.length === 0 && <p className="empty">Nenhum jogo aqui.</p>}
      {byDay.map((group) => (
        <section key={group[0].kickoffAt}>
          <h2 className="day-heading">{fmtDateHeading(group[0].kickoffAt)}</h2>
          {group.map((m) => (
            <MatchCard key={m.id} match={m} onSaved={load} />
          ))}
        </section>
      ))}
      <p className="footnote">
        Horários de Brasília. Palpite vale o placar com prorrogação (sem pênaltis) · Placar exato = 5 pts ·
        Resultado certo = 2 pts. Palpites feitos após o início do jogo são ignorados.
      </p>
    </div>
  )
}
