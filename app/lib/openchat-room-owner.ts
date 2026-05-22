/** 방에 ownerClientId 가 있으면 clientId 만으로 방장 판별 (기본 닉네임 ㅇㅇ 충돌 방지) */
export function isOpenchatRoomOwner(
  room: { ownerNickname: string; ownerClientId?: string },
  memberKey: string,
  clientId?: string | null,
): boolean {
  const ownerClientId = (room.ownerClientId ?? '').trim()
  if (ownerClientId) {
    const cid = (clientId ?? '').trim()
    return cid.length > 0 && cid === ownerClientId
  }
  return room.ownerNickname === memberKey
}

/** 예전 방: ownerNickname 문자열만 저장된 경우 */
export function isLegacyOpenchatRoomOwnerBinding(room: { ownerClientId?: string }): boolean {
  return !(room.ownerClientId ?? '').trim()
}

/**
 * 방장 표시 이름 변경 허용 여부.
 * OAuth·ownerClientId 고정 전까지 레거시 방장은 닉(표시 이름) 변경 시 권한이 어긋날 수 있음.
 */
export function canOpenchatOwnerChangeDisplayName(room: { ownerClientId?: string }): boolean {
  return !isLegacyOpenchatRoomOwnerBinding(room)
}
