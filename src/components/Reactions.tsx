import { lazy, Suspense, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import type { ReactionSummary } from '../types'

// picker completo (estilo Slack/WhatsApp) carregado sob demanda
const EmojiPicker = lazy(() => import('emoji-picker-react'))

// atalhos de um toque; o picker completo fica logo abaixo
const QUICK_EMOJIS = ['👍', '😂', '🔥', '😬', '🤡', '🍀']

// Placar como balão estilo WhatsApp: reações num badge sobreposto ao balão,
// e um emoji "fantasma" para reagir que aparece no hover (esmaecido no toque).
export function ReactionBubble({
  betId,
  reactions,
  onChanged,
  children,
}: {
  betId: number
  reactions: ReactionSummary[]
  onChanged: () => void
  children: ReactNode
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

  const total = reactions.reduce((sum, r) => sum + r.count, 0)
  const whoReacted = reactions.map((r) => `${r.emoji} ${r.names.join(', ')}`).join(' · ')

  return (
    <span className="bet-bubble-wrap">
      <button className="react-ghost" title="Reagir" disabled={busy} onClick={() => setOpen(true)}>
        🙂
      </button>
      <span className="bet-bubble">
        {children}
        {reactions.length > 0 && (
          <button className="reaction-badge" title={whoReacted} disabled={busy} onClick={() => setOpen(true)}>
            {reactions.map((r) => r.emoji).join('')}
            {total > 1 && ` ${total}`}
          </button>
        )}
      </span>
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
