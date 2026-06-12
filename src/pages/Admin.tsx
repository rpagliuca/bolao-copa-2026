import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmtDateTime, fromLocalInput, toLocalInput } from '../format'
import { teamName } from '../teams'
import type { AdminBet, AdminMatch, Me } from '../types'

function Users() {
  const [users, setUsers] = useState<Me[] | null>(null)
  const load = () => api<{ users: Me[] }>('/api/admin/users').then((r) => setUsers(r.users))
  useEffect(() => {
    load()
  }, [])

  const setStatus = async (id: number, status: 'approved' | 'pending') => {
    await api('/api/admin/users', { method: 'PUT', body: JSON.stringify({ id, status }) })
    load()
  }

  if (!users) return <div className="loading">Carregando…</div>
  return (
    <div className="card">
      <h3>Usuários</h3>
      <ul className="admin-list">
        {users.map((u) => (
          <li key={u.id}>
            <span className="player">
              {u.photoUrl && <img src={u.photoUrl} alt="" referrerPolicy="no-referrer" />}
              {u.name}
              {u.isAdmin && <span className="chip">admin</span>}
              {u.status === 'pending' && <span className="chip warn">pendente</span>}
            </span>
            {u.status === 'pending' ? (
              <button className="btn small" onClick={() => setStatus(u.id, 'approved')}>
                Aprovar
              </button>
            ) : (
              !u.isAdmin && (
                <button className="link" onClick={() => setStatus(u.id, 'pending')}>
                  suspender
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MatchRow({ match, onSaved }: { match: AdminMatch; onSaved: () => void }) {
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoffAt))
  const [home, setHome] = useState(match.homeScore?.toString() ?? '')
  const [away, setAway] = useState(match.awayScore?.toString() ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    setMsg(null)
    try {
      await api('/api/admin/matches', {
        method: 'PUT',
        body: JSON.stringify({
          id: match.id,
          kickoffAt: fromLocalInput(kickoff),
          homeScore: home === '' ? null : Number(home),
          awayScore: away === '' ? null : Number(away),
        }),
      })
      setMsg('✅')
      onSaved()
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    }
  }

  return (
    <li className="admin-match">
      <div className="admin-match-title">
        <strong>#{match.id}</strong> {teamName(match.homeTeam)} x {teamName(match.awayTeam)}
        <span className="chip">{match.phase}</span>
      </div>
      <div className="admin-match-form">
        <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        <input
          type="number"
          min={0}
          max={99}
          placeholder="-"
          value={home}
          onChange={(e) => setHome(e.target.value)}
        />
        <span>x</span>
        <input
          type="number"
          min={0}
          max={99}
          placeholder="-"
          value={away}
          onChange={(e) => setAway(e.target.value)}
        />
        <button className="btn small" onClick={save}>
          Salvar
        </button>
        {msg && <span className="bet-msg">{msg}</span>}
      </div>
    </li>
  )
}

function Matches() {
  const [matches, setMatches] = useState<AdminMatch[] | null>(null)
  const [query, setQuery] = useState('')
  const load = () => api<{ matches: AdminMatch[] }>('/api/admin/matches').then((r) => setMatches(r.matches))
  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    if (!matches) return []
    const q = query.trim().toLowerCase()
    if (!q) return matches
    return matches.filter((m) =>
      [m.phase, m.homeTeam, m.awayTeam, teamName(m.homeTeam), teamName(m.awayTeam), String(m.id)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [matches, query])

  if (!matches) return <div className="loading">Carregando…</div>
  return (
    <div className="card">
      <h3>Jogos e resultados</h3>
      <p className="footnote">
        Placar com prorrogação, sem pênaltis. Deixe os dois campos vazios para limpar um resultado. Ao salvar
        um resultado, palpites feitos após a hora de início contam como ignorados.
      </p>
      <input
        className="search"
        placeholder="Filtrar por time, fase ou nº do jogo…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="admin-list">
        {visible.map((m) => (
          <MatchRow key={m.id} match={m} onSaved={load} />
        ))}
      </ul>
    </div>
  )
}

function Bets() {
  const [users, setUsers] = useState<Me[]>([])
  const [matches, setMatches] = useState<AdminMatch[]>([])
  const [bets, setBets] = useState<AdminBet[]>([])
  const [userId, setUserId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [betAt, setBetAt] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const loadBets = () => api<{ bets: AdminBet[] }>('/api/admin/bets').then((r) => setBets(r.bets))
  useEffect(() => {
    api<{ users: Me[] }>('/api/admin/users').then((r) => setUsers(r.users))
    api<{ matches: AdminMatch[] }>('/api/admin/matches').then((r) => setMatches(r.matches))
    loadBets()
  }, [])

  const save = async () => {
    setMsg(null)
    if (!userId || !matchId || home === '' || away === '') {
      setMsg('Preencha jogador, jogo e placar')
      return
    }
    try {
      await api('/api/admin/bets', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(userId),
          matchId: Number(matchId),
          homeScore: Number(home),
          awayScore: Number(away),
          ...(betAt ? { betAt: fromLocalInput(betAt) } : {}),
        }),
      })
      setMsg('✅ Palpite lançado')
      setHome('')
      setAway('')
      loadBets()
    } catch (e: any) {
      setMsg(`❌ ${e.message}`)
    }
  }

  const toggleInvalid = async (bet: AdminBet) => {
    await api('/api/admin/bets', {
      method: 'PUT',
      body: JSON.stringify({ id: bet.id, invalidatedByAdmin: !bet.invalidatedByAdmin }),
    })
    loadBets()
  }

  const remove = async (bet: AdminBet) => {
    if (!confirm(`Excluir palpite de ${bet.userName} (${bet.matchLabel})?`)) return
    await api(`/api/admin/bets?id=${bet.id}`, { method: 'DELETE' })
    loadBets()
  }

  return (
    <>
      <div className="card">
        <h3>Lançar palpite avulso</h3>
        <p className="footnote">
          Para importar palpites feitos no WhatsApp. "Feito em" define o timestamp do palpite — preencha com um
          horário anterior ao início do jogo para o palpite valer; vazio usa agora.
        </p>
        <div className="admin-bet-form">
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Jogador…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">Jogo…</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} {teamName(m.homeTeam)} x {teamName(m.awayTeam)}
              </option>
            ))}
          </select>
          <div className="admin-bet-scores">
            <input type="number" min={0} max={99} placeholder="-" value={home} onChange={(e) => setHome(e.target.value)} />
            <span>x</span>
            <input type="number" min={0} max={99} placeholder="-" value={away} onChange={(e) => setAway(e.target.value)} />
          </div>
          <label>
            Feito em: <input type="datetime-local" value={betAt} onChange={(e) => setBetAt(e.target.value)} />
          </label>
          <button className="btn" onClick={save}>
            Lançar palpite
          </button>
          {msg && <span className="bet-msg">{msg}</span>}
        </div>
      </div>

      <div className="card">
        <h3>Palpites registrados ({bets.length})</h3>
        <ul className="admin-list">
          {bets.map((b) => (
            <li key={b.id} className={b.ignored ? 'ignored' : ''}>
              <span>
                <strong>{b.userName}</strong> · {b.matchLabel} · {b.homeScore}x{b.awayScore}
                <br />
                <small>
                  {fmtDateTime(b.betAt)} · {b.origin === 'admin' ? 'avulso' : 'app'}
                  {b.ignored && ' · IGNORADO'}
                </small>
              </span>
              <span className="admin-bet-actions">
                <button className="link" onClick={() => toggleInvalid(b)}>
                  {b.invalidatedByAdmin ? 'revalidar' : 'invalidar'}
                </button>
                <button className="link danger" onClick={() => remove(b)}>
                  excluir
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

type Section = 'usuarios' | 'jogos' | 'palpites'

export default function Admin() {
  const [section, setSection] = useState<Section>('jogos')
  return (
    <div>
      <div className="filters">
        <button className={section === 'jogos' ? 'active' : ''} onClick={() => setSection('jogos')}>
          Jogos
        </button>
        <button className={section === 'palpites' ? 'active' : ''} onClick={() => setSection('palpites')}>
          Palpites
        </button>
        <button className={section === 'usuarios' ? 'active' : ''} onClick={() => setSection('usuarios')}>
          Usuários
        </button>
      </div>
      {section === 'usuarios' && <Users />}
      {section === 'jogos' && <Matches />}
      {section === 'palpites' && <Bets />}
    </div>
  )
}
