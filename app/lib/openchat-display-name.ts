const NICKNAME_STORAGE_KEY = 'openchat.nickname'

/** `useLocalStorageState('openchat.nickname', …)` 과 동일한 원본 문자열 */
export function readOpenchatNicknameFromStorage(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(NICKNAME_STORAGE_KEY)
    if (!raw) return ''
    return JSON.parse(raw) as string
  } catch {
    return ''
  }
}

/** 방·멤버십 판별에 쓰는 표시용 닉네임 (`room-detail` senderName 과 동일, 스토리지 기본은 `ㅇㅇ`) */
export function openchatDisplaySenderName(): string {
  return readOpenchatNicknameFromStorage().trim() || 'ㅇㅇ'
}
