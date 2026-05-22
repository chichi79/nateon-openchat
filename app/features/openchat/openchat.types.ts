export type RoomPolicy = 'invite' | 'open_link' | 'gated_open'

/** 방 공지·고정 안내 — 입장 직후 규칙·링크·일정 */
export type OpenChatRoomNotice = {
  text: string
  updatedAt: string
  updatedBy?: string
}

export type OpenChatLinkPreview = {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
}

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
  /** 채팅 메시지 목록 배경(data URL 등) */
  chatBackgroundUrl?: string
  /** 배경을 홍보·광고로 표시(방장만 설정) */
  chatBackgroundAd?: boolean
  /** 방 공지(고정) — 멤버 입장 시 채팅 상단에 표시 */
  notice?: OpenChatRoomNotice
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
  chatBackgroundUrl?: string
  chatBackgroundAd?: boolean
}

export type CreateRoomResponse = {
  room: OpenChatRoom
}

/** 방장만 — 아이콘·채팅 배경 변경. 빈 문자열 필드는 해당 항목 제거 */
export type UpdateRoomAppearanceRequest = {
  ownerNickname: string
  iconUrl?: string
  chatBackgroundUrl?: string
  /** true: 광고 배경 표시. false: 일반 배경. 배경 제거 시 함께 해제 */
  chatBackgroundAd?: boolean
}

export type UpdateRoomAppearanceResponse = {
  room: OpenChatRoom
}

export type UpdateRoomNoticeRequest = {
  actorNickname: string
  text: string
}

export type UpdateRoomNoticeResponse = {
  room: OpenChatRoom
}

export type FetchLinkPreviewResponse = {
  preview: OpenChatLinkPreview | null
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

