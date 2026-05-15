const CLIENT_ID_KEY = 'openchat.clientId'

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/** 브라우저에 저장된 클라이언트 id만 읽습니다(없으면 undefined). */
export function readOpenchatClientId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!raw) return undefined
    const s = JSON.parse(raw) as unknown
    if (typeof s !== 'string' || !s.trim()) return undefined
    return s.trim()
  } catch {
    return undefined
  }
}

/**
 * 이 브라우저에서만 유지되는 익명 식별자.
 * 없으면 생성해 `localStorage`에 저장하고 반환합니다.
 */
export function ensureOpenchatClientId(): string {
  if (typeof window === 'undefined') return ''
  const existing = readOpenchatClientId()
  if (existing) return existing
  const id = randomUuid()
  try {
    window.localStorage.setItem(CLIENT_ID_KEY, JSON.stringify(id))
  } catch {
    // 저장 실패 시에도 당 세션용 id 반환
  }
  return id
}

/** 채팅 말풍선 좌/우 구분 — 닉네임이 같아도 `senderClientId`가 있으면 그걸 우선 */
export function isOpenchatMessageMine(
  msg: { sender: string; senderClientId?: string },
  myNickname: string,
  myClientId: string | undefined,
): boolean {
  const msgCid = msg.senderClientId?.trim()
  const myCid = myClientId?.trim()
  if (msgCid && myCid) return msgCid === myCid
  return msg.sender === myNickname
}
