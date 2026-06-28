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

type Fase = 'matamata' | 'grupos' | 'geral'

const FASE_LABELS: Record<Fase, string> = {
  matamata: '⚔️ Mata-mata',
  grupos: '🗂️ Grupos',
  geral: '🌍 Geral',
}

export default function Ranking() {
  const [fase, setFase] = useState<Fase>('matamata')
  const [rows, setRows] = useState<RankingRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    api<{ ranking: RankingRow[] }>(`/api/ranking?fase=${fase}`)
      .then((r) => setRows(r.ranking))
      .catch((e) => setError(e.message))
  }, [fase])

  const share = async () => {
    if (!rows) return
    await navigator.clipboard.writeText(buildRankingShareText(rows, FASE_LABELS[fase].replace(/^\S+\s/, '')))
    setCopied(true)
    setToast(SHARE_TOASTS[Math.floor(Math.random() * SHARE_TOASTS.length)])
    setTimeout(() => setCopied(false), 2000)
    setTimeout(() => setToast(null), 3200)
  }

  if (error) return <p className="error">Erro: {error}</p>

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="filters" style={{ margin: 0, flexWrap: 'wrap' }}>
          {(Object.keys(FASE_LABELS) as Fase[]).map((f) => (
            <button key={f} className={fase === f ? 'active' : ''} onClick={() => setFase(f)}>
              {FASE_LABELS[f]}
            </button>
          ))}
        </div>
        <button className="share-btn" title="Copiar classificação para anunciar no grupo" onClick={share} style={{ marginLeft: 8, flexShrink: 0 }}>
          {copied ? '✅' : '📣'}
        </button>
      </div>
      {!rows ? (
        <div className="loading">Carregando ranking…</div>
      ) : (
        <>
          <table className="ranking">
            <thead>
              <tr>
                <th>#</th>
                <th>Jogador</th>
                <th>Pontos</th>
                <th title="Resultados simples / placares exatos (critério de desempate)">Acertos Simples / Exatos&nbsp;🎯</th>
                <th title="Jogos encerrados com palpite válido (dentro do prazo)">Jogos</th>
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
                  <td>{r.outcome} / {r.exact}</td>
                  <td>{r.counted}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="footnote">Desempate: mais placares exatos fica na frente.</p>
        </>
      )}
      {toast && createPortal(<div className="toast">{toast}</div>, document.body)}
    </div>
  )
}
