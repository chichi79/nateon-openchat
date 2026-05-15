import type {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
  GetMembershipResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ListMessagesResponse,
  ListRoomMembersResponse,
  ListRoomsResponse,
  OpenChatRoom,
  OpenChatMessage,
  PostMessageRequest,
  PostMessageResponse,
  RoomInviteInfo,
  RoomPolicy,
} from '@/features/openchat/openchat.types'

import { useOpenchatFirestore } from '@/config/openchat-backend'
import * as openchatFs from '@/services/openchat-firestore.service'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T
  if (!res.ok) {
    const maybeError = data as unknown as { error?: unknown }
    const message = typeof maybeError?.error === 'string' ? maybeError.error : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function listRooms(params?: { q?: string; policy?: RoomPolicy | '' }): Promise<OpenChatRoom[]> {
  if (useOpenchatFirestore()) return openchatFs.listRooms(params)
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.policy) sp.set('policy', params.policy)

  const res = await fetch(`/api/openchat/rooms${sp.toString() ? `?${sp}` : ''}`)
  const data = await parseJson<ListRoomsResponse>(res)
  return data.rooms
}

export async function createRoom(body: CreateRoomRequest): Promise<OpenChatRoom> {
  if (useOpenchatFirestore()) return openchatFs.createRoom(body)
  const res = await fetch('/api/openchat/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseJson<CreateRoomResponse>(res)
  return data.room
}

export async function getRoom(roomId: string): Promise<OpenChatRoom> {
  if (useOpenchatFirestore()) return openchatFs.getRoom(roomId)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}`)
  const data = await parseJson<GetRoomResponse>(res)
  return data.room
}

export async function listMessages(roomId: string): Promise<OpenChatMessage[]> {
  if (useOpenchatFirestore()) return openchatFs.listMessages(roomId)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/messages`)
  const data = await parseJson<ListMessagesResponse>(res)
  return data.messages
}

export async function postMessage(roomId: string, body: PostMessageRequest): Promise<OpenChatMessage> {
  if (useOpenchatFirestore()) return openchatFs.postMessage(roomId, body)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseJson<PostMessageResponse>(res)
  return data.message
}

export async function deleteMessage(roomId: string, messageId: string, nickname: string) {
  if (useOpenchatFirestore()) return openchatFs.deleteMessage(roomId, messageId, nickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  })
  const data = await parseJson<{ ok: true }>(res)
  return data.ok
}

export async function getMembership(roomId: string, nickname: string): Promise<GetMembershipResponse> {
  if (useOpenchatFirestore()) return openchatFs.getMembership(roomId, nickname)
  const res = await fetch(
    `/api/openchat/rooms/${encodeURIComponent(roomId)}/membership?nickname=${encodeURIComponent(nickname)}`
  )
  return parseJson<GetMembershipResponse>(res)
}

export async function joinRoom(roomId: string, body: JoinRoomRequest) {
  if (useOpenchatFirestore()) return openchatFs.joinRoom(roomId, body)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseJson<JoinRoomResponse>(res)
  return data.status
}

export async function listJoinRequests(roomId: string, ownerNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.listJoinRequests(roomId, ownerNickname)
  const res = await fetch(
    `/api/openchat/rooms/${encodeURIComponent(roomId)}/requests?nickname=${encodeURIComponent(ownerNickname)}`
  )
  const data = await parseJson<{ roomId: string; pendingNicknames: string[] }>(res)
  return data.pendingNicknames
}

export async function approveJoin(roomId: string, actorNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.approveJoin(roomId, actorNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerNickname: actorNickname, targetNickname }),
  })
  const data = await parseJson<{ roomId: string; targetNickname: string; status: 'member' }>(res)
  return data
}

export async function cancelPendingMembership(roomId: string, nickname: string) {
  if (useOpenchatFirestore()) return openchatFs.cancelPendingMembership(roomId, nickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/membership/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  })
  return parseJson<{ ok: true }>(res)
}

