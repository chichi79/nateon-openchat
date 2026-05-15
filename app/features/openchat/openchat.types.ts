export type RoomPolicy = 'invite' | 'open_link' | 'gated_open'

export type OpenChatRoom = {
  id: string
  title: string
  policy: RoomPolicy
  tags: string[]
  ownerNickname: string
  createdAt: string
}

export type OpenChatMessage = {
  id: string
  roomId: string
  sender: string
  text: string
  replyToMessageId?: string
  attachments?: OpenChatAttachment[]
  deletedAt?: string
  createdAt: string
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

export type ListRoomsResponse = {
  rooms: OpenChatRoom[]
}

export type CreateRoomRequest = {
  title: string
  policy: RoomPolicy
  tags: string[]
  ownerNickname: string
}

export type CreateRoomResponse = {
  room: OpenChatRoom
}

export type MembershipStatus = 'none' | 'pending' | 'member' | 'rejected'

export type GetMembershipResponse = {
  roomId: string
  nickname: string
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
  nickname: string
  status: Exclude<MembershipStatus, 'none'>
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
  text: string
  replyToMessageId?: string
  attachments?: OpenChatAttachment[]
}

export type PostMessageResponse = {
  message: OpenChatMessage
}

