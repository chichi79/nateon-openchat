import { generateRandomOpenchatNickname } from '@/lib/openchat-nickname-generator'

const NICKNAME_STORAGE_KEY = 'openchat.nickname'
const NICKNAME_INTRO_SEEN_KEY = 'openchat.nicknameIntroSeen'

/** 예전 기본값·빈 값일 때만 랜덤 닉네임으로 교체 */
export const OPENCHAT_LEGACY_DEFAULT_NICKNAME = 'ㅇㅇ' as const

function isLegacyDefaultNickname(value: string): boolean {
  const t = value.trim()
  return !t || t === OPENCHAT_LEGACY_DEFAULT_NICKNAME
}

/** `useLocalStorageState('openchat.nickname', …)` 과 동일한 원본 문자열 */
export function readOpenchatNicknameFromStorage(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(NICKNAME_STORAGE_KEY)
    if (!raw) return ''
    const s = JSON.parse(raw) as unknown
    if (typeof s !== 'string') return ''
    return s.trim()
  } catch {
    return ''
  }
}

function writeOpenchatNicknameToStorage(nickname: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(nickname))
  } catch {
    // ignore
  }
}

/**
 * 저장된 닉네임이 없거나 legacy `ㅇㅇ` 이면 단어 조합 닉네임을 만들어 저장합니다.
 * 이미 사용자가 정한 닉네임은 유지합니다.
 */
export function ensureOpenchatNickname(): string {
  if (typeof window === 'undefined') return OPENCHAT_LEGACY_DEFAULT_NICKNAME
  const existing = readOpenchatNicknameFromStorage()
  if (!isLegacyDefaultNickname(existing)) return existing
  const nickname = generateRandomOpenchatNickname()
  writeOpenchatNicknameToStorage(nickname)
  return nickname
}

/** 방·멤버십 판별에 쓰는 표시용 닉네임 */
export function openchatDisplaySenderName(): string {
  return ensureOpenchatNickname()
}

export function readOpenchatNicknameIntroSeen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(NICKNAME_INTRO_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markOpenchatNicknameIntroSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NICKNAME_INTRO_SEEN_KEY, '1')
  } catch {
    // ignore
  }
}
