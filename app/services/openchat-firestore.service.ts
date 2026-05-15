import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

import type {
  CreateRoomRequest,
  GetMembershipResponse,
  JoinRoomRequest,
  ListRoomMembersResponse,
  MembershipStatus,
  OpenChatMessage,
  OpenChatRoom,
  PostMessageRequest,
  RoomInviteInfo,
  RoomMemberRow,
  RoomPolicy,
} from '@/features/openchat/openchat.types'

import { OWN_MESSAGE_CANCEL_MS } from '@/lib/openchat-read-receipt'
import { getFirebaseApp } from '@/firebase'

function firestore() {
  const app = getFirebaseApp()
  if (!app) throw new Error('Firebase 앱이 초기화되지 않았습니다. VITE_FIREBASE_* 및 VITE_USE_FIRESTORE=true 를 확인하세요.')
  return getFirestore(app)
}

function roomsCol() {
  return collection(firestore(), 'rooms')
}

function roomRef(roomId: string) {
  return doc(roomsCol(), roomId)
}

function messagesCol(roomId: string) {
  return collection(roomRef(roomId), 'messages')
}

function typingCol(roomId: string) {
  return collection(roomRef(roomId), 'typing')
}

function readStatesCol(roomId: string) {
  return collection(roomRef(roomId), 'readStates')
}

function membersCol(roomId: string) {
  return collection(roomRef(roomId), 'memberRecords')
}

function memberDocId(nickname: string) {
  return nickname.replace(/\//g, '__')
}

function tsToIso(t: Timestamp | { toDate?: () => Date } | undefined | null): string {
  if (!t) return new Date().toISOString()
  if (t instanceof Timestamp) return t.toDate().toISOString()
  if (typeof (t as Timestamp).toDate === 'function') return (t as Timestamp).toDate().toISOString()
  return new Date().toISOString()
}

function roomFromSnap(id: string, data: Record<string, unknown>): OpenChatRoom {
  return {
    id,
    title: String(data.title ?? ''),
    policy: (data.policy as RoomPolicy) ?? 'open_link',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    ownerNickname: String(data.ownerNickname ?? ''),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
  }
}

function msgFromSnap(roomId: string, id: string, data: Record<string, unknown>): OpenChatMessage {
  return {
    id,
    roomId,
    sender: String(data.sender ?? ''),
    text: String(data.text ?? ''),
    replyToMessageId: data.replyToMessageId ? String(data.replyToMessageId) : undefined,
    attachments: Array.isArray(data.attachments) ? (data.attachments as OpenChatMessage['attachments']) : undefined,
    deletedAt: data.deletedAt ? tsToIso(data.deletedAt as Timestamp) : undefined,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
  }
}

function defaultInviteExpiry() {
  return Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function uuid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

/** `listRooms`와 동일한 검색·정책 필터 (구독 콜백·UI에서 재사용) */
export function filterRoomsByParams(rooms: OpenChatRoom[], params?: { q?: string; policy?: RoomPolicy | '' }): OpenChatRoom[] {
  let out = rooms
  const qq = (params?.q ?? '').trim().toLowerCase()
  if (qq) {
    out = out.filter((r) => r.title.toLowerCase().includes(qq) || r.tags.some((t) => t.toLowerCase().includes(qq)))
  }
  if (params?.policy) {
    out = out.filter((r) => r.policy === params.policy)
  }
  return out
}

export async function listRooms(params?: { q?: string; policy?: RoomPolicy | '' }): Promise<OpenChatRoom[]> {
  const snap = await getDocs(query(roomsCol(), orderBy('createdAt', 'desc')))
  const rooms = snap.docs.map((d) => roomFromSnap(d.id, d.data() as Record<string, unknown>))
  return filterRoomsByParams(rooms, params)
}

/** 전체 방 목록(최신순) 실시간 구독 — 필터는 `filterRoomsByParams`로 적용 */
export function subscribeRoomsCollection(onUpdate: (rooms: OpenChatRoom[]) => void): () => void {
  const q = query(roomsCol(), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const rooms = snap.docs.map((d) => roomFromSnap(d.id, d.data() as Record<string, unknown>))
      onUpdate(rooms)
    },
    (err) => {
      console.error('[openchat-firestore] subscribeRoomsCollection', err)
      onUpdate([])
    },
  )
}

export async function createRoom(body: CreateRoomRequest): Promise<OpenChatRoom> {
  const title = body.title.trim()
  const rref = doc(roomsCol())
  const id = rref.id
  const now = serverTimestamp()
  const room: OpenChatRoom = {
    id,
    title,
    policy: body.policy,
    tags: body.tags ?? [],
    ownerNickname: body.ownerNickname.trim(),
    createdAt: new Date().toISOString(),
  }
  const batch = writeBatch(firestore())
  batch.set(rref, {
    title: room.title,
    policy: room.policy,
    tags: room.tags,
    ownerNickname: room.ownerNickname,
    createdAt: now,
    managers: [],
    blocked: [],
    ...(body.policy === 'invite'
      ? { inviteCode: randomInviteCode(), inviteExpiresAt: defaultInviteExpiry() }
      : {}),
  })
  batch.set(doc(membersCol(id), memberDocId(room.ownerNickname)), {
    nickname: room.ownerNickname,
    status: 'member',
    requestedAt: null,
  })
  const mref = doc(messagesCol(id), uuid())
  batch.set(mref, {
    sender: room.ownerNickname,
    text: '방이 생성되었습니다. 환영합니다!',
    createdAt: now,
  })
  await batch.commit()
  return room
}

export async function getRoom(roomId: string): Promise<OpenChatRoom> {
  const d = await getDoc(roomRef(roomId))
  if (!d.exists()) throw new Error('Room not found')
  return roomFromSnap(d.id, d.data() as Record<string, unknown>)
}

export async function listMessages(roomId: string): Promise<OpenChatMessage[]> {
  const q = query(messagesCol(roomId), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => msgFromSnap(roomId, d.id, d.data() as Record<string, unknown>))
}

/** 다른 클라이언트에서 보낸 메시지까지 반영하려면 방 화면에서 이 구독을 사용하세요. */
export function subscribeRoomMessages(roomId: string, onUpdate: (messages: OpenChatMessage[]) => void): () => void {
  const q = query(messagesCol(roomId), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => msgFromSnap(roomId, d.id, d.data() as Record<string, unknown>))
      onUpdate(list)
    },
    (err) => {
      console.error('[openchat-firestore] subscribeRoomMessages', err)
      onUpdate([])
    },
  )
}

