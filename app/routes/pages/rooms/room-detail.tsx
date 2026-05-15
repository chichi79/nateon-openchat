import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, isRouteErrorResponse, useFetcher, useLoaderData, useNavigate, useRevalidator } from 'react-router'

import type {
  GetMembershipResponse,
  ListRoomMembersResponse,
  OpenChatAttachment,
  OpenChatMessage,
  OpenChatRoom,
  RoomInviteInfo,
} from '@/features/openchat/openchat.types'

import { isViteEnvFalse } from '@/lib/vite-env-flags'
import { openchatDisplaySenderName } from '@/lib/openchat-display-name'
import { canSenderCancelOwnMessage, countReadersForMessage, textMentionsNickname } from '@/lib/openchat-read-receipt'
import { useOpenchatFirestore } from '@/config/openchat-backend'
import {
  addRoomManager,
  approveJoin,
  blockMember,
  cancelPendingMembership,
  delegateOwner,
  deleteMessage,
  deleteRoom,
  getInviteInfo,
  getMembership,
  getRoom,
  joinRoom,
  kickMember,
  listJoinRequests,
  listMessages,
  listRoomMembers,
  postMessage,
  regenerateInviteCode,
  rejectJoin,
  removeRoomManager,
  setReadCursor,
  setTypingActivity,
  subscribeRoomReadStates,
  subscribeRoomTyping,
  unblockMember,
} from '@/services/openchat.service'
import { subscribeRoomMessages } from '@/services/openchat-firestore.service'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { OPENCHAT_MOCK_DB_STORAGE_KEY } from '@/mocks/install-mock-fetch'
import type { Route } from './+types/room-detail'

export async function clientLoader({ params }: { params: Record<string, string | undefined> }) {
  const raw = params.roomId
  if (!raw) throw new Response('roomId is required', { status: 400 })
  const roomId = decodeURIComponent(raw).trim()
  if (!roomId) throw new Response('roomId is required', { status: 400 })

  const senderName = openchatDisplaySenderName()

  try {
    const room = await getRoom(roomId)
    let initialMe: GetMembershipResponse
    try {
      initialMe = await getMembership(roomId, senderName)
    } catch {
      initialMe = {
        roomId,
        nickname: senderName,
        status: 'none',
        moderation: { isOwner: false, isManager: false },
      }
    }

    const canLoadMessages = room.policy === 'open_link' || initialMe.status === 'member'
    const messages = canLoadMessages ? await listMessages(roomId) : []

    return { room, messages, initialMe }
  } catch (e) {
    if (e instanceof Error && e.message === 'Room not found') {
      throw new Response(null, { status: 404, statusText: 'Room not found' })
    }
    throw e
  }
}

export async function clientAction({ request, params }: { request: Request; params: Record<string, string | undefined> }) {
  const roomId = params.roomId
  if (!roomId) throw new Response('roomId is required', { status: 400 })

  const form = await request.formData()
  const text = String(form.get('text') ?? '')
  const sender = String(form.get('sender') ?? '게스트')
  const replyToMessageId = String(form.get('replyToMessageId') ?? '') || undefined
  const attachmentsJson = String(form.get('attachmentsJson') ?? '')
  const attachments = attachmentsJson ? (JSON.parse(attachmentsJson) as OpenChatAttachment[]) : undefined

  const message = await postMessage(roomId, { sender, text, replyToMessageId, attachments })
  return { message }
}

function timeLabel(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function dayLabel(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
  } catch {
    return iso
  }
}

function shortDeadline(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[A-Za-z0-9가-힣_]+)/g)
  return parts.map((p, i) => {
    if (p.startsWith('@') && p.length > 1) {
      return (
        <span key={i} className='font-medium text-[#BFD0FF]'>
          {p}
        </span>
      )
    }
    return <span key={i}>{p}</span>
  })
}

type ModeratorPanelTab = 'invite' | 'requests' | 'members'

function policyChipFor(policy: OpenChatRoom['policy']) {
  switch (policy) {
    case 'invite':
      return { label: '초대형', cls: 'chip chip-amber' }
    case 'open_link':
      return { label: '공개형', cls: 'chip chip-emerald' }
    case 'gated_open':
      return { label: '신청/승인형', cls: 'chip chip-brand' }
  }
}

function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (a + 60) % 360
  return `linear-gradient(135deg, hsl(${a} 70% 58%) 0%, hsl(${b} 70% 50%) 100%)`
}

function initialOf(text: string) {
  const t = text.trim()
  if (!t) return '?'
  return [...t][0]!.toUpperCase()
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className='inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)] ring-1 ring-inset ring-slate-300/40 dark:ring-white/15'
      style={{ width: size, height: size, backgroundImage: gradientFor(name) }}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  )
}

