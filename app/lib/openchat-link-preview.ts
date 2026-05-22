import type { OpenChatLinkPreview } from '../features/openchat/openchat.types'
import { isUrlToken, normalizeMessageLinkHref, splitLinkParts } from './openchat-message-links'

export function extractFirstUrlFromText(text: string): string | null {
  for (const part of splitLinkParts(text)) {
    if (!isUrlToken(part)) continue
    return normalizeMessageLinkHref(part)
  }
  return null
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
}

function pickMeta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      'i',
    )
    const m = html.match(re)
    const v = (m?.[1] ?? m?.[2] ?? '').trim()
    if (v) return decodeHtmlEntities(v)
  }
  return undefined
}

function pickTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
  const v = m?.[1]?.trim()
  return v ? decodeHtmlEntities(v) : undefined
}

function resolveUrl(base: string, maybeRelative: string | undefined): string | undefined {
  if (!maybeRelative?.trim()) return undefined
  try {
    return new URL(maybeRelative.trim(), base).href
  } catch {
    return undefined
  }
}

/** HTML `<head>` 에서 OG / Twitter / title 메타 추출 */
export function parseLinkPreviewFromHtml(html: string, pageUrl: string): OpenChatLinkPreview {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html.slice(0, 120_000)
  const title =
    pickMeta(head, ['og:title', 'twitter:title']) ??
    pickTitle(head)
  const description = pickMeta(head, ['og:description', 'twitter:description', 'description'])
  const imageUrl = resolveUrl(
    pageUrl,
    pickMeta(head, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']),
  )
  const siteName = pickMeta(head, ['og:site_name', 'application-name'])
  return {
    url: pageUrl,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(siteName ? { siteName } : {}),
  }
}
