import { clearToken, getToken } from './auth'

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    location.reload()
    throw new Error('Sessão expirada')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Erro ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
