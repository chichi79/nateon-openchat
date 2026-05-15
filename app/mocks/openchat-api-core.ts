import { defaultInviteExpiry } from './openchat.db'
import type { MemberRecordStatus, OpenChatDb } from './openchat.db'


import type {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
  GetMembershipResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ListMessagesResponse,
  ListRoomsResponse,
  ListRoomMembersResponse,
  OpenChatMessage,
  OpenChatRoom,
  PostMessageRequest,
  PostMessageResponse,
  RoomInviteInfo,
} from '@/features/openchat/openchat.types'

export type OpenChatApiCoreOptions = {
  loadInitialDb: () => OpenChatDb
  onPersist?: (db: OpenChatDb) => void
  /** 요청 처리 전에 다른 탭이 쓴 `localStorage` 등을 반영하려면 여기서 최신 DB를 반환 */
  syncInMemoryFromPersistence?: () => OpenChatDb | undefined
}

export function createOpenChatApiHandler(options: OpenChatApiCoreOptions) {
  let db = options.loadInitialDb()

  function persist() {
    options.onPersist?.(db)
  }

  /** gated_open 신청 유효 기간 (만료 시 none으로 정리, 재신청 가능) */
  const PENDING_REQUEST_TTL_MS = 24 * 60 * 60 * 1000

  function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...init,
  })
}

function notFound(message = 'Not found') {
  return json({ error: message }, { status: 404 })
}

function badRequest(message = 'Bad request') {
  return json({ error: message }, { status: 400 })
}

function methodNotAllowed() {
  return json({ error: 'Method not allowed' }, { status: 405 })
}

function uuid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function nowIso() {
  return new Date().toISOString()
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function matchPath(pathname: string) {
  // /api/openchat/rooms
  if (pathname === '/api/openchat/rooms') return { kind: 'rooms' as const }

  // /api/openchat/rooms/:roomId
  const roomMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)$/)
  if (roomMatch) return { kind: 'room' as const, roomId: decodeURIComponent(roomMatch[1]!) }

  // /api/openchat/rooms/:roomId/messages
  const msgMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/messages$/)
  if (msgMatch) return { kind: 'messages' as const, roomId: decodeURIComponent(msgMatch[1]!) }

  // /api/openchat/rooms/:roomId/messages/:messageId/delete
  const delMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/messages\/([^/]+)\/delete$/)
  if (delMatch)
    return {
      kind: 'deleteMessage' as const,
      roomId: decodeURIComponent(delMatch[1]!),
      messageId: decodeURIComponent(delMatch[2]!),
    }

  // /api/openchat/rooms/:roomId/membership
  const membershipMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/membership$/)
  if (membershipMatch) return { kind: 'membership' as const, roomId: decodeURIComponent(membershipMatch[1]!) }

  // /api/openchat/rooms/:roomId/join
  const joinMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/join$/)
  if (joinMatch) return { kind: 'join' as const, roomId: decodeURIComponent(joinMatch[1]!) }

  // /api/openchat/rooms/:roomId/requests
  const reqMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/requests$/)
  if (reqMatch) return { kind: 'requests' as const, roomId: decodeURIComponent(reqMatch[1]!) }

  // /api/openchat/rooms/:roomId/approve
  const approveMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/approve$/)
  if (approveMatch) return { kind: 'approve' as const, roomId: decodeURIComponent(approveMatch[1]!) }

  const cancelMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/membership\/cancel$/)
  if (cancelMatch) return { kind: 'cancelPending' as const, roomId: decodeURIComponent(cancelMatch[1]!) }

  const rejectMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/reject$/)
  if (rejectMatch) return { kind: 'reject' as const, roomId: decodeURIComponent(rejectMatch[1]!) }

  const kickMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/kick$/)
  if (kickMatch) return { kind: 'kick' as const, roomId: decodeURIComponent(kickMatch[1]!) }

  const blockMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/block$/)
  if (blockMatch) return { kind: 'block' as const, roomId: decodeURIComponent(blockMatch[1]!) }

  const unblockMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/unblock$/)
  if (unblockMatch) return { kind: 'unblock' as const, roomId: decodeURIComponent(unblockMatch[1]!) }

  const delegateMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/owner\/delegate$/)
  if (delegateMatch) return { kind: 'delegateOwner' as const, roomId: decodeURIComponent(delegateMatch[1]!) }

  const mgrAddMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/managers\/add$/)
  if (mgrAddMatch) return { kind: 'managersAdd' as const, roomId: decodeURIComponent(mgrAddMatch[1]!) }

  const mgrRmMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/managers\/remove$/)
  if (mgrRmMatch) return { kind: 'managersRemove' as const, roomId: decodeURIComponent(mgrRmMatch[1]!) }

  const inviteMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/invite$/)
  if (inviteMatch) return { kind: 'inviteInfo' as const, roomId: decodeURIComponent(inviteMatch[1]!) }

  const inviteRegenMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/invite\/regenerate$/)
  if (inviteRegenMatch) return { kind: 'inviteRegenerate' as const, roomId: decodeURIComponent(inviteRegenMatch[1]!) }

  const membersMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/members$/)
  if (membersMatch) return { kind: 'members' as const, roomId: decodeURIComponent(membersMatch[1]!) }

  const readCursorMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/read-cursor$/)
  if (readCursorMatch) return { kind: 'readCursor' as const, roomId: decodeURIComponent(readCursorMatch[1]!) }

  const readStatesMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/read-states$/)
  if (readStatesMatch) return { kind: 'readStates' as const, roomId: decodeURIComponent(readStatesMatch[1]!) }

  const deleteRoomMatch = pathname.match(/^\/api\/openchat\/rooms\/([^/]+)\/delete-room$/)
  if (deleteRoomMatch) return { kind: 'deleteRoom' as const, roomId: decodeURIComponent(deleteRoomMatch[1]!) }

  return { kind: 'unknown' as const }
}