const TYPING_TTL_MS = 6000

/** 다른 클라이언트 입력 중 표시(최근 `updatedAt` 기준, 약 6초 이내만 유효) */
export function subscribeRoomTyping(
  roomId: string,
  onUpdate: (rows: { nickname: string; atMs: number }[]) => void,
): () => void {
  const q = query(typingCol(roomId))
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const rows: { nickname: string; atMs: number }[] = []
      for (const d of snap.docs) {
        const data = d.data() as { nickname?: string; updatedAt?: Timestamp }
        const u = data.updatedAt
        if (!(u instanceof Timestamp)) continue
        const atMs = u.toMillis()
        if (now - atMs > TYPING_TTL_MS) continue
        rows.push({ nickname: String(data.nickname ?? '').trim() || d.id, atMs })
      }
      onUpdate(rows)
    },
    (err) => {
      console.error('[openchat-firestore] subscribeRoomTyping', err)
      onUpdate([])
    },
  )
}

export async function setTypingActivity(roomId: string, nickname: string, active: boolean): Promise<void> {
  const nick = nickname.trim()
  if (!nick) return
  const id = memberDocId(nick)
  const tref = doc(typingCol(roomId), id)
  if (!active) {
    try {
      await deleteDoc(tref)
    } catch {
      /* ignore */
    }
    return
  }
  await setDoc(tref, { nickname: nick, updatedAt: serverTimestamp() }, { merge: true })
}

/**
 * 멤버별 “여기까지 읽음” 커서. 값은 메시지 `createdAt`(ISO) 문자열 비교용.
 * invite / gated_open 은 멤버만 기록. open_link 는 누구나(목록·채팅 정책과 동일하게 클라이언트에서 호출).
 */
