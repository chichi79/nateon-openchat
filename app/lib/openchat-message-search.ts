import type { OpenChatMessage } from '@/features/openchat/openchat.types'
import { messageStickerEmoji } from '@/lib/openchat-stickers'

export function normalizeChatSearchQuery(query: string) {
  return query.trim().toLowerCase()
}

export function messageMatchesChatSearch(
  m: OpenChatMessage,
  query: string,
  senderLabel: string,
  replied?: OpenChatMessage | null,
) {
  const q = normalizeChatSearchQuery(query)
  if (!q) return true
  if (m.deletedAt) return false

  const parts: string[] = []
  if (senderLabel) parts.push(senderLabel)
  if (m.sender?.trim()) parts.push(m.sender.trim())
  if (m.text?.trim()) parts.push(m.text.trim())

  const sticker = messageStickerEmoji(m.attachments)
  if (sticker) parts.push(sticker)

  for (const a of m.attachments ?? []) {
    if (a.kind === 'file' || a.kind === 'image') {
      if (a.name?.trim()) parts.push(a.name.trim())
    }
  }

  if (replied && !replied.deletedAt) {
    if (replied.text?.trim()) parts.push(replied.text.trim())
    const rs = messageStickerEmoji(replied.attachments)
    if (rs) parts.push(rs)
  }

  return parts.join(' ').toLowerCase().includes(q)
}

/** 시간순 메시지 목록에서 검색 일치 id (채팅·시스템 포함) */
export function findChatSearchMatchIds(
  messages: OpenChatMessage[],
  query: string,
  labelFor: (m: OpenChatMessage) => string,
): string[] {
  const q = normalizeChatSearchQuery(query)
  if (!q) return []

  const byId = new Map(messages.map((m) => [m.id, m]))
  const ids: string[] = []
  for (const m of messages) {
    const replied = m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined
    if (messageMatchesChatSearch(m, query, labelFor(m), replied)) ids.push(m.id)
  }
  return ids
}
