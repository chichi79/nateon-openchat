/** `@닉네임` 토큰 — 한글·영문·숫자·밑줄 (공백 없는 표시 이름 기준) */
export const MENTION_TOKEN_PATTERN = '@[A-Za-z0-9가-힣_]+'

const MENTION_SPLIT_RE = new RegExp(`(${MENTION_TOKEN_PATTERN})`, 'g')
const MENTION_ACTIVE_RE = /(^|[\s\n])@([A-Za-z0-9가-힣_]*)$/

export function splitMentionParts(text: string): string[] {
  return text.split(MENTION_SPLIT_RE)
}

export function isMentionToken(part: string): boolean {
  return part.startsWith('@') && part.length > 1
}

/** 내가 멘션으로 불릴 수 있는 이름 목록(표시 이름·기본 닉 등) */
export function collectMentionAliases(opts: {
  displayName: string
  defaultNick?: string
  clientId?: string
  displayNamesByClientId?: Record<string, string>
}): string[] {
  const set = new Set<string>()
  const add = (v: string | undefined) => {
    const t = (v ?? '').trim()
    if (t) set.add(t)
  }
  add(opts.displayName)
  add(opts.defaultNick)
  const cid = (opts.clientId ?? '').trim()
  if (cid && opts.displayNamesByClientId?.[cid]) add(opts.displayNamesByClientId[cid])
  return [...set]
}

export function textMentionsNickname(text: string, nickname: string): boolean {
  return textMentionsAny(text, [nickname])
}

/** 메시지에 `@별칭` 이 하나라도 있으면 true (별칭은 `@` 없이 전달) */
export function textMentionsAny(text: string, aliases: readonly string[]): boolean {
  if (!text.trim() || aliases.length === 0) return false
  const aliasSet = new Set(aliases.map((a) => a.trim()).filter(Boolean))
  if (aliasSet.size === 0) return false
  for (const part of splitMentionParts(text)) {
    if (!isMentionToken(part)) continue
    const name = part.slice(1)
    if (aliasSet.has(name)) return true
  }
  return false
}

export function getActiveMentionQuery(
  text: string,
  cursorPos: number,
): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, cursorPos))
  const match = MENTION_ACTIVE_RE.exec(before)
  if (!match) return null
  const query = match[2] ?? ''
  return { start: before.length - query.length - 1, query }
}

export function filterMentionCandidates(names: readonly string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ko'))
  if (!q) return sorted.slice(0, limit)
  return sorted.filter((n) => n.toLowerCase().includes(q)).slice(0, limit)
}

export function insertMentionAt(
  text: string,
  cursorPos: number,
  name: string,
): { nextText: string; nextCursor: number } {
  const active = getActiveMentionQuery(text, cursorPos)
  if (!active) {
    const insert = `@${name} `
    return { nextText: text.slice(0, cursorPos) + insert + text.slice(cursorPos), nextCursor: cursorPos + insert.length }
  }
  const before = text.slice(0, active.start)
  const after = text.slice(cursorPos)
  const insert = `@${name} `
  const nextText = before + insert + after
  return { nextText, nextCursor: before.length + insert.length }
}

/** 작성창 커서 위치에 문자열 삽입 */
export function insertTextAt(
  text: string,
  cursorPos: number,
  insert: string,
): { nextText: string; nextCursor: number } {
  const pos = Math.max(0, Math.min(cursorPos, text.length))
  const nextText = text.slice(0, pos) + insert + text.slice(pos)
  return { nextText, nextCursor: pos + insert.length }
}
