import type { OpenChatMessage, OpenChatRoom } from '@/features/openchat/openchat.types'

function nowIso() {
  return new Date().toISOString()
}

export type MemberRecordStatus = 'pending' | 'member' | 'rejected'

export type RoomInviteState = {
  code: string
  expiresAt: string
}

export type OpenChatDb = {
  rooms: OpenChatRoom[]
  messagesByRoomId: Record<string, OpenChatMessage[]>
  membersByRoomId: Record<string, Record<string, MemberRecordStatus>>
  /** pending 신청 시각(ISO) — 만료 판단용 */
  pendingRequestedAtByRoomId: Record<string, Record<string, string>>
  /** @deprecated 로드 시 inviteStateByRoomId로 승격 */
  inviteCodesByRoomId?: Record<string, string[]>
  inviteStateByRoomId: Record<string, RoomInviteState>
  managersByRoomId: Record<string, string[]>
  blockedByRoomId: Record<string, string[]>
  /** 방별 닉네임 → 마지막으로 읽은 메시지 createdAt(ISO) */
  readStatesByRoomId: Record<string, Record<string, string>>
}

export function defaultInviteExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

/** localStorage 등에서 불완전한 객체를 OpenChatDb로 보정 */
export function migrateOpenChatDb(parsed: unknown): OpenChatDb {
  if (!parsed || typeof parsed !== 'object') return createOpenChatDb()
  const v = parsed as Partial<OpenChatDb> & { inviteCodesByRoomId?: Record<string, string[]> }
  if (!Array.isArray(v.rooms) || typeof v.messagesByRoomId !== 'object' || v.messagesByRoomId === null) {
    return createOpenChatDb()
  }

  const rooms = v.rooms
  const messagesByRoomId = v.messagesByRoomId
  const membersByRoomId = { ...(v.membersByRoomId ?? {}) } as Record<string, Record<string, MemberRecordStatus>>
  const pendingRequestedAtByRoomId = { ...(v.pendingRequestedAtByRoomId ?? {}) }
  const inviteStateByRoomId = { ...(v.inviteStateByRoomId ?? {}) }
  const managersByRoomId = { ...(v.managersByRoomId ?? {}) }
  const blockedByRoomId = { ...(v.blockedByRoomId ?? {}) }
  const readStatesByRoomId = { ...(v.readStatesByRoomId ?? {}) }

  const legacy = v.inviteCodesByRoomId
  if (legacy && typeof legacy === 'object') {
    for (const [rid, codes] of Object.entries(legacy)) {
      if (!inviteStateByRoomId[rid] && Array.isArray(codes) && codes[0]) {
        inviteStateByRoomId[rid] = { code: String(codes[0]), expiresAt: defaultInviteExpiry() }
      }
    }
  }

  for (const r of rooms) {
    const id = r.id
    membersByRoomId[id] = membersByRoomId[id] ?? {}
    pendingRequestedAtByRoomId[id] = pendingRequestedAtByRoomId[id] ?? {}
    managersByRoomId[id] = managersByRoomId[id] ?? []
    blockedByRoomId[id] = blockedByRoomId[id] ?? []
    readStatesByRoomId[id] = readStatesByRoomId[id] ?? {}
    if (r.policy === 'invite' && !inviteStateByRoomId[id]) {
      inviteStateByRoomId[id] = {
        code: Math.random().toString(36).slice(2, 10).toUpperCase(),
        expiresAt: defaultInviteExpiry(),
      }
    }
  }

  return {
    rooms,
    messagesByRoomId,
    membersByRoomId,
    pendingRequestedAtByRoomId,
    inviteStateByRoomId,
    managersByRoomId,
    blockedByRoomId,
    readStatesByRoomId,
  }
}

export function createOpenChatDb(): OpenChatDb {
  const rooms: OpenChatRoom[] = [
    {
      id: 'md-all',
      title: 'MD들 다 모여라',
      policy: 'gated_open',
      tags: ['MD', '리테일', '커뮤니티'],
      ownerNickname: '운영자',
      createdAt: nowIso(),
    },
    {
      id: 'nurse',
      title: '간호사 다 모여라',
      policy: 'gated_open',
      tags: ['의료', '간호', '현장'],
      ownerNickname: '운영자',
      createdAt: nowIso(),
    },
    {
      id: 'teamroom-demo',
      title: '우리팀 팀룸(초대형) 샘플',
      policy: 'invite',
      tags: ['팀룸', '초대'],
      ownerNickname: '마스터',
      createdAt: nowIso(),
    },
  ]

  const messagesByRoomId: OpenChatDb['messagesByRoomId'] = {
    'md-all': [
      { id: 'm1', roomId: 'md-all', sender: '운영자', text: '환영합니다. MD들끼리 정보 공유해요.', createdAt: nowIso() },
    ],
    nurse: [
      { id: 'm1', roomId: 'nurse', sender: '운영자', text: '환영합니다. 간호 현장 팁/질문/공유 환영!', createdAt: nowIso() },
    ],
    'teamroom-demo': [
      { id: 'm1', roomId: 'teamroom-demo', sender: '마스터', text: '여기는 초대형 팀룸 샘플입니다.', createdAt: nowIso() },
    ],
  }

  const membersByRoomId: OpenChatDb['membersByRoomId'] = {
    'md-all': { 운영자: 'member' },
    nurse: { 운영자: 'member' },
    'teamroom-demo': { 마스터: 'member' },
  }

  const pendingRequestedAtByRoomId: OpenChatDb['pendingRequestedAtByRoomId'] = {}

  const inviteStateByRoomId: OpenChatDb['inviteStateByRoomId'] = {
    'teamroom-demo': { code: 'TEAM1234', expiresAt: defaultInviteExpiry() },
  }

  const managersByRoomId: OpenChatDb['managersByRoomId'] = {
    'md-all': [],
    nurse: [],
    'teamroom-demo': [],
  }

  const blockedByRoomId: OpenChatDb['blockedByRoomId'] = {
    'md-all': [],
    nurse: [],
    'teamroom-demo': [],
  }

  const readStatesByRoomId: OpenChatDb['readStatesByRoomId'] = {
    'md-all': {},
    nurse: {},
    'teamroom-demo': {},
  }

  return {
    rooms,
    messagesByRoomId,
    membersByRoomId,
    pendingRequestedAtByRoomId,
    inviteStateByRoomId,
    managersByRoomId,
    blockedByRoomId,
    readStatesByRoomId,
  }
}
