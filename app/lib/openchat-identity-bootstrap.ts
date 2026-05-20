import { ensureOpenchatNickname, markOpenchatNicknameIntroSeen, readOpenchatNicknameIntroSeen } from '@/lib/openchat-display-name'
import { ensureOpenchatClientId } from '@/lib/openchat-identity'

/** 채팅방 목록 진입 시: clientId·기본 닉네임 발급 + 최초 안내 표시 여부 */
export function bootstrapOpenchatIdentityOnRoomList(): {
  clientId: string
  nickname: string
  showIntro: boolean
} {
  const clientId = ensureOpenchatClientId()
  const nickname = ensureOpenchatNickname()
  const showIntro = !readOpenchatNicknameIntroSeen()
  return { clientId, nickname, showIntro }
}

export function completeOpenchatNicknameIntro(): void {
  markOpenchatNicknameIntroSeen()
}