export default function RoomDetailPage() {
  const { room, messages, initialMe } = useLoaderData() as {
    room: OpenChatRoom
    messages: OpenChatMessage[]
    initialMe: GetMembershipResponse
  }
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const fetcher = useFetcher() as unknown as {
    Form: typeof useFetcher.prototype.Form
    data?: { message?: OpenChatMessage }
    state: 'idle' | 'loading' | 'submitting'
  }
  const [nickname, setNickname] = useLocalStorageState('openchat.nickname', '게스트')
  const senderName = nickname?.trim() || '게스트'
  const formRef = useRef<HTMLFormElement | null>(null)
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatBottomAnchorRef = useRef<HTMLLIElement | null>(null)
  const isAtBottomRef = useRef(true)
  const [me, setMe] = useState<GetMembershipResponse>(initialMe)
  const membership = me.status
  const isOwner = me.moderation?.isOwner ?? false
  const isManager = me.moderation?.isManager ?? false
  const isModerator = isOwner || isManager
  const [inviteCode, setInviteCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [pendingNicknames, setPendingNicknames] = useState<string[]>([])
  const [adminError, setAdminError] = useState<string | null>(null)
  const [memberDirectory, setMemberDirectory] = useState<ListRoomMembersResponse | null>(null)
  const [inviteMeta, setInviteMeta] = useState<RoomInviteInfo | null>(null)
  const [delegateTo, setDelegateTo] = useState('')
  const [managerTarget, setManagerTarget] = useState('')
  const [deleteRoomBusy, setDeleteRoomBusy] = useState(false)
  const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<OpenChatMessage | null>(null)
  const [attachments, setAttachments] = useState<OpenChatAttachment[]>([])
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollTopFab, setShowScrollTopFab] = useState(false)
  const scrollAfterOwnSendRef = useRef(false)
  /** 전송 직후 useLayoutEffect에서 스크롤 처리 시, 다음 lastMsgId effect의 "새 메시지" 배지 1회 생략 */
  const suppressNextNewMsgBadgeRef = useRef(false)
  const nicknameModalRef = useRef<HTMLDivElement | null>(null)
  const mentionNotifiedIdsRef = useRef<Set<string>>(new Set())
  const lastMentionRoomIdRef = useRef<string | null>(null)
  const typingPingTimerRef = useRef<number | null>(null)
  const typingClearTimerRef = useRef<number | null>(null)
  const [isNicknameOpen, setIsNicknameOpen] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    typeof globalThis !== 'undefined' && typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const [nicknameDraft, setNicknameDraft] = useState(nickname)
  const [composeText, setComposeText] = useState('')
  const [typingRows, setTypingRows] = useState<{ nickname: string; atMs: number }[]>([])
  const [readStates, setReadStates] = useState<Record<string, string>>({})

  const [messageMenu, setMessageMenu] = useState<OpenChatMessage | null>(null)
  const messageActionsMenuRef = useRef<HTMLDivElement | null>(null)
  const messageAnimRoomIdRef = useRef(room.id)
  const messageAnimPrevIdsRef = useRef<Set<string> | null>(null)
  const [messageSlideInIds, setMessageSlideInIds] = useState<Set<string>>(() => new Set())

  const [moderatorPanelTab, setModeratorPanelTab] = useState<ModeratorPanelTab>('members')

  const moderatorTabs = useMemo(() => {
    if (!isModerator) return [] as { id: ModeratorPanelTab; label: string; badge?: number }[]
    const tabs: { id: ModeratorPanelTab; label: string; badge?: number }[] = []
    if (room.policy === 'invite' && inviteMeta) tabs.push({ id: 'invite', label: '초대 코드' })
    if (room.policy === 'gated_open') tabs.push({ id: 'requests', label: '가입 요청', badge: pendingNicknames.length })
    if (memberDirectory) {
      tabs.push({ id: 'members', label: '멤버 · 차단' })
    }
    return tabs
  }, [isModerator, room.policy, inviteMeta, memberDirectory, pendingNicknames.length])

  useEffect(() => {
    const ids = moderatorTabs.map((t) => t.id)
    if (ids.length === 0) return
    setModeratorPanelTab((cur) => (ids.includes(cur) ? cur : ids[0]!))
  }, [moderatorTabs])

  const policyChip = policyChipFor(room.policy)
  const firestoreLive = useOpenchatFirestore()
  const mockApiEnvOn = !isViteEnvFalse(import.meta.env.VITE_ENABLE_MOCK_API)
  const showMockStorageNotice = !firestoreLive && mockApiEnvOn
  const [snapMessages, setSnapMessages] = useState<OpenChatMessage[] | undefined>(undefined)

  useEffect(() => {
    setSnapMessages(undefined)
  }, [room.id])

  useEffect(() => {
    setMe(initialMe)
  }, [
    initialMe.roomId,
    initialMe.nickname,
    initialMe.status,
    initialMe.pendingExpiresAt,
    initialMe.moderation?.isOwner,
    initialMe.moderation?.isManager,
  ])

  const canViewChatHistory = room.policy === 'open_link' || membership === 'member'

  useEffect(() => {
    if (!firestoreLive) return
    if (!canViewChatHistory) {
      setSnapMessages(undefined)
      return
    }
    return subscribeRoomMessages(room.id, setSnapMessages)
  }, [firestoreLive, room.id, canViewChatHistory])

  useEffect(() => {
    setAdminError(null)
    setDeleteRoomError(null)
  }, [room.id])

  useEffect(() => {
    if (firestoreLive || !mockApiEnvOn) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== OPENCHAT_MOCK_DB_STORAGE_KEY || e.newValue === null) return
      void revalidator.revalidate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [firestoreLive, mockApiEnvOn, revalidator])

  const optimisticMessages = (() => {
    const base = canViewChatHistory ? (snapMessages !== undefined ? snapMessages : messages) : []
    const next = fetcher.data?.message
    if (!next) return base
    const exists = base.some((m) => m.id === next.id)
    return exists ? base : [...base, next]
  })()

  useEffect(() => {
    setNicknameDraft(nickname)
  }, [nickname])

  const sortedMessages = useMemo(() => {
    return [...optimisticMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [optimisticMessages])

  const grouped = useMemo(() => {
    const out: Array<{ kind: 'day'; day: string } | { kind: 'msg'; msg: OpenChatMessage }> = []
    let lastDay = ''
    for (const m of sortedMessages) {
      const day = dayLabel(m.createdAt)
      if (day !== lastDay) {
        out.push({ kind: 'day', day })
        lastDay = day
      }
      out.push({ kind: 'msg', msg: m })
    }
    return out
  }, [sortedMessages])

  useLayoutEffect(() => {
    if (messageAnimRoomIdRef.current !== room.id) {
      messageAnimRoomIdRef.current = room.id
      messageAnimPrevIdsRef.current = null
      setMessageSlideInIds(new Set())
    }
    const current = new Set(sortedMessages.map((m) => m.id))
    if (messageAnimPrevIdsRef.current === null) {
      messageAnimPrevIdsRef.current = current
      return
    }
    const prev = messageAnimPrevIdsRef.current
    const added = sortedMessages.filter((m) => !prev.has(m.id)).map((m) => m.id)
    messageAnimPrevIdsRef.current = current
    if (added.length > 0) {
      setMessageSlideInIds((prevSet) => {
        const next = new Set(prevSet)
        for (const id of added) next.add(id)
        return next
      })
    }
  }, [sortedMessages, room.id])

  useEffect(() => {
    if (messageSlideInIds.size === 0) return
    const t = window.setTimeout(() => setMessageSlideInIds(new Set()), 420)
    return () => window.clearTimeout(t)
  }, [messageSlideInIds])

  const lastNonDeletedMessage = useMemo(
    () => [...sortedMessages].reverse().find((m) => !m.deletedAt),
    [sortedMessages],
  )

  const canPost = useMemo(() => {
    if (room.policy === 'open_link') return true
    return membership === 'member'
  }, [membership, room.policy])

  const flushTypingOff = useCallback(() => {
    if (typingPingTimerRef.current) window.clearTimeout(typingPingTimerRef.current)
    if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current)
    typingPingTimerRef.current = null
    typingClearTimerRef.current = null
    if (firestoreLive) void setTypingActivity(room.id, senderName, false)
  }, [firestoreLive, room.id, senderName])

  const bumpTyping = useCallback(() => {
    if (!firestoreLive || !canPost || !canViewChatHistory) return
    if (typingPingTimerRef.current) window.clearTimeout(typingPingTimerRef.current)
    if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current)
    typingPingTimerRef.current = window.setTimeout(() => {
      void setTypingActivity(room.id, senderName, true)
      typingPingTimerRef.current = null
    }, 350)
    typingClearTimerRef.current = window.setTimeout(() => {
      void setTypingActivity(room.id, senderName, false)
      typingClearTimerRef.current = null
    }, 2800)
  }, [firestoreLive, canPost, canViewChatHistory, room.id, senderName])

  const typistLabel = useMemo(() => {
    const meNick = (nickname || '게스트').trim()
    const names = typingRows.map((r) => r.nickname).filter((n) => n && n !== meNick)
    const u = [...new Set(names)]
    if (u.length === 0) return null
    if (u.length === 1) return `${u[0]} 입력 중…`
    if (u.length === 2) return `${u[0]}, ${u[1]} 입력 중…`
    return `${u[0]} 외 ${u.length - 1}명 입력 중…`
  }, [typingRows, nickname])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.message) {
      formRef.current?.reset()
      setComposeText('')
      flushTypingOff()
      setReplyTo(null)
      setAttachments([])
    }
  }, [fetcher.data?.message, fetcher.state, flushTypingOff])

  useFocusTrap(isNicknameOpen, nicknameModalRef, {
    onEscape: () => setIsNicknameOpen(false),
  })

  useFocusTrap(!!messageMenu, messageActionsMenuRef, {
    onEscape: () => setMessageMenu(null),
  })

  useEffect(() => {
    if (isNicknameOpen) setMessageMenu(null)
  }, [isNicknameOpen])

  useEffect(() => {
    if (!firestoreLive || !canPost || !canViewChatHistory) {
      setTypingRows([])
      return
    }
    const unsub = subscribeRoomTyping(room.id, setTypingRows)
    const iv = window.setInterval(() => {
      setTypingRows((prev) => prev.filter((r) => Date.now() - r.atMs < 6000))
    }, 1000)
    return () => {
      unsub()
      window.clearInterval(iv)
    }
  }, [firestoreLive, canPost, canViewChatHistory, room.id])

  useEffect(() => {
    const rid = room.id
    const sn = senderName
    const fs = firestoreLive
    return () => {
      if (typingPingTimerRef.current) window.clearTimeout(typingPingTimerRef.current)
      if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current)
      if (fs) void setTypingActivity(rid, sn, false)
    }
  }, [room.id, senderName, firestoreLive])

  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission)
  }, [])

  useEffect(() => {
    if (!canViewChatHistory) {
      setReadStates({})
      return
    }
    return subscribeRoomReadStates(room.id, setReadStates)
  }, [canViewChatHistory, room.id])

  useEffect(() => {
    if (!canViewChatHistory || !lastNonDeletedMessage) return
    if (!isAtBottom) return
    const t = window.setTimeout(() => {
      if (!isAtBottomRef.current) return
      void setReadCursor(room.id, senderName, lastNonDeletedMessage.createdAt)
    }, 500)
    return () => window.clearTimeout(t)
  }, [canViewChatHistory, room.id, senderName, isAtBottom, lastNonDeletedMessage?.id, lastNonDeletedMessage?.createdAt])

  useEffect(() => {
    if (lastMentionRoomIdRef.current !== room.id) {
      lastMentionRoomIdRef.current = room.id
      mentionNotifiedIdsRef.current = new Set(sortedMessages.map((m) => m.id))
      return
    }
    if (mentionNotifiedIdsRef.current.size === 0 && sortedMessages.length > 0) {
      mentionNotifiedIdsRef.current = new Set(sortedMessages.map((m) => m.id))
    }
  }, [room.id, sortedMessages])

  useEffect(() => {
    for (const m of sortedMessages) {
      if (mentionNotifiedIdsRef.current.has(m.id)) continue
      mentionNotifiedIdsRef.current.add(m.id)
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') continue
      if (typeof document !== 'undefined' && !document.hidden) continue
      if (m.deletedAt || m.sender === senderName) continue
      if (!textMentionsNickname(m.text, senderName)) continue
      try {
        new Notification(`${m.sender}님이 회원님을 멘션`, {
          body: (m.text || '').slice(0, 140),
          tag: `openchat-mention-${room.id}-${m.id}`,
        })
      } catch {
        /* ignore */
      }
    }
  }, [sortedMessages, senderName, room.id])

  async function refreshMe() {
    try {
      const data = await getMembership(room.id, senderName)
      setMe(data)
    } catch {
      setMe({
        roomId: room.id,
        nickname: senderName,
        status: 'none',
        moderation: { isOwner: false, isManager: false },
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getMembership(room.id, senderName)
        if (!cancelled) setMe(data)
      } catch {
        if (!cancelled)
          setMe({
            roomId: room.id,
            nickname: senderName,
            status: 'none',
            moderation: { isOwner: false, isManager: false },
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [room.id, senderName])

  useEffect(() => {
    let cancelled = false
    if (!isModerator) return

    void (async () => {
      try {
        const list = await listJoinRequests(room.id, senderName)
        if (!cancelled) setPendingNicknames(list)
      } catch (e) {
        if (!cancelled) setAdminError(e instanceof Error ? e.message : '요청 목록 로드 실패')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isModerator, room.id, membership, senderName])

  useEffect(() => {
    let cancelled = false
    if (!isModerator) {
      setMemberDirectory(null)
      return
    }
    void (async () => {
      try {
        const d = await listRoomMembers(room.id, senderName)
        if (!cancelled) setMemberDirectory(d)
      } catch (e) {
        if (!cancelled) setAdminError(e instanceof Error ? e.message : '멤버 목록 로드 실패')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isModerator, room.id, senderName, membership, pendingNicknames.length])

  useEffect(() => {
    let cancelled = false
    if (!isModerator || room.policy !== 'invite') {
      setInviteMeta(null)
      return
    }
    void (async () => {
      try {
        const info = await getInviteInfo(room.id, senderName)
        if (!cancelled) setInviteMeta(info)
      } catch {
        if (!cancelled) setInviteMeta(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isModerator, room.policy, room.id, senderName, membership])

  async function handleJoin() {
    setJoinError(null)
    try {
      await joinRoom(room.id, { nickname: senderName, inviteCode: inviteCode || undefined })
      await refreshMe()
      void revalidator.revalidate()
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : '입장 실패')
    }
  }

  async function handleCancelPending() {
    setJoinError(null)
    try {
      await cancelPendingMembership(room.id, senderName)
      await refreshMe()
      void revalidator.revalidate()
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : '취소 실패')
    }
  }

  async function handleApprove(targetNickname: string) {
    setAdminError(null)
    try {
      await approveJoin(room.id, senderName, targetNickname)
      const list = await listJoinRequests(room.id, senderName)
      setPendingNicknames(list)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      await refreshMe()
      if (targetNickname === senderName) void revalidator.revalidate()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '승인 실패')
    }
  }

  async function handleReject(targetNickname: string) {
    setAdminError(null)
    try {
      await rejectJoin(room.id, senderName, targetNickname)
      const list = await listJoinRequests(room.id, senderName)
      setPendingNicknames(list)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '거절 실패')
    }
  }

  async function handleKick(targetNickname: string) {
    setAdminError(null)
    try {
      await kickMember(room.id, senderName, targetNickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      if (targetNickname === senderName) void revalidator.revalidate()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '강퇴 실패')
    }
  }

  async function handleBlock(targetNickname: string) {
    setAdminError(null)
    try {
      await blockMember(room.id, senderName, targetNickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      if (targetNickname === senderName) void revalidator.revalidate()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '차단 실패')
    }
  }

  async function handleUnblock(targetNickname: string) {
    setAdminError(null)
    try {
      await unblockMember(room.id, senderName, targetNickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '차단 해제 실패')
    }
  }

  async function handleDelegate() {
    const to = delegateTo.trim()
    if (!to) return
    setAdminError(null)
    try {
      await delegateOwner(room.id, senderName, to)
      window.location.reload()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '위임 실패')
    }
  }

  async function handleDeleteRoom() {
    if (!isOwner) return
    const label = room.title.length > 48 ? `${room.title.slice(0, 48)}…` : room.title
    if (!window.confirm(`이 방을 삭제하면 메시지·멤버 데이터가 모두 사라지며 복구할 수 없습니다.\n\n「${label}」\n\n정말 삭제할까요?`)) return
    setDeleteRoomBusy(true)
    setDeleteRoomError(null)
    try {
      await deleteRoom(room.id, senderName)
      navigate('/rooms')
    } catch (e) {
      setDeleteRoomError(e instanceof Error ? e.message : '방 삭제에 실패했습니다.')
    } finally {
      setDeleteRoomBusy(false)
    }
  }

  async function handleAddManager() {
    const t = managerTarget.trim()
    if (!t) return
    setAdminError(null)
    try {
      await addRoomManager(room.id, senderName, t)
      setManagerTarget('')
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      await refreshMe()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '매니저 추가 실패')
    }
  }

  async function handleRemoveManager(targetNickname: string) {
    setAdminError(null)
    try {
      await removeRoomManager(room.id, senderName, targetNickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      await refreshMe()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '매니저 해제 실패')
    }
  }

  async function handleRegenerateInvite() {
    setAdminError(null)
    try {
      const info = await regenerateInviteCode(room.id, senderName)
      setInviteMeta(info)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '코드 재발급 실패')
    }
  }

  async function handleDelete(messageId: string) {
    try {
      await deleteMessage(room.id, messageId, nickname || '게스트')
      void revalidator.revalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatBottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
        isAtBottomRef.current = true
      })
    })
  }

  const scrollToQuotedMessage = useCallback((messageId: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`openchat-msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const threshold = 96
      const visibleBottom = window.scrollY + window.innerHeight
      const atBottom = doc.scrollHeight - visibleBottom <= threshold
      isAtBottomRef.current = atBottom
      setIsAtBottom(atBottom)
      if (atBottom) setNewMsgCount(0)
      setShowScrollTopFab(window.scrollY > 160)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    if (!replyTo) return
    const el = composeTextareaRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [replyTo?.id])

  useLayoutEffect(() => {
    if (fetcher.state !== 'idle') return
    if (!scrollAfterOwnSendRef.current) return
    if (!fetcher.data?.message) {
      scrollAfterOwnSendRef.current = false
      return
    }
    scrollAfterOwnSendRef.current = false
    suppressNextNewMsgBadgeRef.current = true
    isAtBottomRef.current = true
    setIsAtBottom(true)
    setNewMsgCount(0)
    chatBottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          chatBottomAnchorRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
          isAtBottomRef.current = true
        })
      })
    })
  }, [fetcher.state, fetcher.data?.message?.id])

  const lastMsgId = sortedMessages.at(-1)?.id
  const prevLastMsgId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!lastMsgId) return
    const prev = prevLastMsgId.current
    prevLastMsgId.current = lastMsgId
    if (!prev) {
      scrollToBottom()
      return
    }
    if (prev !== lastMsgId) {
      if (suppressNextNewMsgBadgeRef.current) {
        suppressNextNewMsgBadgeRef.current = false
        return
      }

      if (isAtBottomRef.current) {
        scrollToBottom()
      } else {
        setNewMsgCount((c) => c + 1)
      }
    } else if (suppressNextNewMsgBadgeRef.current) {
      suppressNextNewMsgBadgeRef.current = false
    }
  }, [lastMsgId, sortedMessages.length])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const next: OpenChatAttachment[] = []

    for (const f of Array.from(files)) {
      const isImage = f.type.startsWith('image/')
      const maxBytes = isImage ? 500_000 : 2_000_000
      if (f.size > maxBytes) {
        alert(`${f.name} 파일이 너무 큽니다. (최대 ${Math.floor(maxBytes / 1000)}KB)`)
        continue
      }

      if (isImage) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result ?? ''))
          reader.onerror = () => reject(new Error('파일 읽기 실패'))
          reader.readAsDataURL(f)
        })
        next.push({ kind: 'image', name: f.name, mimeType: f.type || 'image/*', size: f.size, dataUrl })
      } else {
        next.push({ kind: 'file', name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size })
      }
    }

    setAttachments((prev) => [...prev, ...next].slice(0, 4))
  }

  return (
    <div className='space-y-4'>
      {showMockStorageNotice ? (
        <div className='rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95'>
          <span className='font-medium text-amber-50'>데모(Mock) 저장 방식</span>
          <span className='text-amber-100/85'>
            {' '}
            채팅·방 데이터는 이 브라우저의 <code className='rounded bg-slate-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[11px]'>localStorage</code>에만
            들어갑니다. 같은 브라우저의 탭·창은 서로 맞춰 보이고, 크롬과 엣지처럼 <span className='font-medium'>앱이 다른 브라우저</span>나
            다른 PC는 저장소가 달라 이어지지 않습니다. 기기 간 동기화는{' '}
            <span className='font-medium'>Firestore</span>(<code className='rounded bg-slate-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[11px]'>VITE_USE_FIRESTORE=true</code>
            , 전체 <code className='rounded bg-slate-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[11px]'>VITE_FIREBASE_*</code>,{' '}
            <code className='rounded bg-slate-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[11px]'>VITE_ENABLE_MOCK_API=false</code>) 또는 같은 origin 의 실제{' '}
            <code className='rounded bg-slate-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[11px]'>/api/openchat/*</code> 백엔드로만 가능합니다(README 참고).
          </span>
        </div>
      ) : null}

      <div
        className={[
          'sticky z-[38] -mx-4 flex items-center gap-3 border-b border-slate-200 dark:border-white/5',
          'bg-white/92 px-4 py-2 shadow-[0_6px_20px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl',
          'dark:bg-[rgba(8,9,14,0.9)] dark:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.45)]',
          'top-[var(--app-header-h)]',
        ].join(' ')}
      >
        <div
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white ring-1 ring-inset ring-slate-300/40 dark:ring-white/15'
          style={{ backgroundImage: gradientFor(room.id) }}
          aria-hidden
        >
          {initialOf(room.title)}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5'>
            <h1 className='min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight md:text-base'>{room.title}</h1>
            <span className={`${policyChip.cls} shrink-0 scale-95`}>{policyChip.label}</span>
          </div>
          <div className='truncate text-[11px] leading-tight text-slate-500 dark:text-zinc-500'>
            방장 · {room.ownerNickname}
            {isOwner ? <span className='ml-1.5 text-[#9DB6FF]'>· 내가 방장</span> : null}
            {!isOwner && isManager ? <span className='ml-1.5 text-[#9DB6FF]'>· 매니저</span> : null}
          </div>
        </div>
        {typeof Notification !== 'undefined' && canViewChatHistory ? (
          notifPerm === 'default' ? (
            <button
              type='button'
              className='btn-ghost h-8 shrink-0 px-2 text-[11px]'
              title='허용 시 탭이 백그라운드일 때 @멘션만 브라우저 알림으로 알려 드려요.'
              onClick={() => {
                void Notification.requestPermission().then((p) => setNotifPerm(p))
              }}
            >
              멘션 알림
            </button>
          ) : notifPerm === 'granted' ? (
            <span
              className='hidden max-w-[4.5rem] shrink-0 truncate text-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400/90 sm:inline'
              title='탭이 비활성일 때 @멘션만 알림'
            >
              알림 켬
            </span>
          ) : null
        ) : null}
        <Link to='/rooms' className='btn-ghost h-8 shrink-0 px-2.5 text-[11px] md:px-3'>
          목록
        </Link>
        {isOwner ? (
          <button
            type='button'
            className='btn-danger-ghost h-8 shrink-0 px-2.5 text-[11px] md:px-3'
            disabled={deleteRoomBusy}
            onClick={() => void handleDeleteRoom()}
          >
            {deleteRoomBusy ? '삭제 중…' : '방 삭제'}
          </button>
        ) : null}
      </div>

      {deleteRoomError ? (
        <div className='rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100'>{deleteRoomError}</div>
      ) : null}

      {room.policy !== 'open_link' && membership !== 'member' ? (
        <div className='card overflow-hidden'>
          <div
            className='border-b border-slate-200 dark:border-white/[0.04] p-4'
            style={{
              background:
                'linear-gradient(180deg, rgba(92,135,255,0.10), rgba(92,135,255,0) 90%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
            }}
          >
            <div className='flex items-center gap-2'>
              <span className='inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#5C87FF]/15 text-[#9DB6FF] ring-1 ring-inset ring-[#5C87FF]/30'>
                <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                  <rect x='3' y='11' width='18' height='10' rx='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
              </span>
              <div>
                <div className='text-sm font-semibold'>입장이 필요해요</div>
                <div className='text-xs text-slate-600 dark:text-zinc-400'>
                  {room.policy === 'invite' ? '이 방은 초대코드가 있어야 입장할 수 있어요.' : '이 방은 신청 후 입장할 수 있어요.'}
                </div>
              </div>
            </div>
          </div>

          <div className='p-4'>
            {room.policy === 'invite' ? (
              <div className='flex flex-col gap-2 md:flex-row md:items-center'>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder='초대코드 (demo: TEAM1234)'
                  className='input flex-1'
                />
                <button type='button' className='btn-primary' onClick={handleJoin}>
                  입장
                </button>
              </div>
            ) : (
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                {(membership === 'none' || membership === 'rejected') ? (
                  <>
                    <div className='text-sm text-slate-600 dark:text-zinc-300'>
                      {membership === 'rejected' ? '이전 신청이 거절되었어요. 다시 신청할 수 있어요.' : '신청 후 방장 승인으로 입장합니다.'}
                    </div>
                    <button type='button' className='btn-primary' onClick={handleJoin}>
                      {membership === 'rejected' ? '다시 신청하기' : '신청하기'}
                    </button>
                  </>
                ) : null}

                {membership === 'pending' ? (
                  <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='text-sm text-slate-600 dark:text-zinc-300'>
                      <span className='chip chip-amber mr-2'>대기</span>
                      신청이 접수됐어요. 방장·매니저 승인 후 채팅할 수 있어요.
                      {me.pendingExpiresAt ? (
                        <span className='ml-1 text-xs text-slate-500 dark:text-zinc-500'>
                          · {shortDeadline(me.pendingExpiresAt)} 자동 만료
                        </span>
                      ) : null}
                    </div>
                    <button type='button' className='btn-ghost h-9 text-xs' onClick={() => void handleCancelPending()}>
                      신청 취소
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {joinError ? <div className='mt-3 text-sm text-rose-300'>{joinError}</div> : null}
          </div>
        </div>
      ) : null}

      {moderatorTabs.length > 0 ? (
        <div className='card overflow-hidden p-0'>
          {moderatorTabs.length > 1 ? (
            <div className='flex border-b border-slate-200 dark:border-white/10' role='tablist' aria-label='방 운영'>
              {moderatorTabs.map((tab) => {
                const active = moderatorPanelTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type='button'
                    role='tab'
                    aria-selected={active}
                    onClick={() => setModeratorPanelTab(tab.id)}
                    className={[
                      'relative flex-1 min-w-0 px-2 py-2.5 text-center text-xs font-medium transition sm:px-3 sm:text-sm',
                      active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200',
                    ].join(' ')}
                  >
                    {active ? <span className='absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#5C87FF]' /> : null}
                    <span className='relative z-10 inline-flex max-w-full flex-wrap items-center justify-center gap-1'>
                      <span className='truncate'>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 ? (
                        <span className='shrink-0 rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200'>
                          {tab.badge}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className='border-b border-slate-200 dark:border-white/10 px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-zinc-400'>{moderatorTabs[0]?.label}</div>
          )}

          <div className='p-4 md:p-5'>
            {moderatorPanelTab === 'invite' && room.policy === 'invite' && inviteMeta ? (
              <div>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <div className='text-sm font-semibold'>초대 코드</div>
                    <div className='mt-1 text-xs text-slate-600 dark:text-zinc-400'>방장만 코드를 재발급할 수 있습니다.</div>
                  </div>
                  {isOwner ? (
                    <button type='button' className='btn-ghost h-9 shrink-0 text-xs' onClick={() => void handleRegenerateInvite()}>
                      재발급
                    </button>
                  ) : null}
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-3'>
                  <code className='rounded-xl border border-[#5C87FF]/30 bg-[#5C87FF]/10 px-3 py-2 font-mono text-base font-semibold tracking-widest text-[#cdd9ff]'>
                    {inviteMeta.code}
                  </code>
                  <div className='text-xs text-slate-600 dark:text-zinc-400'>
                    만료 · {shortDeadline(inviteMeta.expiresAt)}
                    {new Date(inviteMeta.expiresAt).getTime() < Date.now() ? (
                      <span className='ml-2 text-amber-300'>(만료됨 — 재발급 필요)</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {moderatorPanelTab === 'requests' && room.policy === 'gated_open' ? (
              <div>
                <p className='text-xs text-slate-500 dark:text-zinc-500'>대기 중인 신청자를 승인하거나 거절할 수 있어요.</p>
                {pendingNicknames.length === 0 ? (
                  <div className='mt-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 px-4 py-5 text-center text-sm text-slate-500 dark:text-zinc-500'>
                    대기 중인 신청이 없어요.
                  </div>
                ) : (
                  <ul className='mt-3 max-h-[min(40vh,20rem)] space-y-2 overflow-y-auto pr-1'>
                    {pendingNicknames.map((n) => (
                      <li
                        key={n}
                        className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 px-3 py-2'
                      >
                        <div className='flex items-center gap-2 text-sm'>
                          <Avatar name={n} />
                          <span className='text-slate-700 dark:text-zinc-200'>{n}</span>
                        </div>
                        <div className='flex gap-2'>
                          <button type='button' className='btn-primary h-9 px-3 text-xs' onClick={() => void handleApprove(n)}>
                            승인
                          </button>
                          <button type='button' className='btn-ghost h-9 px-3 text-xs' onClick={() => void handleReject(n)}>
                            거절
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {moderatorPanelTab === 'members' && memberDirectory ? (
              <div>
                <p className='text-xs text-slate-500 dark:text-zinc-500'>강퇴·차단, 방장 위임, 매니저 지정(방장만)</p>
                {isOwner ? (
                  <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    <div className='flex gap-2'>
                      <input
                        value={delegateTo}
                        onChange={(e) => setDelegateTo(e.target.value)}
                        placeholder='방장 위임할 닉네임'
                        className='input'
                      />
                      <button type='button' className='btn-ghost shrink-0' onClick={() => void handleDelegate()}>
                        위임
                      </button>
                    </div>
                    <div className='flex gap-2'>
                      <input
                        value={managerTarget}
                        onChange={(e) => setManagerTarget(e.target.value)}
                        placeholder='매니저로 지정할 닉네임'
                        className='input'
                      />
                      <button type='button' className='btn-ghost shrink-0' onClick={() => void handleAddManager()}>
                        추가
                      </button>
                    </div>
                  </div>
                ) : null}

                <ul className='mt-3 max-h-[min(50vh,24rem)] space-y-1.5 overflow-y-auto pr-1'>
                  {memberDirectory.members.map((row) => {
                    const isRowOwner = row.nickname === memberDirectory.ownerNickname
                    const isRowManager = memberDirectory.managers.includes(row.nickname)
                    return (
                      <li
                        key={row.nickname}
                        className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/15 px-3 py-2 text-sm'
                      >
                        <div className='flex items-center gap-2'>
                          <Avatar name={row.nickname} />
                          <span className='text-slate-800 dark:text-zinc-100'>{row.nickname}</span>
                          <span className='text-[11px] text-slate-500 dark:text-zinc-500'>
                            {row.status === 'member' ? '멤버' : row.status === 'pending' ? '대기' : '거절됨'}
                          </span>
                          {isRowOwner ? <span className='chip chip-brand text-[10px]'>방장</span> : null}
                          {isRowManager && !isRowOwner ? <span className='chip chip-brand text-[10px]'>매니저</span> : null}
                        </div>
                        <div className='flex flex-wrap items-center gap-1'>
                          {row.status === 'member' && !isRowOwner ? (
                            <>
                              <button type='button' className='btn-danger-ghost h-7 px-2 text-[11px]' onClick={() => void handleKick(row.nickname)}>
                                강퇴
                              </button>
                              <button type='button' className='btn-danger-ghost h-7 px-2 text-[11px]' onClick={() => void handleBlock(row.nickname)}>
                                차단
                              </button>
                            </>
                          ) : null}
                          {isOwner && isRowManager && !isRowOwner ? (
                            <button type='button' className='btn-ghost h-7 px-2 text-[11px]' onClick={() => void handleRemoveManager(row.nickname)}>
                              매니저 해제
                            </button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {memberDirectory.blocked.length ? (
                  <div className='mt-4 border-t border-slate-200 dark:border-white/10 pt-3'>
                    <div className='text-xs font-medium text-slate-600 dark:text-zinc-400'>차단 목록</div>
                    <ul className='mt-2 max-h-40 space-y-1 overflow-y-auto pr-1'>
                      {memberDirectory.blocked.map((n) => (
                        <li key={n} className='flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300'>
                          <span className='flex items-center gap-2'>
                            <Avatar name={n} size={24} />
                            {n}
                          </span>
                          <button type='button' className='btn-ghost h-7 px-2 text-[11px]' onClick={() => void handleUnblock(n)}>
                            해제
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {adminError ? (
        <div className='rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'>{adminError}</div>
      ) : null}

      <div className='card relative overflow-hidden'>
        {!canViewChatHistory && room.policy !== 'open_link' ? (
          <div className='border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 px-4 py-6 text-center text-sm text-slate-600 dark:text-zinc-400'>
            입장(초대코드 또는 방장 승인) 후에 대화 내용을 볼 수 있어요.
          </div>
        ) : null}
        <ul
          className='relative space-y-2 overflow-x-clip px-4 pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] [overflow-anchor:none]'
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void handleFiles(e.dataTransfer.files)
          }}
        >
            {grouped.map((it, idx) => {
              if (it.kind === 'day') {
                return (
                  <li key={`day-${idx}`} className='flex items-center justify-center py-3'>
                    <span className='rounded-full border border-slate-200 dark:border-white/5 bg-slate-900/[0.04] dark:bg-white/[0.03] px-3 py-1 text-[11px] text-slate-600 dark:text-zinc-400'>
                      {it.day}
                    </span>
                  </li>
                )
              }

              const m = it.msg
              const isMine = m.sender === senderName
              const readCount = isMine && !m.deletedAt ? countReadersForMessage(m.createdAt, m.sender, readStates) : 0
              const replied = m.replyToMessageId ? sortedMessages.find((x) => x.id === m.replyToMessageId) : undefined

              return (
                <li
                  id={`openchat-msg-${m.id}`}
                  key={m.id}
                  className={[
                    isMine ? 'flex justify-end' : 'flex justify-start gap-2',
                    'group scroll-mt-[calc(var(--app-header-h)+0.75rem)]',
                    messageSlideInIds.has(m.id) ? (isMine ? 'openchat-msg-slide-in-mine' : 'openchat-msg-slide-in-other') : '',
                  ].join(' ')}
                >
                  {!isMine ? <Avatar name={m.sender} /> : null}
                  <div className='inline-flex min-w-0 max-w-[min(92vw,36rem)] flex-row items-end gap-1.5'>
                    <div
                      className={[
                        'min-w-0 flex-1',
                        isMine
                          ? 'max-w-[min(78vw,28rem)] items-end space-y-0.5 text-right'
                          : 'max-w-[min(78vw,28rem)] items-start space-y-1 text-left',
                      ].join(' ')}
                    >
                    {!isMine ? (
                      <div className='text-xs font-semibold text-slate-700 dark:text-zinc-200'>{m.sender}</div>
                    ) : null}

                    <div
                      className={[
                        'flex w-full min-w-0 flex-row items-end gap-2',
                        isMine ? 'flex-row-reverse justify-start' : 'justify-start',
                      ].join(' ')}
                    >
                      <div className='min-w-0 max-w-[min(78vw,28rem)] shrink'>
                    <div
                      className={[
                        'inline-block px-3.5 py-2 text-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.4)]',
                        isMine
                          ? 'rounded-2xl rounded-br-md text-white'
                          : 'rounded-2xl rounded-bl-md bg-slate-900/[0.05] dark:bg-white/[0.06] text-slate-800 dark:text-zinc-100 ring-1 ring-inset ring-slate-400/25 dark:ring-white/[0.06]',
                      ].join(' ')}
                      style={
                        isMine && !m.deletedAt
                          ? { backgroundImage: 'linear-gradient(180deg, #6B92FF 0%, #4A6BCC 100%)' }
                          : isMine && m.deletedAt
                          ? { background: 'rgba(255,255,255,0.04)' }
                          : undefined
                      }
                    >
                      {m.deletedAt ? (
                        <span className='text-slate-600 dark:text-zinc-400 italic'>삭제된 메시지입니다.</span>
                      ) : (
                        <div className='space-y-2'>
                          {m.replyToMessageId ? (
                            replied && !replied.deletedAt ? (
                              <button
                                type='button'
                                title='원문 메시지로 이동'
                                className={[
                                  'w-full rounded-lg border-l-2 px-2 py-1.5 text-left text-xs transition hover:brightness-110',
                                  isMine
                                    ? 'border-white/55 bg-white/12 text-white/95'
                                    : 'border-slate-400 dark:border-white/40 bg-slate-100 dark:bg-black/15 text-slate-700/90 dark:text-zinc-200/90',
                                ].join(' ')}
                                onClick={() => scrollToQuotedMessage(replied.id)}
                              >
                                <span className='font-medium'>{replied.sender}</span> ·{' '}
                                {replied.text
                                  ? replied.text.length > 180
                                    ? `${replied.text.slice(0, 180)}…`
                                    : replied.text
                                  : '(내용 없음)'}
                              </button>
                            ) : replied?.deletedAt ? (
                              <div
                                className={[
                                  'rounded-lg border-l-2 px-2 py-1 text-left text-xs italic',
                                  isMine ? 'border-white/35 bg-white/8 text-white/75' : 'border-slate-400/60 bg-slate-100/80 dark:bg-black/15 text-slate-600 dark:text-zinc-400',
                                ].join(' ')}
                              >
                                삭제된 메시지에 대한 답장
                              </div>
                            ) : (
                              <div
                                className={[
                                  'rounded-lg border-l-2 px-2 py-1 text-left text-xs',
                                  isMine ? 'border-white/35 bg-white/8 text-white/75' : 'border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-black/20 text-slate-600 dark:text-zinc-400',
                                ].join(' ')}
                              >
                                원문을 찾을 수 없어요
                              </div>
                            )
                          ) : null}

                          {m.text ? (
                            <div className='whitespace-pre-wrap text-left wrap-break-word'>{renderTextWithMentions(m.text)}</div>
                          ) : null}

                          {m.attachments?.length ? (
                            <div className='space-y-2'>
                              {m.attachments.map((a, i) =>
                                a.kind === 'image' ? (
                                  <img
                                    key={i}
                                    src={a.dataUrl}
                                    alt={a.name}
                                    className='max-h-56 w-auto rounded-xl ring-1 ring-inset ring-slate-300/35 dark:ring-white/10'
                                  />
                                ) : (
                                  <div
                                    key={i}
                                    className='rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-2 py-1 text-left text-xs text-slate-700 dark:text-zinc-200'
                                  >
                                    파일 · {a.name} ({Math.ceil(a.size / 1024)}KB)
                                  </div>
                                ),
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                      </div>

                      {!m.deletedAt ? (
                        <div
                          className={[
                            'flex shrink-0 flex-col items-end self-end',
                            isMine ? 'gap-0 pb-0' : 'gap-0.5 pb-1',
                          ].join(' ')}
                        >
                          <div className={['flex items-center gap-0.5', isMine ? 'flex-row-reverse' : ''].join(' ')}>
                            <span className='whitespace-nowrap text-[11px] tabular-nums text-slate-500 dark:text-zinc-500'>
                              {timeLabel(m.createdAt)}
                            </span>
                            <button
                              type='button'
                              className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/90 hover:text-slate-800 active:scale-95 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'
                              aria-expanded={messageMenu?.id === m.id}
                              aria-haspopup='dialog'
                              aria-label='메시지 메뉴'
                              title='메뉴'
                              onClick={() => setMessageMenu(m)}
                            >
                              <svg viewBox='0 0 24 24' className='h-4 w-4' fill='currentColor' aria-hidden>
                                <circle cx='12' cy='6' r='2' />
                                <circle cx='12' cy='12' r='2' />
                                <circle cx='12' cy='18' r='2' />
                              </svg>
                            </button>
                          </div>
                          {isMine ? (
                            <div className='max-w-[11rem] text-right text-[10px] leading-none text-slate-500 dark:text-zinc-500'>
                              <span>전달됨</span>
                              {readCount > 0 ? <span> · {readCount}명 읽음</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          className={[
                            'shrink-0 self-end text-[11px] tabular-nums text-slate-500 dark:text-zinc-500',
                            isMine ? 'pb-0' : 'pb-1',
                          ].join(' ')}
                        >
                          {timeLabel(m.createdAt)}
                        </div>
                      )}
                    </div>

                    {!m.deletedAt ? (
                      <div
                        className={[
                          'flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-500 sm:opacity-60 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100',
                          isMine ? 'justify-end' : 'justify-start',
                        ].join(' ')}
                      >
                        {!m.deletedAt && isMine && canSenderCancelOwnMessage(m.createdAt) ? (
                          <button type='button' className='hover:text-amber-200' onClick={() => void handleDelete(m.id)}>
                            취소 전송
                          </button>
                        ) : null}
                        {!m.deletedAt && isModerator && (!isMine || !canSenderCancelOwnMessage(m.createdAt)) ? (
                          <button type='button' className='hover:text-rose-300' onClick={() => void handleDelete(m.id)}>
                            삭제
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </li>
              )
            })}
          {canViewChatHistory && typistLabel ? (
            <li
              className='pointer-events-none sticky bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 flex list-none justify-start px-4 pb-1'
              role='status'
              aria-live='polite'
              aria-atomic='true'
            >
              <div
                className='pointer-events-auto flex h-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 px-2.5 shadow-[0_6px_20px_-8px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/90 dark:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.55)]'
                title={typistLabel}
              >
                <span className='sr-only'>{typistLabel}</span>
                <span className='inline-flex h-3.5 items-center gap-[3px] text-slate-500 dark:text-zinc-400' aria-hidden>
                  <span className='openchat-typing-dot h-1 w-1 rounded-full bg-current' />
                  <span className='openchat-typing-dot h-1 w-1 rounded-full bg-current' />
                  <span className='openchat-typing-dot h-1 w-1 rounded-full bg-current' />
                </span>
              </div>
            </li>
          ) : null}
          <li
            ref={chatBottomAnchorRef}
            aria-hidden
            className='pointer-events-none h-px shrink-0 list-none scroll-mb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]'
          />
        </ul>
      </div>

      {newMsgCount > 0 && !isAtBottom ? (
        <button
          type='button'
          className='fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#5C87FF]/90 px-4 py-2 text-xs font-medium text-white shadow-[0_10px_30px_-10px_rgba(92,135,255,0.7)] backdrop-blur-md transition hover:bg-[#5C87FF]'
          onClick={() => {
            scrollToBottom()
            setNewMsgCount(0)
          }}
        >
          새 메시지 {newMsgCount}개 · 아래로
        </button>
      ) : null}

      {showScrollTopFab ? (
        <button
          type='button'
          className='focus-ring fixed bottom-[calc(7rem+max(1.25rem,env(safe-area-inset-bottom)))] right-[max(1.25rem,env(safe-area-inset-right))] z-[95] flex min-w-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 px-2 py-2.5 text-[10px] font-bold leading-tight tracking-wider text-slate-800 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.35)] backdrop-blur-md transition hover:bg-slate-50 dark:border-white/12 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.55)] dark:hover:bg-zinc-800/95'
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label='맨 위로'
        >
          <svg viewBox='0 0 24 24' className='h-4 w-4 shrink-0' fill='none' stroke='currentColor' strokeWidth='2.2' aria-hidden>
            <path d='M12 19V5M5 12l7-7 7 7' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
          <span className='select-none'>TOP</span>
        </button>
      ) : null}

      <div className='fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 dark:border-white/5 bg-white/85 dark:bg-[rgba(8,9,15,0.78)] pb-[env(safe-area-inset-bottom,0)] backdrop-blur-xl'>
        <div className='mx-auto max-w-5xl px-4 pt-3'>
          <fetcher.Form
            ref={formRef}
            className='flex flex-col gap-2 pb-3'
            method='post'
            onSubmit={() => {
              scrollAfterOwnSendRef.current = true
            }}
          >
            <input type='hidden' name='sender' value={senderName} />
            <input type='hidden' name='replyToMessageId' value={replyTo?.id ?? ''} />
            <input type='hidden' name='attachmentsJson' value={attachments.length ? JSON.stringify(attachments) : ''} />

            {replyTo ? (
              <div
                className='relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-[#5C87FF]/[0.14] via-white/90 to-slate-50/90 p-3 shadow-[0_2px_12px_-4px_rgba(92,135,255,0.25)] ring-1 ring-inset ring-[#5C87FF]/15 dark:border-white/[0.07] dark:from-[#5C87FF]/[0.18] dark:via-[rgba(14,16,24,0.92)] dark:to-[rgba(10,11,18,0.88)] dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] dark:ring-[#5C87FF]/20'
                role='region'
                aria-label='답장 작성 중'
              >
                <div className='pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#5C87FF]/20 blur-2xl dark:bg-[#5C87FF]/25' aria-hidden />
                <div className='relative flex items-start gap-3'>
                  <div
                    className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5C87FF]/20 text-[#4A6BCC] shadow-inner shadow-[#5C87FF]/10 ring-1 ring-inset ring-[#5C87FF]/30 dark:bg-[#5C87FF]/25 dark:text-[#B4C8FF] dark:ring-[#7A9DFF]/35'
                    aria-hidden
                  >
                    <svg viewBox='0 0 24 24' className='h-[18px] w-[18px]' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M9 14 4 9l5-5' />
                      <path d='M4 9h10.5a5.5 5.5 0 0 1 0 11H11' />
                    </svg>
                  </div>
                  <button
                    type='button'
                    className='min-w-0 flex-1 rounded-lg px-0.5 py-0.5 text-left transition hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                    title='원문 메시지로 이동'
                    onClick={() => scrollToQuotedMessage(replyTo.id)}
                  >
                    <div className='line-clamp-2 text-[13px] leading-snug text-slate-800 dark:text-zinc-100'>
                      <span className='font-semibold text-slate-900 dark:text-white'>{replyTo.sender}</span>
                      <span className='font-normal text-slate-600 dark:text-zinc-400'>
                        {' '}
                        <span className='text-slate-400 dark:text-zinc-600'>·</span>{' '}
                        {replyTo.text
                          ? replyTo.text.length > 160
                            ? `${replyTo.text.slice(0, 160)}…`
                            : replyTo.text
                          : '(내용 없음)'}
                      </span>
                    </div>
                  </button>
                  <button
                    type='button'
                    className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-400 dark:hover:border-white/15 dark:hover:bg-white/10 dark:hover:text-zinc-100'
                    aria-label='답장 취소'
                    onClick={() => setReplyTo(null)}
                  >
                    <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' aria-hidden>
                      <path d='M18 6 6 18M6 6l12 12' />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}

            {attachments.length ? (
              <div className='flex flex-wrap gap-2'>
                {attachments.map((a, i) => (
                  <div key={i} className='relative rounded-xl border border-slate-200 dark:border-white/10 bg-slate-200/90 dark:bg-black/25 p-2 text-[11px] text-slate-700 dark:text-zinc-200'>
                    {a.kind === 'image' ? (
                      <img src={a.dataUrl} alt={a.name} className='h-14 w-14 rounded-lg object-cover' />
                    ) : (
                      <div className='flex h-14 w-14 items-center justify-center rounded-lg bg-white/5 text-[10px] text-slate-600 dark:text-zinc-400'>
                        FILE
                      </div>
                    )}
                    <div className='mt-1 max-w-[120px] truncate'>{a.name}</div>
                    <button
                      type='button'
                      className='absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-zinc-900 text-[10px] text-slate-700 dark:text-zinc-200 ring-1 ring-slate-300/40 dark:ring-white/15 hover:bg-slate-300 dark:bg-zinc-800'
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label='제거'
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className='flex min-h-10 items-start gap-2'>
              <button
                type='button'
                title={!canPost ? '입장 후 메시지를 보낼 수 있어요' : '표시 이름 변경'}
                className='inline-flex h-10 max-w-[min(11rem,38vw)] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/5 bg-slate-900/[0.04] dark:bg-white/[0.03] px-2.5 text-[11px] text-slate-600 dark:text-zinc-300 transition hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]'
                onClick={() => setIsNicknameOpen(true)}
              >
                <Avatar name={senderName} size={18} />
                <span className='min-w-0 truncate font-medium text-slate-800 dark:text-zinc-100'>{senderName}</span>
                <span className='hidden shrink-0 text-slate-500 dark:text-zinc-500 sm:inline'>· 변경</span>
              </button>

              <label
                className={[
                  'inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 dark:border-white/5 bg-slate-900/[0.04] dark:bg-white/[0.03] text-slate-600 dark:text-zinc-300 transition hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]',
                  !canPost ? 'pointer-events-none opacity-50' : '',
                ].join(' ')}
                aria-label='첨부'
              >
                <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M21.4 11.05L12.5 19.95a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48' />
                </svg>
                <input type='file' className='hidden' multiple disabled={!canPost} onChange={(e) => void handleFiles(e.target.files)} />
              </label>

              <div className='relative flex min-w-0 flex-1 items-end gap-2'>
                <textarea
                  ref={composeTextareaRef}
                  name='text'
                  rows={1}
                  value={composeText}
                  onChange={(e) => {
                    const v = e.target.value
                    setComposeText(v)
                    if (!v.trim()) flushTypingOff()
                    else bumpTyping()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      if (canPost && fetcher.state === 'idle') formRef.current?.requestSubmit()
                    }
                  }}
                  placeholder={
                    !canPost
                      ? '입장 후 메시지를 보낼 수 있어요'
                      : replyTo
                        ? `${replyTo.sender}님에게 답장…`
                        : '메시지를 입력해 보세요…'
                  }
                  disabled={!canPost}
                  className='input min-h-10 max-h-36 w-full min-w-0 flex-1 py-2 pr-12 leading-snug'
                  autoComplete='off'
                  title={!canPost ? '입장 후 메시지를 보낼 수 있어요' : 'Enter 전송 · Shift+Enter 줄바꿈'}
                />

                <button
                  type='submit'
                  disabled={fetcher.state !== 'idle' || !canPost}
                  className='btn-primary h-10 shrink-0 px-3 sm:px-4'
                  aria-label='전송'
                >
                  {fetcher.state === 'idle' ? (
                    <>
                      <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M5 12l14-7-5 16-2-7-7-2z' />
                      </svg>
                      <span className='hidden sm:inline'>전송</span>
                    </>
                  ) : (
                    <span className='text-xs'>전송중</span>
                  )}
                </button>
              </div>
            </div>
            <div className='text-[10px] text-slate-500 dark:text-zinc-500'>
              Enter 전송 · Shift+Enter 줄바꿈 · 드래그&드롭 가능 · 이미지 500KB · 파일 2MB · 최대 4개
            </div>
          </fetcher.Form>
        </div>
      </div>

      {messageMenu ? (
        <div
          className='fixed inset-0 z-[55] flex items-end justify-center bg-slate-900/20 p-4 backdrop-blur-[2px] dark:bg-black/35 sm:items-center'
          role='presentation'
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMessageMenu(null)
          }}
        >
          <div
            ref={messageActionsMenuRef}
            className='card w-full max-w-sm overflow-hidden p-0 shadow-xl'
            role='dialog'
            aria-modal='true'
            aria-labelledby='openchat-message-actions-title'
          >
            <div id='openchat-message-actions-title' className='sr-only'>
              메시지 메뉴
            </div>
            <div className='flex flex-col py-1'>
              <button
                type='button'
                className='rounded-none px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-100 dark:hover:bg-white/[0.06]'
                disabled={!canPost}
                title={!canPost ? '입장 후 메시지를 보낼 수 있어요' : undefined}
                onClick={() => {
                  if (!canPost) return
                  setReplyTo(messageMenu)
                  setMessageMenu(null)
                }}
              >
                답장
              </button>
              {messageMenu.sender === senderName ? (
                <button
                  type='button'
                  className={[
                    'rounded-none px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45',
                    canSenderCancelOwnMessage(messageMenu.createdAt)
                      ? 'text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40'
                      : 'text-rose-800 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/35',
                  ].join(' ')}
                  disabled={!canSenderCancelOwnMessage(messageMenu.createdAt) && !isModerator}
                  title={
                    !canSenderCancelOwnMessage(messageMenu.createdAt) && !isModerator
                      ? '보낸 지 1분 이내만 취소할 수 있어요'
                      : undefined
                  }
                  onClick={() => {
                    void handleDelete(messageMenu.id)
                    setMessageMenu(null)
                  }}
                >
                  {canSenderCancelOwnMessage(messageMenu.createdAt) ? '취소 전송' : '삭제'}
                </button>
              ) : (
                <button
                  type='button'
                  className='rounded-none px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-white/[0.06]'
                  onClick={() => {
                    window.alert('신고 기능은 준비 중이에요.')
                    setMessageMenu(null)
                  }}
                >
                  신고
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isNicknameOpen ? (
        <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 dark:bg-black/60 p-4 backdrop-blur-sm sm:items-center'>
          <div
            ref={nicknameModalRef}
            className='card w-full max-w-md p-5'
            role='dialog'
            aria-modal='true'
            aria-labelledby='nickname-modal-title'
          >
            <div id='nickname-modal-title' className='text-sm font-semibold'>
              닉네임 변경
            </div>
            <p className='mt-1 text-sm text-slate-600 dark:text-zinc-400'>채팅 발신자 이름에 사용됩니다.</p>
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              className='input mt-4'
              placeholder='예: md_민수'
            />
            <div className='mt-5 flex justify-end gap-2'>
              <button type='button' className='btn-ghost' onClick={() => setIsNicknameOpen(false)}>
                취소
              </button>
              <button
                type='button'
                className='btn-primary'
                onClick={() => {
                  setNickname(nicknameDraft.trim() || '게스트')
                  setIsNicknameOpen(false)
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className='mx-auto max-w-lg px-4 py-12'>
        <div className='card p-6 text-center'>
          <div className='text-lg font-semibold text-slate-900 dark:text-white'>채팅방을 찾을 수 없어요</div>
          <p className='mt-2 text-sm text-slate-600 dark:text-zinc-400'>
            Firestore에 이 주소의 방이 없거나, 예전 Mock에서 쓰던 링크일 수 있어요. 목록에서 다시 들어가거나 새 방을 만들어 보세요.
          </p>
          <div className='mt-6 flex flex-wrap justify-center gap-2'>
            <Link to='/rooms' className='btn-primary'>
              채팅방 목록
            </Link>
            <Link to='/rooms/new' className='btn-ghost'>
              방 만들기
            </Link>
          </div>
        </div>
      </div>
    )
  }
  if (isRouteErrorResponse(error)) {
    return <RouteErrorFallback error={error} />
  }
  if (error instanceof Error) {
    return <RouteErrorFallback error={error} />
  }
  throw error
}
