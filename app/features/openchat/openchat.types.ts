export type RoomPolicy = 'invite' | 'open_link' | 'gated_open'

export type OpenChatRoom = {
  id: string
  title: string
  policy: RoomPolicy
  tags: string[]
  ownerNickname: string
  /** 브라우저 익명 id — 방장 권한 판별에 사용(닉네임 변경과 분리) */
  ownerClientId?: string
  /** 방 아이콘 이미지(data URL 등). 없으면 제목 첫 글자 아바타 */
  iconUrl?: string
  createdAt: string
}

export type OpenChatMessageKind = 'chat' | 'system'

/** 이모지 → 반응한 clientId 목록 */
export type MessageReactions = Record<string, string[]>

export type OpenChatMessage = {
  id: string
  roomId: string
  kind?: OpenChatMessageKind
  sender: string
  /** 전송 시 브라우저 익명 id — 닉네임이 같아도 발신 구분용 */
  senderClientId?: string
  text: string
  replyToMessageId?: string
  attachments?: OpenChatAttachment[]
  reactions?: MessageReactions
  deletedAt?: string
  createdAt: string
}

export type ToggleMessageReactionResponse = {
  message: OpenChatMessage
}

export type OpenChatAttachment =
  | {
      kind: 'image'
      name: string
      mimeType: string
      size: number
      dataUrl: string
    }
  | {
      kind: 'file'
      name: string
      mimeType: string
      size: number
    }
  | {
      kind: 'sticker'
      emoji: string
    }

export type ListRoomsResponse = {
  rooms: OpenChatRoom[]
}

export type CreateRoomRequest = {
  title: string
  policy: RoomPolicy
  tags: string[]
  ownerNickname: string
  ownerClientId?: string
  iconUrl?: string
}

export type CreateRoomResponse = {
  room: OpenChatRoom
}

export type MembershipStatus = 'none' | 'pending' | 'member' | 'rejected'

export type GetMembershipResponse = {
  roomId: string
  nickname: string
  /** 이 방에서의 표시 이름 */
  displayName?: string
  status: MembershipStatus
  /** pending일 때 신청 만료 시각(ISO). 만료 후 status는 none으로 정리됨 */
  pendingExpiresAt?: string
  moderation?: {
    isOwner: boolean
    isManager: boolean
  }
}

export type RoomInviteInfo = {
  code: string
  expiresAt: string
}

export type RoomMemberRow = {
  /** 멤버 내부 키(가입 시점) */
  nickname: string
  displayName: string
  clientId?: string
  status: Exclude<MembershipStatus, 'none'>
}

export type RoomDisplayNamesResponse = {
  roomId: string
  byClientId: Record<string, string>
}

export type SetRoomDisplayNameRequest = {
  displayName: string
}

export type SetRoomDisplayNameResponse = {
  roomId: string
  displayName: string
  previousDisplayName?: string
}

export type ListRoomMembersResponse = {
  roomId: string
  ownerNickname: string
  managers: string[]
  blocked: string[]
  members: RoomMemberRow[]
}

export type JoinRoomRequest = {
  nickname: string
  inviteCode?: string
  clientId?: string
}

export type JoinRoomResponse = {
  roomId: string
  nickname: string
  status: MembershipStatus
}

export type GetRoomResponse = {
  room: OpenChatRoom
}

export type ListMessagesResponse = {
  messages: OpenChatMessage[]
}

export type PostMessageRequest = {
  sender: string
  senderClientId?: string
  text: string
  replyToMessageId?: string
  attachments?: OpenChatAttachment[]
}

export type PostMessageResponse = {
  message: OpenChatMessage
}

/** 참여 방 목록에서의 운영 권한 */
export type ParticipationRole = 'owner' | 'manager'

/** 클라이언트 ID 기준 — 참여(또는 가입 신청)한 방별 대화명 */
export type MyClientParticipationRow = {
  roomId: string
  roomTitle: string
  iconUrl?: string
  /** 이 방에서 사용 중인 표시 이름(대화명) */
  displayName: string
  /** 멤버 내부 키 */
  nickname: string
  status: Exclude<MembershipStatus, 'none'>
  /** 방장 또는 매니저일 때 */
  role?: ParticipationRole
}

export type MyClientParticipationsResponse = {
  clientId: string
  participations: MyClientParticipationRow[]
}