function forbidden(message = 'Forbidden') {
  return json({ error: message }, { status: 403 })
}

function readClientIdFromRequest(req: Request): string | null {
  const h = req.headers.get('x-openchat-client-id')
  const t = h?.trim()
  return t || null
}

function resolveMemberKey(roomId: string, nickname: string, clientId: string | null | undefined): string {
  const cid = (clientId ?? '').trim()
  if (cid && db.clientIdToMemberKeyByRoomId[roomId]?.[cid]) {
    return db.clientIdToMemberKeyByRoomId[roomId][cid]!
  }
  return nickname
}

function isBlocked(roomId: string, nickname: string, clientId?: string | null) {
  const key = resolveMemberKey(roomId, nickname, clientId)
  return (db.blockedByRoomId[roomId] ?? []).includes(key)
}

function isManager(roomId: string, nickname: string) {
  return (db.managersByRoomId[roomId] ?? []).includes(nickname)
}

function isModerator(room: OpenChatRoom, roomId: string, nickname: string, clientId?: string | null) {
  const key = resolveMemberKey(roomId, nickname, clientId)
  const ownerByClient = !!(room.ownerClientId && clientId?.trim() && room.ownerClientId === clientId.trim())
  return ownerByClient || room.ownerNickname === key || isManager(roomId, key)
}

function isRoomOwner(room: OpenChatRoom, roomId: string, nickname: string, clientId?: string | null) {
  if (room.ownerClientId && clientId?.trim() && room.ownerClientId === clientId.trim()) return true
  const key = resolveMemberKey(roomId, nickname, clientId)
  return room.ownerNickname === key
}

function clearExpiredPending(roomId: string, nickname: string) {
  const rec = db.membersByRoomId[roomId] ?? {}
  if (rec[nickname] !== 'pending') return
  const at = db.pendingRequestedAtByRoomId[roomId]?.[nickname]
  if (!at) return
  if (Date.now() - new Date(at).getTime() > PENDING_REQUEST_TTL_MS) {
    const nextRec = { ...rec }
    delete nextRec[nickname]
    db.membersByRoomId[roomId] = nextRec
    const p = { ...(db.pendingRequestedAtByRoomId[roomId] ?? {}) }
    delete p[nickname]
    db.pendingRequestedAtByRoomId[roomId] = p
  }
}

