import type { MessageReactions, OpenChatMessage } from '@/features/openchat/openchat.types'

/** 더보기 메뉴 빠른 반응 */
export const QUICK_MESSAGE_REACTIONS = ['👏', '😍', '😎', '👍', '❤️', '😭'] as const

export function parseMessageReactions(raw: unknown): MessageReactions | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: MessageReactions = {}
  for (const [emoji, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue
    const list = [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))]
    if (list.length) out[emoji] = list
  }
  return Object.keys(out).length ? out : undefined
}

export function reactionEntries(reactions: MessageReactions | undefined): { emoji: string; count: number }[] {
  if (!reactions) return []
  return Object.entries(reactions)
    .map(([emoji, ids]) => ({ emoji, count: ids.length }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
}

export function hasMyReaction(reactions: MessageReactions | undefined, emoji: string, clientId: string | undefined) {
  const cid = (clientId ?? '').trim()
  if (!cid || !reactions) return false
  return (reactions[emoji] ?? []).includes(cid)
}

/** 사용자가 남긴 반응 이모지 (한 사람당 하나) */
export function myReactionEmoji(reactions: MessageReactions | undefined, clientId: string | undefined) {
  const cid = (clientId ?? '').trim()
  if (!cid || !reactions) return undefined
  for (const [emoji, ids] of Object.entries(reactions)) {
    if (ids.includes(cid)) return emoji
  }
  return undefined
}

function stripClientFromReactions(reactions: MessageReactions, clientId: string): MessageReactions {
  const next: MessageReactions = {}
  for (const [emoji, ids] of Object.entries(reactions)) {
    const list = ids.filter((id) => id !== clientId)
    if (list.length) next[emoji] = list
  }
  return next
}

/** 한 사용자당 메시지당 반응 하나만 허용 */
export function toggleReactionMap(
  reactions: MessageReactions | undefined,
  emoji: string,
  clientId: string,
): MessageReactions | undefined {
  const cid = clientId.trim()
  if (!cid) return reactions

  const base = reactions ?? {}
  const mine = myReactionEmoji(base, cid)

  if (mine === emoji) {
    const next = stripClientFromReactions(base, cid)
    return Object.keys(next).length ? next : undefined
  }

  const cleared = stripClientFromReactions(base, cid)
  const cur = [...(cleared[emoji] ?? [])]
  const next: MessageReactions = { ...cleared, [emoji]: [...cur, cid] }
  return next
}

export function messageHasReactions(msg: Pick<OpenChatMessage, 'reactions'>) {
  return reactionEntries(msg.reactions).length > 0
}
