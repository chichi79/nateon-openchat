import type { OpenChatMessage } from '@/features/openchat/openchat.types'

/** 말풍선·멘션 등에 쓸 발신자 표시명 — `clientId`에 매핑된 방별 표시명 우선 */
export function resolveMessageSenderLabel(
  msg: Pick<OpenChatMessage, 'sender' | 'senderClientId' | 'kind'>,
  displayNamesByClientId: Record<string, string>,
): string {
  if (msg.kind === 'system') return ''
  const cid = msg.senderClientId?.trim()
  if (cid && displayNamesByClientId[cid]) return displayNamesByClientId[cid]!
  return msg.sender
}