function getMembershipStatus(roomId: string, nickname: string): 'none' | 'pending' | 'member' | 'rejected' {
  clearExpiredPending(roomId, nickname)
  const record = db.membersByRoomId[roomId] ?? {}
  const status = record[nickname]
  return status ?? 'none'
}

function pendingExpiresAt(roomId: string, nickname: string): string | undefined {
  if (getMembershipStatus(roomId, nickname) !== 'pending') return undefined
  const at = db.pendingRequestedAtByRoomId[roomId]?.[nickname]
  if (!at) return undefined
  return new Date(new Date(at).getTime() + PENDING_REQUEST_TTL_MS).toISOString()
}

function setMembershipStatus(roomId: string, nickname: string, status: MemberRecordStatus | 'none') {
  if (status === 'none') {
    const rec = { ...(db.membersByRoomId[roomId] ?? {}) }
    delete rec[nickname]
    db.membersByRoomId[roomId] = rec
    const p = { ...(db.pendingRequestedAtByRoomId[roomId] ?? {}) }
    delete p[nickname]
    db.pendingRequestedAtByRoomId[roomId] = p
    return
  }
  db.membersByRoomId[roomId] = { ...(db.membersByRoomId[roomId] ?? {}), [nickname]: status }
  if (status === 'pending') {
    db.pendingRequestedAtByRoomId[roomId] = {
      ...(db.pendingRequestedAtByRoomId[roomId] ?? {}),
      [nickname]: nowIso(),
    }
  } else {
    const p = { ...(db.pendingRequestedAtByRoomId[roomId] ?? {}) }
    delete p[nickname]
    db.pendingRequestedAtByRoomId[roomId] = p
  }
}

async function handleRooms(method: string, url: URL) {
  if (method !== 'GET') return methodNotAllowed()

  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const policy = (url.searchParams.get('policy') ?? '').trim()

  let rooms: OpenChatRoom[] = [...db.rooms]
  if (q) {
    rooms = rooms.filter((r) => r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q)))
  }
  if (policy) {
    rooms = rooms.filter((r) => r.policy === policy)
  }

  const payload: ListRoomsResponse = { rooms }
  return json(payload)
}

async function handleCreateRoom(method: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  let body: CreateRoomRequest | undefined
  try {
    body = (await request.json()) as CreateRoomRequest
  } catch {
    return badRequest('Invalid JSON body')
  }

  const title = (body?.title ?? '').trim()
  const policy = String(body?.policy ?? '').trim()
  const ownerNickname = (body?.ownerNickname ?? '').trim()
  const ownerClientId = (body?.ownerClientId ?? '').trim()
  const tags = Array.isArray(body?.tags) ? body!.tags.map((t) => String(t).trim()).filter(Boolean) : []

  if (!title) return badRequest('title is required')
  if (!policy) return badRequest('policy is required')
  if (!ownerNickname) return badRequest('ownerNickname is required')
  if (!['invite', 'open_link', 'gated_open'].includes(policy)) return badRequest('invalid policy')

  const idBase = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 24)
  const id = `${idBase || 'room'}-${Math.random().toString(16).slice(2, 6)}`

  const room: OpenChatRoom = {
    id,
    title,
    policy: policy as OpenChatRoom['policy'],
    tags,
    ownerNickname,
    ...(ownerClientId ? { ownerClientId } : {}),
    createdAt: nowIso(),
  }

  db.rooms = [room, ...db.rooms]
  db.membersByRoomId[id] = { [ownerNickname]: 'member' }
  db.clientIdToMemberKeyByRoomId[id] = {
    ...(db.clientIdToMemberKeyByRoomId[id] ?? {}),
    ...(ownerClientId ? { [ownerClientId]: ownerNickname } : {}),
  }
  db.pendingRequestedAtByRoomId[id] = {}
  db.managersByRoomId[id] = []
  db.blockedByRoomId[id] = []
  db.readStatesByRoomId[id] = {}
  if (policy === 'invite') {
    db.inviteStateByRoomId[id] = { code: randomInviteCode(), expiresAt: defaultInviteExpiry() }
  }
  db.messagesByRoomId[id] = [
    { id: uuid(), roomId: id, sender: ownerNickname, text: '방이 생성되었습니다. 환영합니다!', createdAt: nowIso() },
  ]

  persist()

  const payload: CreateRoomResponse = { room }
  return json(payload, { status: 201 })
}

