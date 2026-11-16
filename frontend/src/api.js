const API_BASE = import.meta.env.VITE_API_URL || ''

export function readSession() {
  return {
    token: localStorage.getItem('relay.token'),
    user: JSON.parse(localStorage.getItem('relay.user') || 'null'),
  }
}

export function saveSession(token, user) {
  localStorage.setItem('relay.token', token)
  localStorage.setItem('relay.user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('relay.token')
  localStorage.removeItem('relay.user')
}

export async function api(path, options = {}) {
  const token = readSession().token
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Token ${token}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}/api/${path.replace(/^\//, '')}`, { ...options, headers })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.detail || Object.values(data).flat().join(' ') || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return data
}

export async function authenticate(username, password, register = false, email = '') {
  const data = await fetch(`${API_BASE}/api/${register ? 'register/' : 'auth/'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...(register ? { email } : {}) }),
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.detail || Object.values(body).flat().join(' ') || 'Could not sign in.')
    return body
  })
  saveSession(data.token, data.user)
  return data.user
}

export function socketUrl(documentId) {
  const base = API_BASE || window.location.origin
  const url = new URL(base, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/ws/documents/${documentId}/`
  url.search = ''
  return url.toString()
}