export async function rejectJoin(roomId: string, actorNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.rejectJoin(roomId, actorNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorNickname, targetNickname }),
  })
  return parseJson<{ roomId: string; targetNickname: string; status: 'rejected' }>(res)
}

export async function kickMember(roomId: string, actorNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.kickMember(roomId, actorNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/kick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorNickname, targetNickname }),
  })
  return parseJson<{ ok: true }>(res)
}

export async function blockMember(roomId: string, actorNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.blockMember(roomId, actorNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorNickname, targetNickname }),
  })
  return parseJson<{ ok: true }>(res)
}

export async function unblockMember(roomId: string, actorNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.unblockMember(roomId, actorNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/unblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorNickname, targetNickname }),
  })
  return parseJson<{ ok: true }>(res)
}

export async function delegateOwner(roomId: string, fromNickname: string, toNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.delegateOwner(roomId, fromNickname, toNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/owner/delegate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromNickname, toNickname }),
  })
  return parseJson<{ roomId: string; ownerNickname: string }>(res)
}

export async function addRoomManager(roomId: string, ownerNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.addRoomManager(roomId, ownerNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/managers/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerNickname, targetNickname }),
  })
  return parseJson<{ roomId: string; managers: string[] }>(res)
}

export async function removeRoomManager(roomId: string, ownerNickname: string, targetNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.removeRoomManager(roomId, ownerNickname, targetNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/managers/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerNickname, targetNickname }),
  })
  return parseJson<{ roomId: string; managers: string[] }>(res)
}

export async function getInviteInfo(roomId: string, nickname: string) {
  if (useOpenchatFirestore()) return openchatFs.getInviteInfo(roomId, nickname)
  const res = await fetch(
    `/api/openchat/rooms/${encodeURIComponent(roomId)}/invite?nickname=${encodeURIComponent(nickname)}`
  )
  return parseJson<RoomInviteInfo>(res)
}

export async function regenerateInviteCode(roomId: string, ownerNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.regenerateInviteCode(roomId, ownerNickname)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/invite/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerNickname }),
  })
  return parseJson<RoomInviteInfo>(res)
}

export async function listRoomMembers(roomId: string, actorNickname: string) {
  if (useOpenchatFirestore()) return openchatFs.listRoomMembers(roomId, actorNickname)
  const res = await fetch(
    `/api/openchat/rooms/${encodeURIComponent(roomId)}/members?nickname=${encodeURIComponent(actorNickname)}`
  )
  return parseJson<ListRoomMembersResponse>(res)
}

export function subscribeRoomTyping(
  roomId: string,
  onUpdate: (rows: { nickname: string; atMs: number }[]) => void,
): () => void {
  if (useOpenchatFirestore()) return openchatFs.subscribeRoomTyping(roomId, onUpdate)
  return () => {}
}

export function setTypingActivity(roomId: string, nickname: string, active: boolean): void {
  if (useOpenchatFirestore()) void openchatFs.setTypingActivity(roomId, nickname, active)
}

export async function setReadCursor(roomId: string, nickname: string, upToCreatedAt: string): Promise<void> {
  if (useOpenchatFirestore()) return openchatFs.setReadCursor(roomId, nickname, upToCreatedAt)
  const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/read-cursor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, upToCreatedAt }),
  })
  await parseJson<{ ok: true }>(res)
}

export function subscribeRoomReadStates(
  roomId: string,
  onUpdate: (states: Record<string, string>) => void,
): () => void {
  if (useOpenchatFirestore()) return openchatFs.subscribeRoomReadStates(roomId, onUpdate)
  let cancelled = false
  const tick = async () => {
    if (cancelled) return
    try {
      const res = await fetch(`/api/openchat/rooms/${encodeURIComponent(roomId)}/read-states`)
      const data = await parseJson<{ states: Record<string, string> }>(res)
      if (!cancelled) onUpdate(data.states ?? {})
    } catch {
      if (!cancelled) onUpdate({})
    }
  }
  void tick()
  const iv = window.setInterval(tick, 3000)
  return () => {
    cancelled = true
    window.clearInterval(iv)
  }
}
