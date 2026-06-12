import confetti from 'canvas-confetti'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { HistoryButton } from '../components/History'
import { IgnoredTag } from '../components/IgnoredTag'
import { ReactionBubble } from '../components/Reactions'
import { fmtDateHeading, fmtDayKey, fmtDateTime, fmtTime } from '../format'
import { buildMatchShareText } from '../share'
import { isRealTeam, teamName } from '../teams'
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
      <div className="score-board">
        <span className="score-team">{teamName(match.homeTeam)}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          placeholder="·"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          aria-label={`Gols ${teamName(match.homeTeam)}`}
        />
        <span className="score-vs">×</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          placeholder="·"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          aria-label={`Gols ${teamName(match.awayTeam)}`}
        />
        <span className="score-team">{teamName(match.awayTeam)}</span>
      </div>
      <button className="btn bet-submit" onClick={save} disabled={saving}>
        {saving ? '…' : match.myBet ? 'Alterar palpite' : '🎯 Cravar palpite'}
      </button>
      {msg && <span className="bet-msg">{msg}</span>}
    </div>
  )
}

function MatchCard({ match, players, onSaved }: { match: MatchView; players: string[]; onSaved: () => void }) {
  const status = match.finished ? 'Encerrado' : match.started ? 'Em andamento' : fmtTime(match.kickoffAt)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    await navigator.clipboard.writeText(buildMatchShareText(match, players))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`card match ${match.finished ? 'finished' : ''}`}>
      <div className="match-meta">
        <span className="chip">{match.phase}</span>
        <span>
          <span className={`chip ${match.started && !match.finished ? 'live' : 'time'}`}>{status}</span>
          <button className="share-btn" title="Copiar resumo para anunciar no grupo" onClick={share}>
            {copied ? '✅' : '📣'}
          </button>
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
          {match.myBet.ignored && <IgnoredTag />}
          {match.myBet.points !== null && !match.myBet.ignored && ` → ${match.myBet.points} pts`}
          <HistoryButton entityType="bet" entityId={match.myBet.id} title="Histórico — seu palpite" />
        </div>
      )}

      {!match.finished && <BetForm match={match} onSaved={onSaved} />}

      <div className="others">
        <strong className="others-title">Palpites da galera {match.bets.length > 0 && `(${match.bets.length})`}</strong>
        {match.bets.length > 0 ? (
          <ul>
            {match.bets.map((b) => (
              <li key={b.userId} className={b.ignored ? 'ignored' : ''}>
                <span className="player">
                  {b.userPhoto && <img src={b.userPhoto} alt="" referrerPolicy="no-referrer" />}
                  {b.userName}
                </span>
                <span className="bet-side">
                  <ReactionBubble betId={b.id} reactions={b.reactions} onChanged={onSaved}>
                    {b.homeScore} x {b.awayScore}
                    {b.ignored ? <IgnoredTag /> : b.points !== null ? ` · ${b.points} pts` : ''}
                  </ReactionBubble>
                  <HistoryButton entityType="bet" entityId={b.id} title={`Histórico — palpite de ${b.userName}`} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="footnote"> ninguém palpitou ainda — seja o primeiro! 🎯</span>
        )}
      </div>
    </div>
  )
}

// confete quando o usuário abre o app e descobre que cravou um placar exato
function celebrateNewExactHits(matches: MatchView[]) {
  const KEY = 'bolao-confetti-celebrated'
  const seen: number[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  const hits = matches.filter(
    (m) =>
      m.finished &&
      m.myBet &&
      !m.myBet.ignored &&
      m.myBet.homeScore === m.homeScore &&
      m.myBet.awayScore === m.awayScore &&
      !seen.includes(m.id),
  )
  if (hits.length === 0) return
  localStorage.setItem(KEY, JSON.stringify([...seen, ...hits.map((m) => m.id)]))
  const burst = (delay: number, opts: confetti.Options) =>
    setTimeout(() => confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, ...opts }), delay)
  burst(0, {})
  burst(300, { angle: 60, origin: { x: 0, y: 0.8 } })
  burst(500, { angle: 120, origin: { x: 1, y: 0.8 } })
}

export default function Matches() {
  const [matches, setMatches] = useState<MatchView[] | null>(null)
  const [players, setPlayers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('abertos')
  const [team, setTeam] = useState('')
  const [onlyUnbet, setOnlyUnbet] = useState(false)

  const load = () =>
    api<{ matches: MatchView[]; players: string[] }>('/api/matches')
      .then((r) => {
        setMatches(r.matches)
        setPlayers(r.players)
        celebrateNewExactHits(r.matches)
      })
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  const teams = useMemo(() => {
    if (!matches) return []
    const codes = new Set<string>()
    for (const m of matches) {
      codes.add(m.homeTeam)
      codes.add(m.awayTeam)
    }
    return [...codes]
      .filter(isRealTeam)
      .map((code) => ({ code, name: teamName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [matches])

  const visible = useMemo(() => {
    if (!matches) return []
    let list = matches
    if (filter === 'abertos') list = list.filter((m) => !m.finished)
    if (filter === 'encerrados') list = list.filter((m) => m.finished)
    if (team) list = list.filter((m) => m.homeTeam === team || m.awayTeam === team)
    if (onlyUnbet) list = list.filter((m) => !m.myBet)
    return list
  }, [matches, filter, team, onlyUnbet])

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
      <div className="filters">
        <select className="team-filter" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Todos os times</option>
          {teams.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
        <button className={onlyUnbet ? 'active' : ''} onClick={() => setOnlyUnbet(!onlyUnbet)}>
          🎯 Sem meu palpite
        </button>
      </div>
      {byDay.length === 0 && <p className="empty">Nenhum jogo aqui.</p>}
      {byDay.map((group) => (
        <section key={group[0].kickoffAt}>
          <h2 className="day-heading">{fmtDateHeading(group[0].kickoffAt)}</h2>
          {group.map((m) => (
            <MatchCard key={m.id} match={m} players={players} onSaved={load} />
          ))}
        </section>
      ))}
      <p className="footnote">
        Horários de Brasília. Palpite vale o placar com prorrogação (sem pênaltis) · Placar exato = 5 pts ·
        Resultado certo = 2 pts. Palpites são públicos — espiar é permitido, copiar é por sua conta e risco 😄
        Palpites feitos após o início do jogo são ignorados.
      </p>
    </div>
  )
}
