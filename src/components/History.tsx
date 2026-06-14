import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { fmtDateTime } from '../format'
import type { AuditLog } from '../types'

function PrevBetScore({ log }: { log: AuditLog }) {
  const b = log.before
  if (!b || typeof b.homeScore !== 'number' || typeof b.awayScore !== 'number') return null
  return <small className="history-bet-prev">era: {b.homeScore} × {b.awayScore}</small>
}

export function HistoryLogList({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return <p className="empty">Nenhuma alteração registrada.</p>
  return (
    <ul className="history-list">
      {logs.map((l) => (
        <li key={l.id}>
          <small>
            {fmtDateTime(l.createdAt)} · <strong>{l.actorName}</strong>
          </small>
          <span>{l.summary}</span>
          <PrevBetScore log={l} />
        </li>
      ))}
    </ul>
  )
}

function HistoryModal({
  entityType,
  entityId,
  title,
  onClose,
}: {
  entityType: AuditLog['entityType']
  entityId: number
  title: string
  onClose: () => void
}) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ logs: AuditLog[] }>(`/api/audit?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => setLogs(r.logs))
      .catch((e) => setError(e.message))
  }, [entityType, entityId])

  // portal: fora da árvore do card para não herdar opacity de linhas "fora do prazo"
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🕘 {title}</h3>
          <button className="link" onClick={onClose}>
            fechar
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {!error && !logs && <div className="loading">Carregando…</div>}
        {logs && <HistoryLogList logs={logs} />}
      </div>
    </div>,
    document.body,
  )
}

// ícone de histórico: abre as alterações administrativas do objeto
export function HistoryButton({
  entityType,
  entityId,
  title,
}: {
  entityType: AuditLog['entityType']
  entityId: number
  title: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="history-btn" title="Histórico de alterações" onClick={() => setOpen(true)}>
        🕘
      </button>
      {open && (
        <HistoryModal entityType={entityType} entityId={entityId} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
