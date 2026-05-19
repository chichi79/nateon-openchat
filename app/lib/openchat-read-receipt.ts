export { textMentionsNickname } from '@/lib/openchat-mention'

/**
 * 다른 사람이 `messageCreatedAt` 이전·동시까지의 대화를 읽었다고 표시한 경우만 집계.
 * `readStates[nick]` = 해당 닉이 마지막으로 읽은 메시지의 `createdAt`(ISO).
 */
export function countReadersForMessage(
  messageCreatedAt: string,
  messageSender: string,
  readStates: Record<string, string>,
): number {
  return Object.entries(readStates).filter(([n, at]) => {
    if (!n || n === messageSender) return false
    const t = at?.trim()
    if (!t) return false
    return t >= messageCreatedAt
  }).length
}