export async function setReadCursor(roomId: string, nickname: string, upToCreatedAt: string): Promise<void> {
  const room = await getRoom(roomId)
  const nick = nickname.trim()
  if (!nick || !upToCreatedAt.trim()) return

  if (room.policy === 'invite' || room.policy === 'gated_open') {
    const blocked = (await getDoc(roomRef(roomId))).data()?.blocked as string[] | undefined
    if (blocked?.includes(nick)) return
    if ((await getMembershipStatus(roomId, nick)) !== 'member') return
  }

  await setDoc(
    doc(readStatesCol(roomId), memberDocId(nick)),
    { nickname: nick, lastReadCreatedAt: upToCreatedAt.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export function subscribeRoomReadStates(
  roomId: string,
  onUpdate: (states: Record<string, string>) => void,
): () => void {
  const q = query(readStatesCol(roomId))
  return onSnapshot(
    q,
    (snap) => {
      const states: Record<string, string> = {}
      for (const d of snap.docs) {
        const data = d.data() as { nickname?: string; lastReadCreatedAt?: string }
        const n = String(data.nickname ?? d.id).trim()
        const at = String(data.lastReadCreatedAt ?? '').trim()
        if (n && at) states[n] = at
      }
      onUpdate(states)
    },
    (err) => {
      console.error('[openchat-firestore] subscribeRoomReadStates', err)
      onUpdate({})
    },
  )
}

export async function postMessage(roomId: string, body: PostMessageRequest): Promise<OpenChatMessage> {
  const room = await getRoom(roomId)
  const sender = body.sender.trim()
  const text = body.text.trim()
  const attachments = body.attachments
  if (!sender) throw new Error('sender is required')
  if (!text && (!attachments || attachments.length === 0)) throw new Error('text or attachments is required')

  if (room.policy === 'invite' || room.policy === 'gated_open') {
    const blocked = (await getDoc(roomRef(roomId))).data()?.blocked as string[] | undefined
    if (blocked?.includes(sender)) throw new Error('blocked from this room')
    const st = await getMembershipStatus(roomId, sender)
    if (st !== 'member') throw new Error('Not a member')
  }

  const replyToId = body.replyToMessageId?.trim() || undefined
  if (replyToId) {
    const pref = doc(messagesCol(roomId), replyToId)
    const ps = await getDoc(pref)
    if (!ps.exists()) throw new Error('답장 대상 메시지를 찾을 수 없어요.')
  }

  const id = uuid()
  const now = serverTimestamp()
  const mref = doc(messagesCol(roomId), id)
  await setDoc(mref, {
    sender,
    text,
    replyToMessageId: replyToId ?? null,
    attachments: attachments ?? null,
    createdAt: now,
  })
  return {
    id,
    roomId,
    sender,
    text,
    replyToMessageId: replyToId,
    attachments,
    createdAt: new Date().toISOString(),
  }
}

export async function deleteMessage(roomId: string, messageId: string, nickname: string): Promise<boolean> {
  const room = await getRoom(roomId)
  const mref = doc(messagesCol(roomId), messageId)
  const ms = await getDoc(mref)
  if (!ms.exists()) throw new Error('Message not found')
  const msg = msgFromSnap(roomId, messageId, ms.data() as Record<string, unknown>)
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  const isMod = room.ownerNickname === nickname || managers.includes(nickname)
  const isOwn = msg.sender === nickname
  if (!isMod && !isOwn) throw new Error('No permission')
  if (!isMod && isOwn) {
    const age = Date.now() - new Date(msg.createdAt).getTime()
    if (age > OWN_MESSAGE_CANCEL_MS) {
      throw new Error('본인 메시지는 전송 후 1분 이내에만 취소할 수 있어요.')
    }
  }
  await updateDoc(mref, {
    text: '',
    attachments: deleteField(),
    deletedAt: serverTimestamp(),
  })
  return true
}

async function getMembershipStatus(roomId: string, nickname: string): Promise<MembershipStatus> {
  const d = await getDoc(doc(membersCol(roomId), memberDocId(nickname)))
  if (!d.exists()) return 'none'
  const st = d.data()?.status as MembershipStatus | undefined
  if (st === 'pending') {
    const requestedAt = d.data()?.requestedAt as Timestamp | undefined
    if (requestedAt) {
      const ttl = 24 * 60 * 60 * 1000
      if (Date.now() - requestedAt.toMillis() > ttl) {
        await deleteDoc(doc(membersCol(roomId), memberDocId(nickname)))
        return 'none'
      }
    }
  }
  return st ?? 'none'
}

export async function getMembership(roomId: string, nickname: string): Promise<GetMembershipResponse> {
  const room = await getRoom(roomId)
  const status = await getMembershipStatus(roomId, nickname)
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  let pendingExpiresAt: string | undefined
  if (status === 'pending') {
    const d = await getDoc(doc(membersCol(roomId), memberDocId(nickname)))
    const at = d.data()?.requestedAt as Timestamp | undefined
    if (at) pendingExpiresAt = new Date(at.toMillis() + 24 * 60 * 60 * 1000).toISOString()
  }
  return {
    roomId,
    nickname,
    status,
    pendingExpiresAt,
    moderation: {
      isOwner: room.ownerNickname === nickname,
      isManager: managers.includes(nickname),
    },
  }
}

export async function joinRoom(roomId: string, body: JoinRoomRequest): Promise<MembershipStatus> {
  const room = await getRoom(roomId)
  const nickname = body.nickname.trim()
  const inviteCode = (body.inviteCode ?? '').trim()
  if (!nickname) throw new Error('nickname is required')

  const rdata = (await getDoc(roomRef(roomId))).data() as Record<string, unknown>
  const blocked = (rdata.blocked as string[]) ?? []
  if (blocked.includes(nickname)) throw new Error('blocked from this room')

  if (room.policy === 'open_link') {
    await setDoc(doc(membersCol(roomId), memberDocId(nickname)), {
      nickname,
      status: 'member',
      requestedAt: null,
    })
    return 'member'
  }
  if (room.policy === 'gated_open') {
    const cur = await getMembershipStatus(roomId, nickname)
    if (cur === 'member' || cur === 'pending') return cur
    await setDoc(doc(membersCol(roomId), memberDocId(nickname)), {
      nickname,
      status: 'pending',
      requestedAt: serverTimestamp(),
    })
    return 'pending'
  }
  const code = String(rdata.inviteCode ?? '')
  const exp = rdata.inviteExpiresAt as Timestamp | undefined
  if (!inviteCode) throw new Error('inviteCode is required')
  if (code !== inviteCode) throw new Error('invalid inviteCode')
  if (exp && exp.toMillis() < Date.now()) throw new Error('invite code expired')
  await setDoc(doc(membersCol(roomId), memberDocId(nickname)), {
    nickname,
    status: 'member',
    requestedAt: null,
  })
  return 'member'
}

async function isModeratorFull(room: OpenChatRoom, roomId: string, nickname: string): Promise<boolean> {
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  return room.ownerNickname === nickname || managers.includes(nickname)
}

export async function listJoinRequests(roomId: string, actorNickname: string): Promise<string[]> {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can view requests')
  const snap = await getDocs(query(membersCol(roomId), where('status', '==', 'pending')))
  return snap.docs.map((d) => String(d.data().nickname ?? ''))
}

export async function approveJoin(roomId: string, actorNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can approve')
  const st = await getMembershipStatus(roomId, targetNickname)
  if (st !== 'pending') throw new Error('target is not pending')
  await updateDoc(doc(membersCol(roomId), memberDocId(targetNickname)), {
    status: 'member',
    requestedAt: deleteField(),
  })
  return { roomId, targetNickname, status: 'member' as const }
}

export async function cancelPendingMembership(roomId: string, nickname: string) {
  const st = await getMembershipStatus(roomId, nickname)
  if (st !== 'pending') throw new Error('not pending')
  await deleteDoc(doc(membersCol(roomId), memberDocId(nickname)))
  return { ok: true as const }
}

export async function rejectJoin(roomId: string, actorNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can reject')
  if ((await getMembershipStatus(roomId, targetNickname)) !== 'pending') throw new Error('target is not pending')
  await updateDoc(doc(membersCol(roomId), memberDocId(targetNickname)), { status: 'rejected', requestedAt: deleteField() })
  return { roomId, targetNickname, status: 'rejected' as const }
}

export async function kickMember(roomId: string, actorNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can kick')
  if (targetNickname === room.ownerNickname) throw new Error('cannot kick owner')
  if ((await getMembershipStatus(roomId, targetNickname)) !== 'member') throw new Error('target is not a member')
  await deleteDoc(doc(membersCol(roomId), memberDocId(targetNickname)))
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  await updateDoc(roomRef(roomId), { managers: managers.filter((m) => m !== targetNickname) })
  return { ok: true as const }
}

export async function blockMember(roomId: string, actorNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can block')
  if (targetNickname === room.ownerNickname) throw new Error('cannot block owner')
  const rref = roomRef(roomId)
  const blocked = ((await getDoc(rref)).data()?.blocked as string[]) ?? []
  const managers = ((await getDoc(rref)).data()?.managers as string[]) ?? []
  if (!blocked.includes(targetNickname)) blocked.push(targetNickname)
  await updateDoc(rref, {
    blocked,
    managers: managers.filter((m) => m !== targetNickname),
  })
  await deleteDoc(doc(membersCol(roomId), memberDocId(targetNickname)))
  return { ok: true as const }
}

export async function unblockMember(roomId: string, actorNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can unblock')
  const rref = roomRef(roomId)
  const blocked = ((await getDoc(rref)).data()?.blocked as string[]) ?? []
  await updateDoc(rref, { blocked: blocked.filter((n) => n !== targetNickname) })
  return { ok: true as const }
}

export async function delegateOwner(roomId: string, fromNickname: string, toNickname: string) {
  const room = await getRoom(roomId)
  if (room.ownerNickname !== fromNickname) throw new Error('only current owner can delegate')
  if ((await getMembershipStatus(roomId, toNickname)) !== 'member') throw new Error('new owner must be a member')
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  await updateDoc(roomRef(roomId), {
    ownerNickname: toNickname,
    managers: managers.filter((m) => m !== toNickname),
  })
  return { roomId, ownerNickname: toNickname }
}

export async function addRoomManager(roomId: string, ownerNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (room.ownerNickname !== ownerNickname) throw new Error('only owner can add managers')
  if (targetNickname === room.ownerNickname) throw new Error('owner is already moderator')
  if ((await getMembershipStatus(roomId, targetNickname)) !== 'member') throw new Error('target must be a member')
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  if (!managers.includes(targetNickname)) managers.push(targetNickname)
  await updateDoc(roomRef(roomId), { managers })
  return { roomId, managers }
}

export async function removeRoomManager(roomId: string, ownerNickname: string, targetNickname: string) {
  const room = await getRoom(roomId)
  if (room.ownerNickname !== ownerNickname) throw new Error('only owner can remove managers')
  const managers = ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? []
  await updateDoc(roomRef(roomId), { managers: managers.filter((m) => m !== targetNickname) })
  return { roomId, managers: ((await getDoc(roomRef(roomId))).data()?.managers as string[]) ?? [] }
}

export async function getInviteInfo(roomId: string, nickname: string): Promise<RoomInviteInfo> {
  const room = await getRoom(roomId)
  if (room.policy !== 'invite') throw new Error('not an invite room')
  if (!(await isModeratorFull(room, roomId, nickname))) throw new Error('Only moderators can view invite info')
  const d = (await getDoc(roomRef(roomId))).data() as Record<string, unknown>
  let code = String(d.inviteCode ?? '')
  let exp = d.inviteExpiresAt as Timestamp | undefined
  if (!code) {
    code = randomInviteCode()
    exp = defaultInviteExpiry()
    await updateDoc(roomRef(roomId), { inviteCode: code, inviteExpiresAt: exp })
  }
  return { code, expiresAt: exp ? exp.toDate().toISOString() : defaultInviteExpiry().toDate().toISOString() }
}

export async function regenerateInviteCode(roomId: string, ownerNickname: string): Promise<RoomInviteInfo> {
  const room = await getRoom(roomId)
  if (room.policy !== 'invite') throw new Error('not an invite room')
  if (room.ownerNickname !== ownerNickname) throw new Error('only owner can regenerate invite code')
  const code = randomInviteCode()
  const exp = defaultInviteExpiry()
  await updateDoc(roomRef(roomId), { inviteCode: code, inviteExpiresAt: exp })
  return { code, expiresAt: exp.toDate().toISOString() }
}

export async function listRoomMembers(roomId: string, actorNickname: string): Promise<ListRoomMembersResponse> {
  const room = await getRoom(roomId)
  if (!(await isModeratorFull(room, roomId, actorNickname))) throw new Error('Only moderators can list members')
  const snap = await getDocs(membersCol(roomId))
  const members: RoomMemberRow[] = snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>
      const status = data.status as RoomMemberRow['status']
      const nickname = String(data.nickname ?? '')
      if (status === 'member' || status === 'pending' || status === 'rejected') return { nickname, status }
      return null
    })
    .filter(Boolean) as RoomMemberRow[]
  const rdata = (await getDoc(roomRef(roomId))).data() as Record<string, unknown>
  return {
    roomId,
    ownerNickname: room.ownerNickname,
    managers: (rdata.managers as string[]) ?? [],
    blocked: (rdata.blocked as string[]) ?? [],
    members,
  }
}
