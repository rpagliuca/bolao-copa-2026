import { useEffect, useState } from 'react'
import { api } from '../api'
import type { RankingRow } from '../types'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Ranking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ ranking: RankingRow[] }>('/api/ranking')
      .then((r) => setRows(r.ranking))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="error">Erro: {error}</p>
  if (!rows) return <div className="loading">Carregando ranking…</div>

  return (
    <div className="card">
      <table className="ranking">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pts</th>
            <th title="Placares exatos (critério de desempate)">Exatos</th>
            <th title="Acertou só o resultado">Resultados</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId}>
              <td>{MEDALS[r.position] ?? r.position}</td>
              <td className="player">
                {r.photoUrl && <img src={r.photoUrl} alt="" referrerPolicy="no-referrer" />}
                {r.name}
              </td>
              <td>
                <strong>{r.points}</strong>
              </td>
              <td>{r.exact}</td>
              <td>{r.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">Desempate: mais placares exatos fica na frente.</p>
    </div>
  )
}
