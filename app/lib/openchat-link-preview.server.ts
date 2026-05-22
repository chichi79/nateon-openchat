import type { OpenChatLinkPreview } from '../features/openchat/openchat.types'
import { parseLinkPreviewFromHtml } from './openchat-link-preview'

const MAX_BYTES = 512_000
const TIMEOUT_MS = 8_000

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '127.0.0.1' || h === '::1' || h === '[::1]') return true
  if (h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) return true
  if (/^127\.\d+\.\d+\.\d+$/.test(h)) return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  return false
}

export function normalizeLinkPreviewTarget(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (isBlockedHost(u.hostname)) return null
    return u.href
  } catch {
    return null
  }
}

export async function fetchOpenchatLinkPreview(rawUrl: string): Promise<OpenChatLinkPreview | null> {
  const url = normalizeLinkPreviewTarget(rawUrl)
  if (!url) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NateOnOpenChat/1.0; +https://openchat.local)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') ?? '').toLowerCase()
    if (!type.includes('text/html') && !type.includes('application/xhtml')) return null

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return null
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    const preview = parseLinkPreviewFromHtml(html, res.url || url)
    if (!preview.title && !preview.description && !preview.imageUrl) return null
    return preview
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
