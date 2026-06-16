import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { buildRankingShareText } from '../share'
import type { RankingRow } from '../types'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const SHARE_TOASTS = [
  '🏆 Classificação copiada! Vai lá mostrar quem tá na frente 😤',
  '📣 Copiado! Manda pro grupo e esquenta a rivalidade 🔥',
  '✅ Classificação na área de transferência! Solta no zap 📲',
  '🥇 Copiado! Mostra pra galera quem tá dominando 😎',
]

export default function Ranking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    api<{ ranking: RankingRow[] }>('/api/ranking')
      .then((r) => setRows(r.ranking))
      .catch((e) => setError(e.message))
  }, [])

  const share = async () => {
    if (!rows) return
    await navigator.clipboard.writeText(buildRankingShareText(rows))
    setCopied(true)
    setToast(SHARE_TOASTS[Math.floor(Math.random() * SHARE_TOASTS.length)])
    setTimeout(() => setCopied(false), 2000)
    setTimeout(() => setToast(null), 3200)
  }

  if (error) return <p className="error">Erro: {error}</p>
  if (!rows) return <div className="loading">Carregando ranking…</div>

  return (
    <div className="card">
      <div className="card-header">
        <button className="share-btn" title="Copiar classificação para anunciar no grupo" onClick={share}>
          {copied ? '✅' : '📣'}
        </button>
      </div>
      <table className="ranking">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pts</th>
            <th title="Placares exatos (critério de desempate)">
              <span className="th-full">Placares exatos 🎯</span>
              <span className="th-abbr">🎯</span>
            </th>
            <th title="Acertou só o resultado">
              <span className="th-full">Resultados simples</span>
              <span className="th-abbr">Res.</span>
            </th>
            <th title="Jogos encerrados com palpite válido (dentro do prazo)">
              <span className="th-full">Jogos</span>
              <span className="th-abbr">Jgs</span>
            </th>
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
              <td>{r.counted}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">Desempate: mais placares exatos fica na frente.</p>
      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}
    </div>
  )
}
