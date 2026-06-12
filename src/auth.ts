const KEY = 'bolao_token'

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 < Date.now() + 30_000
  } catch {
    return true
  }
}

export function getToken(): string | null {
  const token = localStorage.getItem(KEY)
  if (!token) return null
  if (isExpired(token)) {
    localStorage.removeItem(KEY)
    return null
  }
  return token
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token)
}

export function clearToken() {
  localStorage.removeItem(KEY)
}
