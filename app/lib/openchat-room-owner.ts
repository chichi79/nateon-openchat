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
