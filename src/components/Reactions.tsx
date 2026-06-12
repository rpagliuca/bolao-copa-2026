import { lazy, Suspense, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import type { ReactionSummary } from '../types'

// picker completo (estilo Slack/WhatsApp) carregado sob demanda
const EmojiPicker = lazy(() => import('emoji-picker-react'))

// atalhos de um toque; o + abre o picker completo
const QUICK_EMOJIS = ['👍', '😂', '🔥', '😬', '🤡', '🍀']

export function ReactionBar({
  betId,
  reactions,
  onChanged,
}: {
  betId: number
  reactions: ReactionSummary[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const react = async (emoji: string) => {
    if (busy) return
    setBusy(true)
    setOpen(false)
    try {
      await api('/api/reactions', { method: 'POST', body: JSON.stringify({ betId, emoji }) })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="reactions">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          className={`reaction-chip ${r.mine ? 'mine' : ''}`}
          title={r.names.join(', ')}
          disabled={busy}
          onClick={() => react(r.emoji)}
        >
          {r.emoji} {r.count}
        </button>
      ))}
      <button className="reaction-chip add" disabled={busy} onClick={() => setOpen(true)} title="Reagir">
        +
      </button>
      {open &&
        createPortal(
          <div className="modal-overlay" onClick={() => setOpen(false)}>
            <div className="emoji-picker-box" onClick={(e) => e.stopPropagation()}>
              <div className="emoji-quick-row">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} disabled={busy} onClick={() => react(e)}>
                    {e}
                  </button>
                ))}
              </div>
              <Suspense fallback={<div className="loading">Carregando emojis…</div>}>
                <EmojiPicker
                  onEmojiClick={(d: { emoji: string }) => react(d.emoji)}
                  width="100%"
                  height={360}
                  searchPlaceHolder="Buscar emoji…"
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </Suspense>
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
