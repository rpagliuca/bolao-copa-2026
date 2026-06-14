import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { clearToken, getToken, setToken } from './auth'
import Admin from './pages/Admin'
import Matches from './pages/Matches'
import Ranking from './pages/Ranking'
import Rules from './pages/Rules'
import type { Me } from './types'

declare global {
  interface Window {
    google?: any
  }
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!window.google || !buttonRef.current) return
      clearInterval(timer)
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const r = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: resp.credential }),
            })
            if (!r.ok) throw new Error('session')
            const { token } = await r.json()
            onToken(token)
          } catch {
            // fallback: usa o ID token do Google diretamente (expira em 1h)
            onToken(resp.credential)
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        locale: 'pt-BR',
      })
    }, 150)
    return () => clearInterval(timer)
  }, [onToken])

  return (
    <div className="login">
      <div className="login-card">
        <span className="login-ball">⚽</span>
        <h1>Bolão da Família</h1>
        <p>Copa do Mundo 2026</p>
        <div ref={buttonRef} className="login-button" />
      </div>
    </div>
  )
}

function Pending({ me, onLogout }: { me: Me; onLogout: () => void }) {
  return (
    <div className="login">
      <div className="login-card">
        <span className="login-ball">⏳</span>
        <h1>Quase lá, {me.name.split(' ')[0]}!</h1>
        <p>Seu acesso está aguardando aprovação do dono do bolão.</p>
        <button className="btn" onClick={onLogout}>
          Sair
        </button>
      </div>
    </div>
  )
}

type Tab = 'jogos' | 'ranking' | 'regras' | 'admin'

export default function App() {
  const [token, setTokenState] = useState(getToken())
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('jogos')

  useEffect(() => {
    if (!token) return
    api<{ user: Me }>('/api/me')
      .then((r) => setMe(r.user))
      .catch((e) => setError(e.message))
  }, [token])

  const logout = () => {
    clearToken()
    setTokenState(null)
    setMe(null)
  }

  if (!token) {
    return (
      <Login
        onToken={(t) => {
          setToken(t)
          setTokenState(t)
        }}
      />
    )
  }
  if (error) {
    return (
      <div className="login">
        <div className="login-card">
          <p>Erro: {error}</p>
          <button className="btn" onClick={logout}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }
  if (!me) return <div className="loading">Carregando…</div>
  if (me.status !== 'approved') return <Pending me={me} onLogout={logout} />

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span>⚽</span>
          <strong>Bolão da Família</strong>
        </div>
        <div className="header-user">
          {me.photoUrl && <img src={me.photoUrl} alt="" referrerPolicy="no-referrer" />}
          <button className="link" onClick={logout}>
            sair
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'jogos' ? 'active' : ''} onClick={() => setTab('jogos')}>
          Jogos
        </button>
        <button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')}>
          Ranking
        </button>
        <button className={tab === 'regras' ? 'active' : ''} onClick={() => setTab('regras')}>
          Regras
        </button>
        {me.isAdmin && (
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>
            Admin
          </button>
        )}
      </nav>

      <main className="content">
        {tab === 'jogos' && <Matches />}
        {tab === 'ranking' && <Ranking />}
        {tab === 'regras' && <Rules />}
        {tab === 'admin' && me.isAdmin && <Admin me={me} />}
      </main>
      <footer className="app-footer">{__COMMIT_HASH__}</footer>
    </div>
  )
}