async function handleRoom(method: string, roomId: string) {
  if (method !== 'GET') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  const payload: GetRoomResponse = { room }
  return json(payload)
}

async function handleDeleteRoom(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { nickname?: string } | undefined
  try {
    body = (await request.json()) as { nickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const nickname = (body?.nickname ?? '').trim()
  if (!nickname) return badRequest('nickname is required')
  const clientId = readClientIdFromRequest(request)
  const ok =
    (room.ownerClientId && clientId && room.ownerClientId === clientId.trim()) || room.ownerNickname === nickname
  if (!ok) return forbidden('only owner can delete room')

  db.rooms = db.rooms.filter((r) => r.id !== roomId)
  delete db.messagesByRoomId[roomId]
  delete db.membersByRoomId[roomId]
  delete db.clientIdToMemberKeyByRoomId[roomId]
  delete db.pendingRequestedAtByRoomId[roomId]
  delete db.managersByRoomId[roomId]
  delete db.blockedByRoomId[roomId]
  delete db.readStatesByRoomId[roomId]
  delete db.inviteStateByRoomId[roomId]
  persist()

  return json({ ok: true as const })
}

async function handleMessages(method: string, roomId: string, request: Request) {
  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  if (method === 'GET') {
    const messages: OpenChatMessage[] = db.messagesByRoomId[roomId] ?? []
    const payload: ListMessagesResponse = { messages }
    return json(payload)
  }

  if (method === 'POST') {
    let body: PostMessageRequest | undefined
    try {
      body = (await request.json()) as PostMessageRequest
    } catch {
      return badRequest('Invalid JSON body')
    }

    const sender = (body?.sender ?? '').trim()
    const text = (body?.text ?? '').trim()
    const replyToMessageId = (body?.replyToMessageId ?? '').trim() || undefined
    const attachments = Array.isArray(body?.attachments) ? body!.attachments : undefined
    if (!sender) return badRequest('sender is required')
    if (!text && (!attachments || attachments.length === 0)) return badRequest('text or attachments is required')

    const msgCid =
      (body?.senderClientId ?? '').trim() || readClientIdFromRequest(request) || undefined
    const senderKey = resolveMemberKey(roomId, sender, msgCid)

    // 정책별 메시지 전송 제한
    if (room.policy === 'invite' || room.policy === 'gated_open') {
      if (isBlocked(roomId, sender, msgCid)) return forbidden('blocked from this room')
      const status = getMembershipStatus(roomId, senderKey)
      if (status !== 'member') return forbidden('Not a member')
    }

    if (replyToMessageId) {
      const plist = db.messagesByRoomId[roomId] ?? []
      if (!plist.some((x) => x.id === replyToMessageId)) {
        return badRequest('답장 대상 메시지를 찾을 수 없어요.')
      }
    }

    const message: OpenChatMessage = {
      id: uuid(),
      roomId,
      sender,
      ...(msgCid ? { senderClientId: msgCid } : {}),
      text,
      replyToMessageId,
      attachments,
      createdAt: nowIso(),
    }

    db.messagesByRoomId[roomId] = [...(db.messagesByRoomId[roomId] ?? []), message]
    persist()

    const payload: PostMessageResponse = { message }
    return json(payload, { status: 201 })
  }

  return methodNotAllowed()
}

async function handleDeleteMessage(method: string, roomId: string, messageId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { nickname?: string } | undefined
  try {
    body = (await request.json()) as unknown as { nickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const nickname = (body?.nickname ?? '').trim()
  if (!nickname) return badRequest('nickname is required')
  const delCid = readClientIdFromRequest(request)

  const list = db.messagesByRoomId[roomId] ?? []
  const idx = list.findIndex((m) => m.id === messageId)
  if (idx < 0) return notFound('Message not found')

  const msg = list[idx]!
  const isMod = isModerator(room, roomId, nickname, delCid)
  if (!isMod) return forbidden('No permission')

  const next: OpenChatMessage = {
    ...msg,
    text: '',
    attachments: [],
    deletedAt: nowIso(),
  }

  db.messagesByRoomId[roomId] = [...list.slice(0, idx), next, ...list.slice(idx + 1)]
  persist()

  return json({ ok: true })
}

async function handleReadCursor(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { nickname?: string; upToCreatedAt?: string } | undefined
  try {
    body = (await request.json()) as unknown as { nickname?: string; upToCreatedAt?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const nickname = (body?.nickname ?? '').trim()
  const upToCreatedAt = (body?.upToCreatedAt ?? '').trim()
  if (!nickname) return badRequest('nickname is required')
  if (!upToCreatedAt) return badRequest('upToCreatedAt is required')

  const rcCid = readClientIdFromRequest(request)
  const key = resolveMemberKey(roomId, nickname, rcCid)

  if (room.policy === 'invite' || room.policy === 'gated_open') {
    if (isBlocked(roomId, nickname, rcCid)) return forbidden('blocked from this room')
    if (getMembershipStatus(roomId, key) !== 'member') return forbidden('Not a member')
  }

  db.readStatesByRoomId[roomId] = { ...(db.readStatesByRoomId[roomId] ?? {}), [key]: upToCreatedAt }
  persist()
  return json({ ok: true as const })
}

async function handleReadStates(method: string, roomId: string) {
  if (method !== 'GET') return methodNotAllowed()
  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')
  const states = db.readStatesByRoomId[roomId] ?? {}
  return json({ states })
}

async function handleMembership(method: string, roomId: string, url: URL, req: Request) {
  if (method !== 'GET') return methodNotAllowed()

  const nickname = (url.searchParams.get('nickname') ?? '').trim()
  if (!nickname) return badRequest('nickname is required')

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  const clientId = readClientIdFromRequest(req)
  const effectiveKey = resolveMemberKey(roomId, nickname, clientId)
  clearExpiredPending(roomId, effectiveKey)
  const status = getMembershipStatus(roomId, effectiveKey)
  const payload: GetMembershipResponse = {
    roomId,
    nickname,
    status,
    pendingExpiresAt: status === 'pending' ? pendingExpiresAt(roomId, effectiveKey) : undefined,
    moderation: {
      isOwner:
        !!(room.ownerClientId && clientId && room.ownerClientId === clientId.trim()) || room.ownerNickname === effectiveKey,
      isManager: isManager(roomId, effectiveKey),
    },
  }
  return json(payload)
}

async function handleJoin(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: JoinRoomRequest | undefined
  try {
    body = (await request.json()) as JoinRoomRequest
  } catch {
    return badRequest('Invalid JSON body')
  }

  const nickname = (body?.nickname ?? '').trim()
  const inviteCode = (body?.inviteCode ?? '').trim()
  if (!nickname) return badRequest('nickname is required')

  const joinCid = (body?.clientId ?? '').trim() || readClientIdFromRequest(request)

  if (isBlocked(roomId, nickname, joinCid || null)) return forbidden('blocked from this room')

  if (room.policy === 'open_link') {
    setMembershipStatus(roomId, nickname, 'member')
  } else if (room.policy === 'gated_open') {
    const memberKey = resolveMemberKey(roomId, nickname, joinCid || null)
    const current = getMembershipStatus(roomId, memberKey)
    if (current === 'member') {
      // noop
    } else if (current === 'pending') {
      // noop
    } else if (current === 'none' || current === 'rejected') {
      setMembershipStatus(roomId, nickname, 'pending')
    }
  } else if (room.policy === 'invite') {
    const state = db.inviteStateByRoomId[roomId]
    if (!inviteCode) return forbidden('inviteCode is required')
    if (!state || state.code !== inviteCode) return forbidden('invalid inviteCode')
    if (new Date(state.expiresAt).getTime() < Date.now()) return forbidden('invite code expired')
    setMembershipStatus(roomId, nickname, 'member')
  }

  if (joinCid) {
    const prev = db.clientIdToMemberKeyByRoomId[roomId]?.[joinCid]
    const stableMemberKey = prev ?? nickname
    db.clientIdToMemberKeyByRoomId[roomId] = { ...(db.clientIdToMemberKeyByRoomId[roomId] ?? {}), [joinCid]: stableMemberKey }
  }

  persist()

  const statusKey = joinCid ? resolveMemberKey(roomId, nickname, joinCid) : nickname
  const status = getMembershipStatus(roomId, statusKey)
  const payload: JoinRoomResponse = { roomId, nickname, status }
  return json(payload, { status: 200 })
}

async function handleRequests(method: string, roomId: string, url: URL, req: Request) {
  if (method !== 'GET') return methodNotAllowed()

  const nickname = (url.searchParams.get('nickname') ?? '').trim()
  if (!nickname) return badRequest('nickname is required')

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  const cid = readClientIdFromRequest(req)
  if (!isModerator(room, roomId, nickname, cid)) return forbidden('Only moderators can view requests')

  const members = db.membersByRoomId[roomId] ?? {}
  const pendingNicknames = Object.entries(members)
    .filter(([, st]) => st === 'pending')
    .map(([n]) => n)

  return json({ roomId, pendingNicknames })
}

async function handleApprove(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { ownerNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as unknown as { ownerNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }

  const ownerNickname = (body?.ownerNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!ownerNickname) return badRequest('ownerNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const approveCid = readClientIdFromRequest(request)
  if (!isModerator(room, roomId, ownerNickname, approveCid)) return forbidden('Only moderators can approve')

  const status = getMembershipStatus(roomId, targetNickname)
  if (status !== 'pending') return badRequest('target is not pending')

  setMembershipStatus(roomId, targetNickname, 'member')
  persist()
  return json({ roomId, targetNickname, status: 'member' })
}

async function handleCancelPending(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { nickname?: string } | undefined
  try {
    body = (await request.json()) as { nickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const nickname = (body?.nickname ?? '').trim()
  if (!nickname) return badRequest('nickname is required')
  const cancelCid = readClientIdFromRequest(request)
  const cancelKey = resolveMemberKey(roomId, nickname, cancelCid)
  if (getMembershipStatus(roomId, cancelKey) !== 'pending') return badRequest('not pending')
  setMembershipStatus(roomId, cancelKey, 'none')
  persist()
  return json({ ok: true as const })
}

async function handleReject(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { actorNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { actorNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const actorNickname = (body?.actorNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!actorNickname) return badRequest('actorNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const rejectCid = readClientIdFromRequest(request)
  if (!isModerator(room, roomId, actorNickname, rejectCid)) return forbidden('Only moderators can reject')
  if (getMembershipStatus(roomId, targetNickname) !== 'pending') return badRequest('target is not pending')

  setMembershipStatus(roomId, targetNickname, 'rejected')
  persist()
  return json({ roomId, targetNickname, status: 'rejected' as const })
}

async function handleKick(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { actorNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { actorNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const actorNickname = (body?.actorNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!actorNickname) return badRequest('actorNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const kickCid = readClientIdFromRequest(request)
  if (!isModerator(room, roomId, actorNickname, kickCid)) return forbidden('Only moderators can kick')
  if (resolveMemberKey(roomId, targetNickname, null) === room.ownerNickname) return badRequest('cannot kick owner')
  if (getMembershipStatus(roomId, targetNickname) !== 'member') return badRequest('target is not a member')

  setMembershipStatus(roomId, targetNickname, 'none')
  db.managersByRoomId[roomId] = (db.managersByRoomId[roomId] ?? []).filter((m) => m !== targetNickname)
  persist()
  return json({ ok: true as const })
}

async function handleBlock(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { actorNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { actorNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const actorNickname = (body?.actorNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!actorNickname) return badRequest('actorNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const blockCid = readClientIdFromRequest(request)
  if (!isModerator(room, roomId, actorNickname, blockCid)) return forbidden('Only moderators can block')
  if (resolveMemberKey(roomId, targetNickname, null) === room.ownerNickname) return badRequest('cannot block owner')

  const blocked = new Set(db.blockedByRoomId[roomId] ?? [])
  blocked.add(targetNickname)
  db.blockedByRoomId[roomId] = [...blocked]
  setMembershipStatus(roomId, targetNickname, 'none')
  db.managersByRoomId[roomId] = (db.managersByRoomId[roomId] ?? []).filter((m) => m !== targetNickname)
  persist()
  return json({ ok: true as const })
}

async function handleUnblock(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { actorNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { actorNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const actorNickname = (body?.actorNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!actorNickname) return badRequest('actorNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const unblockCid = readClientIdFromRequest(request)
  if (!isModerator(room, roomId, actorNickname, unblockCid)) return forbidden('Only moderators can unblock')

  db.blockedByRoomId[roomId] = (db.blockedByRoomId[roomId] ?? []).filter((n) => n !== targetNickname)
  persist()
  return json({ ok: true as const })
}

async function handleDelegateOwner(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { fromNickname?: string; toNickname?: string } | undefined
  try {
    body = (await request.json()) as { fromNickname?: string; toNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const fromNickname = (body?.fromNickname ?? '').trim()
  const toNickname = (body?.toNickname ?? '').trim()
  if (!fromNickname) return badRequest('fromNickname is required')
  if (!toNickname) return badRequest('toNickname is required')
  const delOwnerCid = readClientIdFromRequest(request)
  if (!isRoomOwner(room, roomId, fromNickname, delOwnerCid)) return forbidden('only current owner can delegate')
  if (getMembershipStatus(roomId, toNickname) !== 'member') return badRequest('new owner must be a member')

  room.ownerNickname = toNickname
  const map = db.clientIdToMemberKeyByRoomId[roomId] ?? {}
  let nextOwnerClient: string | undefined
  for (const [cid, key] of Object.entries(map)) {
    if (key === toNickname) {
      nextOwnerClient = cid
      break
    }
  }
  room.ownerClientId = nextOwnerClient
  db.managersByRoomId[roomId] = (db.managersByRoomId[roomId] ?? []).filter((m) => m !== toNickname)
  persist()
  return json({ roomId, ownerNickname: toNickname })
}

async function handleManagersAdd(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { ownerNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { ownerNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const ownerNickname = (body?.ownerNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!ownerNickname) return badRequest('ownerNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const mgrAddCid = readClientIdFromRequest(request)
  if (!isRoomOwner(room, roomId, ownerNickname, mgrAddCid)) return forbidden('only owner can add managers')
  if (targetNickname === room.ownerNickname) return badRequest('owner is already moderator')
  if (getMembershipStatus(roomId, targetNickname) !== 'member') return badRequest('target must be a member')

  const mgrs = new Set(db.managersByRoomId[roomId] ?? [])
  mgrs.add(targetNickname)
  db.managersByRoomId[roomId] = [...mgrs]
  persist()
  return json({ roomId, managers: db.managersByRoomId[roomId] })
}

async function handleManagersRemove(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')

  let body: { ownerNickname?: string; targetNickname?: string } | undefined
  try {
    body = (await request.json()) as { ownerNickname?: string; targetNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const ownerNickname = (body?.ownerNickname ?? '').trim()
  const targetNickname = (body?.targetNickname ?? '').trim()
  if (!ownerNickname) return badRequest('ownerNickname is required')
  if (!targetNickname) return badRequest('targetNickname is required')
  const mgrRmCid = readClientIdFromRequest(request)
  if (!isRoomOwner(room, roomId, ownerNickname, mgrRmCid)) return forbidden('only owner can remove managers')

  db.managersByRoomId[roomId] = (db.managersByRoomId[roomId] ?? []).filter((m) => m !== targetNickname)
  persist()
  return json({ roomId, managers: db.managersByRoomId[roomId] })
}

async function handleInviteInfo(method: string, roomId: string, url: URL, req: Request) {
  if (method !== 'GET') return methodNotAllowed()

  const nickname = (url.searchParams.get('nickname') ?? '').trim()
  if (!nickname) return badRequest('nickname is required')

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')
  if (room.policy !== 'invite') return badRequest('not an invite room')
  const invCid = readClientIdFromRequest(req)
  if (!isModerator(room, roomId, nickname, invCid)) return forbidden('Only moderators can view invite info')

  const state = db.inviteStateByRoomId[roomId] ?? { code: randomInviteCode(), expiresAt: defaultInviteExpiry() }
  db.inviteStateByRoomId[roomId] = state
  const payload: RoomInviteInfo = { code: state.code, expiresAt: state.expiresAt }
  return json(payload)
}

async function handleInviteRegenerate(method: string, roomId: string, request: Request) {
  if (method !== 'POST') return methodNotAllowed()

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')
  if (room.policy !== 'invite') return badRequest('not an invite room')

  let body: { ownerNickname?: string } | undefined
  try {
    body = (await request.json()) as { ownerNickname?: string }
  } catch {
    return badRequest('Invalid JSON body')
  }
  const ownerNickname = (body?.ownerNickname ?? '').trim()
  if (!ownerNickname) return badRequest('ownerNickname is required')
  const regenCid = readClientIdFromRequest(request)
  if (!isRoomOwner(room, roomId, ownerNickname, regenCid)) return forbidden('only owner can regenerate invite code')

  db.inviteStateByRoomId[roomId] = { code: randomInviteCode(), expiresAt: defaultInviteExpiry() }
  persist()
  const s = db.inviteStateByRoomId[roomId]!
  const payload: RoomInviteInfo = { code: s.code, expiresAt: s.expiresAt }
  return json(payload)
}

async function handleListMembers(method: string, roomId: string, url: URL, req: Request) {
  if (method !== 'GET') return methodNotAllowed()

  const nickname = (url.searchParams.get('nickname') ?? '').trim()
  if (!nickname) return badRequest('nickname is required')

  const room = db.rooms.find((r) => r.id === roomId)
  if (!room) return notFound('Room not found')
  const listCid = readClientIdFromRequest(req)
  if (!isModerator(room, roomId, nickname, listCid)) return forbidden('Only moderators can list members')

  const raw = db.membersByRoomId[roomId] ?? {}
  const members = Object.entries(raw)
    .filter(([, st]) => st === 'member' || st === 'pending' || st === 'rejected')
    .map(([n, status]) => ({ nickname: n, status }))

  const payload: ListRoomMembersResponse = {
    roomId,
    ownerNickname: room.ownerNickname,
    managers: db.managersByRoomId[roomId] ?? [],
    blocked: db.blockedByRoomId[roomId] ?? [],
    members,
  }
  return json(payload)
}
  return async function handleOpenChatApiRequest(req: Request): Promise<Response> {
    const synced = options.syncInMemoryFromPersistence?.()
    if (synced !== undefined) db = synced

    const url = new URL(req.url)
    const method = (req.method || 'GET').toUpperCase()
    const match = matchPath(url.pathname)

    switch (match.kind) {
      case 'rooms':
        if (method === 'POST') return handleCreateRoom(method, req)
        return handleRooms(method, url)
      case 'room':
        return handleRoom(method, match.roomId)
      case 'messages':
        return handleMessages(method, match.roomId, req)
      case 'deleteMessage':
        return handleDeleteMessage(method, match.roomId, match.messageId, req)
      case 'membership':
        return handleMembership(method, match.roomId, url, req)
      case 'join':
        return handleJoin(method, match.roomId, req)
      case 'requests':
        return handleRequests(method, match.roomId, url, req)
      case 'approve':
        return handleApprove(method, match.roomId, req)
      case 'cancelPending':
        return handleCancelPending(method, match.roomId, req)
      case 'reject':
        return handleReject(method, match.roomId, req)
      case 'kick':
        return handleKick(method, match.roomId, req)
      case 'block':
        return handleBlock(method, match.roomId, req)
      case 'unblock':
        return handleUnblock(method, match.roomId, req)
      case 'delegateOwner':
        return handleDelegateOwner(method, match.roomId, req)
      case 'managersAdd':
        return handleManagersAdd(method, match.roomId, req)
      case 'managersRemove':
        return handleManagersRemove(method, match.roomId, req)
      case 'inviteInfo':
        return handleInviteInfo(method, match.roomId, url, req)
      case 'inviteRegenerate':
        return handleInviteRegenerate(method, match.roomId, req)
      case 'members':
        return handleListMembers(method, match.roomId, url, req)
      case 'readCursor':
        return handleReadCursor(method, match.roomId, req)
      case 'readStates':
        return handleReadStates(method, match.roomId)
      case 'deleteRoom':
        return handleDeleteRoom(method, match.roomId, req)
      default:
        return notFound('Unknown API endpoint')
    }
  }
}
