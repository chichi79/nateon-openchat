export type OpenChatAuth = {
  token: string
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const cookies = document.cookie ? document.cookie.split('; ') : []
  for (const c of cookies) {
    const eq = c.indexOf('=')
    if (eq < 0) continue
    const key = c.slice(0, eq)
    if (key === name) return decodeURIComponent(c.slice(eq + 1))
  }
  return ''
}

export function getAuthFromCookie(): OpenChatAuth | null {
  const token = getCookie('token')
  if (!token) return null
  return { token }
}

