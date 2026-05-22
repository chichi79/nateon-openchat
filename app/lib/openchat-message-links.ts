/** 메시지 본문 URL — http(s) 또는 www. 로 시작 */
export const URL_IN_TEXT_PATTERN = '(?:https?:\\/\\/|www\\.)[^\\s<>"\'\\]]+'

const URL_SPLIT_RE = new RegExp(`(${URL_IN_TEXT_PATTERN})`, 'gi')

const TRAILING_URL_PUNCT_RE = /[.,;:!?)\]}>]+$/

export function splitLinkParts(text: string): string[] {
  return text.split(URL_SPLIT_RE).filter((p) => p.length > 0)
}

export function isUrlToken(part: string): boolean {
  return /^https?:\/\//i.test(part) || /^www\./i.test(part)
}

export function normalizeMessageLinkHref(token: string): string {
  const trimmed = token.replace(TRAILING_URL_PUNCT_RE, '')
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/** 표시용 URL과 말미 구두점(본문에 남김) 분리 */
export function splitUrlToken(token: string): { core: string; trailing: string } {
  const match = token.match(/^(.+?)([.,;:!?)\]}>]+)$/)
  if (!match) return { core: token, trailing: '' }
  const core = match[1] ?? token
  const trailing = match[2] ?? ''
  if (!isUrlToken(core)) return { core: token, trailing: '' }
  return { core, trailing }
}
