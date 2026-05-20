import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  isRouteErrorResponse,
  useFetcher,
  useLoaderData,
  useNavigate,
  useLocation,
  useNavigation,
  useRevalidator,
} from 'react-router'

import type {
  GetMembershipResponse,
  ListRoomMembersResponse,
  MembershipStatus,
  OpenChatAttachment,
  OpenChatMessage,
  OpenChatRoom,
  RoomInviteInfo,
  RoomMemberRow,
} from '@/features/openchat/openchat.types'

import { isViteEnvFalse } from '@/lib/vite-env-flags'
import { openchatDisplaySenderName } from '@/lib/openchat-display-name'
import { resolveMessageSenderLabel } from '@/lib/openchat-display-label'
import { ensureOpenchatClientId, isOpenchatMessageMine } from '@/lib/openchat-identity'
import { addSeenJoinClientIds, readSeenJoinClientIds } from '@/lib/openchat-join-toast-seen'
import { memberAdminLabel, memberMatchesManagerList } from '@/lib/openchat-member-managers'
import { isOpenchatRoomOwner } from '@/lib/openchat-room-owner'
import { clearOpenchatToasts, showOpenchatToast } from '@/lib/openchat-toast'
import {
  collectMentionAliases,
  filterMentionCandidates,
  getActiveMentionQuery,
  insertMentionAt,
  isMentionToken,
  splitMentionParts,
  textMentionsAny,
} from '@/lib/openchat-mention'
import {
  mentionNotificationPermission,
  mentionNotificationSecureContext,
  mentionNotificationSupported,
  postMentionBrowserNotification,
  promptMentionNotificationPermission,
  readMentionNotificationsEnabled,
  setMentionNotificationsEnabled,
} from '@/lib/openchat-mention-notification'
import { ComposeEmojiPicker } from '@/components/compose-emoji-picker'
import { OpenchatPageLoading, openchatPageLoadingCopy } from '@/components/openchat-page-loading'
import {
  OpenchatParticipationDrawer,
  OpenchatParticipationSidebar,
} from '@/components/openchat-participation-sidebar'
import {
  hasMyReaction,
  messageHasReactions,
  QUICK_MESSAGE_REACTIONS,
  reactionEntries,
} from '@/lib/openchat-message-reactions'
import { messageStickerEmoji } from '@/lib/openchat-stickers'
import { countReadersForMessage } from '@/lib/openchat-read-receipt'
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
  setRoomDisplayName,
  setTypingActivity,
  toggleMessageReaction,
  subscribeJoinRequests,
  subscribeMyMembership,
  subscribeRoomMembers,
  subscribeRoomDisplayNames,
  subscribeRoomReadStates,
  subscribeRoomTyping,
  unblockMember,
} from '@/services/openchat.service'
import { subscribeRoomMessages } from '@/services/openchat-firestore.service'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import {
  blurOpenchatCompose,
  isOpenchatComposeFocused,
  isOpenchatKeyboardLikelyOpen,
  syncOpenchatKeyboardLayout,
  useOpenchatKeyboardOffset,
} from '@/hooks/use-openchat-keyboard-offset'
import { isOpenchatMobileChatViewport } from '@/lib/openchat-mobile-chat'
import { OpenchatToastHost } from '@/components/openchat-toast-host'
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
  const sender = String(form.get('sender') ?? '').trim() || openchatDisplaySenderName()
  const replyToMessageId = String(form.get('replyToMessageId') ?? '') || undefined
  const attachmentsJson = String(form.get('attachmentsJson') ?? '')
  const attachments = attachmentsJson ? (JSON.parse(attachmentsJson) as OpenChatAttachment[]) : undefined

  const room = await getRoom(roomId)
  if (room.policy !== 'open_link') {
    const membership = await getMembership(roomId, sender)
    if (membership.status !== 'member') {
      throw new Response('승인된 멤버만 메시지를 보낼 수 있어요.', { status: 403 })
    }
  }

  const message = await postMessage(roomId, {
    sender,
    senderClientId: ensureOpenchatClientId(),
    text,
    replyToMessageId,
    attachments,
  })
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
  return splitMentionParts(text).map((p, i) => {
    if (isMentionToken(p)) {
      return (
        <span key={i} className='font-semibold text-[#4a6bcc] dark:text-[#BFD0FF]'>
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
  const textClass =
    size <= 24 ? 'text-[9px]' : size <= 28 ? 'text-[10px]' : size <= 32 ? 'text-[11px]' : 'text-xs'
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[0_2px_8px_-4px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-slate-300/40 dark:ring-white/15',
        textClass,
      ].join(' ')}
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
  const navigation = useNavigation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isRoomDataLoading =
    revalidator.state === 'loading' ||
    (navigation.state === 'loading' && navigation.location?.pathname === pathname)
  const fetcher = useFetcher() as unknown as {
    Form: typeof useFetcher.prototype.Form
    data?: { message?: OpenChatMessage }
    state: 'idle' | 'loading' | 'submitting'
  }
  const defaultNick = openchatDisplaySenderName()
  const [myDisplayName, setMyDisplayName] = useState(() => initialMe.displayName?.trim() || defaultNick)
  const senderName = myDisplayName.trim() || defaultNick
  const [joinDisplayName, setJoinDisplayName] = useState(defaultNick)
  const [displayNamesByClientId, setDisplayNamesByClientId] = useState<Record<string, string>>({})
  const myClientId = ensureOpenchatClientId()
  const formRef = useRef<HTMLFormElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const stickerPreviewRef = useRef<HTMLDivElement | null>(null)
  const composeBarRef = useRef<HTMLDivElement | null>(null)
  const roomStickyHeadRef = useRef<HTMLDivElement | null>(null)
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isAtBottomRef = useRef(true)
  const showScrollTopFabRef = useRef(false)
  const lastScrollYRef = useRef(0)
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
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollTopFab, setShowScrollTopFab] = useState(false)
  const scrollAfterOwnSendRef = useRef(false)
  const keyboardWasOpenOnSendRef = useRef(false)
  /** 전송 직후 useLayoutEffect에서 스크롤 처리 시, 다음 lastMsgId effect의 "새 메시지" 배지 1회 생략 */
  const suppressNextNewMsgBadgeRef = useRef(false)
  const knownMemberClientIdsRef = useRef<Set<string> | null>(null)
  const toastedJoinClientIdsRef = useRef<Set<string>>(new Set())
  const joinPresenceSyncedRef = useRef(false)
  const joinToastReadyAtRef = useRef(0)
  const displayNamesByClientIdRef = useRef(displayNamesByClientId)
  displayNamesByClientIdRef.current = displayNamesByClientId
  const [joinToastReady, setJoinToastReady] = useState(false)
  const [joinPresenceEpoch, setJoinPresenceEpoch] = useState(0)
  const mentionNotifiedIdsRef = useRef<Set<string>>(new Set())
  const lastMentionRoomIdRef = useRef<string | null>(null)
  const [mentionPickerIndex, setMentionPickerIndex] = useState(0)
  const [composeCursor, setComposeCursor] = useState(0)
  const prevMembershipStatusRef = useRef<MembershipStatus>(initialMe.status)
  const joinRequestsSyncedRef = useRef(false)
  const knownPendingNicknamesRef = useRef<Set<string>>(new Set())
  const typingPingTimerRef = useRef<number | null>(null)
  const typingClearTimerRef = useRef<number | null>(null)
  const [isNicknameOpen, setIsNicknameOpen] = useState(false)
  const [mentionNotifOn, setMentionNotifOn] = useState(() => readMentionNotificationsEnabled())
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() => mentionNotificationPermission())
  const [displayNameDraft, setDisplayNameDraft] = useState(senderName)
  const [composeText, setComposeText] = useState('')
  const [typingRows, setTypingRows] = useState<{ nickname: string; atMs: number }[]>([])
  const [readStates, setReadStates] = useState<Record<string, string>>({})

  const [messageMenu, setMessageMenu] = useState<OpenChatMessage | null>(null)
  const [participationDrawerOpen, setParticipationDrawerOpen] = useState(false)
  const messageActionsMenuRef = useRef<HTMLDivElement | null>(null)
  const participationDrawerRef = useRef<HTMLDivElement | null>(null)
  const messageAnimRoomIdRef = useRef(room.id)
  const messageAnimPrevIdsRef = useRef<Set<string> | null>(null)
  const [messageSlideInIds, setMessageSlideInIds] = useState<Set<string>>(() => new Set())

  const [moderatorPanelTab, setModeratorPanelTab] = useState<ModeratorPanelTab>('members')
  const [moderatorPanelOpen, setModeratorPanelOpen] = useState(false)

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

  const ownerAssignableMembers = useMemo(() => {
    if (!memberDirectory) return [] as RoomMemberRow[]
    return memberDirectory.members.filter(
      (m) => m.status === 'member' && !isOpenchatRoomOwner(room, m.nickname, m.clientId),
    )
  }, [memberDirectory, room])

  useEffect(() => {
    const ids = moderatorTabs.map((t) => t.id)
    if (ids.length === 0) return
    setModeratorPanelTab((cur) => (ids.includes(cur) ? cur : ids[0]!))
  }, [moderatorTabs])

  useEffect(() => {
    setModeratorPanelOpen(false)
  }, [room.id])

  useEffect(() => {
    if (!moderatorPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModeratorPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moderatorPanelOpen])

  const policyChip = policyChipFor(room.policy)
  useOpenchatKeyboardOffset(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => {
      if (mq.matches) document.documentElement.classList.add('openchat-mobile-room-chat')
      else document.documentElement.classList.remove('openchat-mobile-room-chat')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.documentElement.classList.remove('openchat-mobile-room-chat')
    }
  }, [])
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
    initialMe.displayName,
    initialMe.status,
    initialMe.pendingExpiresAt,
    initialMe.moderation?.isOwner,
    initialMe.moderation?.isManager,
  ])

  const canViewChatHistory = room.policy === 'open_link' || membership === 'member'

  const commitJoinPresenceBaseline = useCallback(() => {
    const latest = displayNamesByClientIdRef.current
    const ids = Object.keys(latest).filter((cid) => latest[cid]?.trim())
    knownMemberClientIdsRef.current = new Set(ids)
    const toMark = ids.filter((cid) => cid !== myClientId)
    addSeenJoinClientIds(room.id, toMark)
    for (const cid of toMark) toastedJoinClientIdsRef.current.add(cid)
    joinPresenceSyncedRef.current = true
  }, [room.id, myClientId])

  useEffect(() => {
    if (!canViewChatHistory) return
    return subscribeRoomDisplayNames(room.id, senderName, setDisplayNamesByClientId)
  }, [room.id, senderName, canViewChatHistory])

  useEffect(() => {
    knownMemberClientIdsRef.current = null
    joinPresenceSyncedRef.current = false
    joinToastReadyAtRef.current = 0
    toastedJoinClientIdsRef.current = readSeenJoinClientIds(room.id)
    clearOpenchatToasts()
    setJoinToastReady(false)
    setJoinPresenceEpoch(0)
    if (!canViewChatHistory) return
    const t = window.setTimeout(() => setJoinToastReady(true), 800)
    return () => window.clearTimeout(t)
  }, [room.id, canViewChatHistory])

  useEffect(() => {
    if (joinToastReady) joinToastReadyAtRef.current = Date.now()
  }, [joinToastReady, room.id])

  useEffect(() => {
    if (!canViewChatHistory || !joinToastReady) return
    const forceSyncTimer = window.setTimeout(() => {
      if (joinPresenceSyncedRef.current) return
      commitJoinPresenceBaseline()
      setJoinPresenceEpoch((n) => n + 1)
    }, 3500)
    return () => window.clearTimeout(forceSyncTimer)
  }, [canViewChatHistory, joinToastReady, room.id, commitJoinPresenceBaseline])

  useEffect(() => {
    if (!canViewChatHistory || !joinToastReady) return

    const names = displayNamesByClientIdRef.current
    const memberIds = (map: Record<string, string>) =>
      Object.keys(map).filter((cid) => map[cid]?.trim())

    if (!joinPresenceSyncedRef.current) {
      const joinToastMaxWaitMs = 3500
      const stabilityTimer = window.setTimeout(() => {
        if (joinPresenceSyncedRef.current) return
        const ids = memberIds(displayNamesByClientIdRef.current)
        const waitedMs = Date.now() - joinToastReadyAtRef.current
        if (ids.length === 0 && waitedMs < joinToastMaxWaitMs) return
        commitJoinPresenceBaseline()
        setJoinPresenceEpoch((n) => n + 1)
      }, 500)
      return () => window.clearTimeout(stabilityTimer)
    }

    const currentIds = memberIds(names)
    const prev = knownMemberClientIdsRef.current ?? new Set<string>()

    for (const cid of currentIds) {
      if (cid === myClientId || prev.has(cid) || toastedJoinClientIdsRef.current.has(cid)) continue
      toastedJoinClientIdsRef.current.add(cid)
      addSeenJoinClientIds(room.id, [cid])
      const label = names[cid]?.trim() || '누군가'
      showOpenchatToast(`${label}님이 입장했습니다.`)
    }

    knownMemberClientIdsRef.current = new Set(currentIds)
  }, [
    displayNamesByClientId,
    canViewChatHistory,
    myClientId,
    joinToastReady,
    joinPresenceEpoch,
    room.id,
    commitJoinPresenceBaseline,
  ])

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
    setDisplayNameDraft(senderName)
  }, [senderName])

  useEffect(() => {
    if (initialMe.displayName?.trim()) setMyDisplayName(initialMe.displayName.trim())
  }, [initialMe.displayName])

  const labelForMessage = useCallback(
    (m: OpenChatMessage) => resolveMessageSenderLabel(m, displayNamesByClientId),
    [displayNamesByClientId],
  )

  const myMentionAliases = useMemo(
    () =>
      collectMentionAliases({
        displayName: senderName,
        defaultNick,
        clientId: myClientId,
        displayNamesByClientId,
      }),
    [senderName, defaultNick, myClientId, displayNamesByClientId],
  )

  const sortedMessages = useMemo(() => {
    return [...optimisticMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [optimisticMessages])

  const mentionCandidates = useMemo(() => {
    const names = new Set<string>()
    const exclude = new Set(myMentionAliases.map((a) => a.trim()).filter(Boolean))
    const add = (raw: string | undefined) => {
      const n = (raw ?? '').trim()
      if (!n || exclude.has(n)) return
      names.add(n)
    }
    for (const [cid, dn] of Object.entries(displayNamesByClientId)) {
      if (cid === myClientId) continue
      add(dn)
    }
    if (memberDirectory) {
      for (const row of memberDirectory.members) {
        if (row.status !== 'member') continue
        if (row.clientId === myClientId) continue
        add(row.displayName?.trim() || row.nickname)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [displayNamesByClientId, memberDirectory, myClientId, myMentionAliases])

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

  const activeMention = useMemo(
    () => getActiveMentionQuery(composeText, composeCursor),
    [composeText, composeCursor],
  )

  const mentionPickerOptions = useMemo(() => {
    if (!activeMention || !canPost) return []
    return filterMentionCandidates(mentionCandidates, activeMention.query)
  }, [activeMention, mentionCandidates, canPost])

  const showMentionPicker = Boolean(activeMention && canPost)

  useEffect(() => {
    setMentionPickerIndex(0)
  }, [activeMention?.query, mentionPickerOptions.length])

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
    const meNick = senderName.trim()
    const names = typingRows.map((r) => r.nickname).filter((n) => n && n !== meNick)
    const u = [...new Set(names)]
    if (u.length === 0) return null
    if (u.length === 1) return `${u[0]} 입력 중…`
    if (u.length === 2) return `${u[0]}, ${u[1]} 입력 중…`
    return `${u[0]} 외 ${u.length - 1}명 입력 중…`
  }, [typingRows, senderName])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.message) {
      formRef.current?.reset()
      setComposeText('')
      flushTypingOff()
      setReplyTo(null)
      setAttachments([])
      setSelectedSticker(null)
      const retainFocus = keyboardWasOpenOnSendRef.current
      requestAnimationFrame(() => {
        if (!isOpenchatMobileChatViewport() || retainFocus) {
          composeTextareaRef.current?.focus({ preventScroll: true })
        } else {
          blurOpenchatCompose()
        }
        syncOpenchatKeyboardLayout(composeBarRef.current)
      })
    }
  }, [fetcher.data?.message, fetcher.state, flushTypingOff])

  const outgoingAttachments = useMemo((): OpenChatAttachment[] => {
    const list = [...attachments]
    if (selectedSticker) list.push({ kind: 'sticker', emoji: selectedSticker })
    return list
  }, [attachments, selectedSticker])

  const canSendCompose = Boolean(composeText.trim() || selectedSticker)

  useFocusTrap(!!messageMenu, messageActionsMenuRef, {
    onEscape: () => setMessageMenu(null),
  })

  useFocusTrap(participationDrawerOpen, participationDrawerRef, {
    onEscape: () => setParticipationDrawerOpen(false),
  })

  useEffect(() => {
    if (isNicknameOpen) setMessageMenu(null)
  }, [isNicknameOpen])

  useEffect(() => {
    setParticipationDrawerOpen(false)
  }, [room.id])

  useEffect(() => {
    if (participationDrawerOpen) setMessageMenu(null)
  }, [participationDrawerOpen])

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

  const syncMentionNotifPerm = useCallback(() => {
    setNotifPerm(mentionNotificationPermission())
  }, [])

  useEffect(() => {
    syncMentionNotifPerm()
    window.addEventListener('focus', syncMentionNotifPerm)
    document.addEventListener('visibilitychange', syncMentionNotifPerm)
    return () => {
      window.removeEventListener('focus', syncMentionNotifPerm)
      document.removeEventListener('visibilitychange', syncMentionNotifPerm)
    }
  }, [syncMentionNotifPerm])

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
    if (!mentionNotifOn) return
    for (const m of sortedMessages) {
      if (mentionNotifiedIdsRef.current.has(m.id)) continue
      mentionNotifiedIdsRef.current.add(m.id)
      if (m.deletedAt || isOpenchatMessageMine(m, senderName, myClientId)) continue
      if (!textMentionsAny(m.text, myMentionAliases)) continue
      const from = labelForMessage(m)
      const preview = (m.text || '').slice(0, 80)
      const hidden = typeof document !== 'undefined' && document.hidden
      if (!hidden) {
        showOpenchatToast(`${from}님이 회원님을 멘션했습니다: ${preview}`)
        continue
      }
      postMentionBrowserNotification(
        `${from}님이 회원님을 멘션`,
        (m.text || '').slice(0, 140),
        `openchat-mention-${room.id}-${m.id}`,
      )
    }
  }, [mentionNotifOn, sortedMessages, senderName, myClientId, room.id, labelForMessage, myMentionAliases])

  const handleMentionNotifClick = useCallback(async () => {
    if (mentionNotifOn) {
      setMentionNotificationsEnabled(false)
      setMentionNotifOn(false)
      showOpenchatToast('멘션 알림을 껐어요.')
      return
    }

    setMentionNotificationsEnabled(true)
    setMentionNotifOn(true)
    showOpenchatToast('멘션 알림을 켰어요. 이 탭이 보일 때는 토스트로 알려요.')

    if (!mentionNotificationSupported() || !mentionNotificationSecureContext()) return

    const perm = mentionNotificationPermission()
    if (perm === 'granted') {
      postMentionBrowserNotification(
        '멘션 알림이 켜졌어요',
        '다른 탭·백그라운드일 때 멘션을 알려 드려요.',
        'openchat-mention-perm-test',
      )
      return
    }
    if (perm === 'denied') {
      showOpenchatToast('백그라운드 OS 알림은 브라우저 사이트 설정에서 허용해 주세요.')
      return
    }
    const next = await promptMentionNotificationPermission()
    setNotifPerm(next)
    if (next === 'granted') {
      postMentionBrowserNotification(
        '멘션 알림이 켜졌어요',
        '다른 탭·백그라운드일 때 멘션을 알려 드려요.',
        'openchat-mention-perm-test',
      )
    } else if (next === 'denied') {
      showOpenchatToast('OS 알림은 거부됐지만, 이 탭에서는 토스트로 알려 드려요.')
    }
  }, [mentionNotifOn])

  const applyMentionPick = useCallback(
    (name: string) => {
      const el = composeTextareaRef.current
      const pos = el?.selectionStart ?? composeCursor
      const { nextText, nextCursor } = insertMentionAt(composeText, pos, name)
      setComposeText(nextText)
      setComposeCursor(nextCursor)
      requestAnimationFrame(() => {
        const ta = composeTextareaRef.current
        if (!ta) return
        ta.focus()
        ta.setSelectionRange(nextCursor, nextCursor)
      })
    },
    [composeText, composeCursor],
  )

  const selectSticker = useCallback((emoji: string) => {
    setSelectedSticker(emoji)
    requestAnimationFrame(() => {
      if (!isOpenchatMobileChatViewport() || isOpenchatComposeFocused()) {
        composeTextareaRef.current?.focus({ preventScroll: true })
      }
      syncOpenchatKeyboardLayout(composeBarRef.current)
    })
  }, [])

  async function refreshMe() {
    try {
      const data = await getMembership(room.id, senderName)
      setMe(data)
      if (data.displayName?.trim()) setMyDisplayName(data.displayName.trim())
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
    prevMembershipStatusRef.current = initialMe.status
    joinRequestsSyncedRef.current = false
    knownPendingNicknamesRef.current = new Set()
  }, [room.id, initialMe.status])

  useEffect(() => {
    if (room.policy === 'open_link') return
    return subscribeMyMembership(room.id, senderName, (data) => {
      const prev = prevMembershipStatusRef.current
      setMe(data)
      if (data.displayName?.trim()) setMyDisplayName(data.displayName.trim())

      if (prev !== data.status) {
        if (prev === 'pending' && data.status === 'member') {
          showOpenchatToast('가입이 승인되었습니다. 이제 채팅할 수 있어요.')
          void revalidator.revalidate()
        } else if (prev === 'pending' && data.status === 'rejected') {
          showOpenchatToast('가입 신청이 거절되었습니다.')
        } else if (prev === 'pending' && data.status === 'none') {
          showOpenchatToast('가입 신청이 만료되었거나 취소되었습니다.')
        }
        prevMembershipStatusRef.current = data.status
      }
    })
  }, [room.id, room.policy, senderName, revalidator])

  useEffect(() => {
    if (!isModerator || room.policy !== 'gated_open') return
    return subscribeJoinRequests(room.id, senderName, (list) => {
      if (!joinRequestsSyncedRef.current) {
        knownPendingNicknamesRef.current = new Set(list)
        joinRequestsSyncedRef.current = true
        setPendingNicknames(list)
        return
      }
      const prev = knownPendingNicknamesRef.current
      for (const n of list) {
        if (!prev.has(n)) showOpenchatToast(`${n}님이 가입을 신청했습니다.`)
      }
      knownPendingNicknamesRef.current = new Set(list)
      setPendingNicknames(list)
    })
  }, [isModerator, room.policy, room.id, senderName])

  useEffect(() => {
    if (!isModerator) {
      setMemberDirectory(null)
      return
    }
    return subscribeRoomMembers(room.id, senderName, (d) => {
      setMemberDirectory(d)
      setAdminError(null)
    })
  }, [isModerator, room.id, senderName])

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
      const name = joinDisplayName.trim() || defaultNick
      await joinRoom(room.id, { nickname: name, inviteCode: inviteCode || undefined })
      setMyDisplayName(name)
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

  async function handleKick(target: { nickname: string; displayName?: string; clientId?: string }) {
    setAdminError(null)
    const targetLabel = target.displayName?.trim() || target.nickname
    try {
      await kickMember(room.id, senderName, target.nickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      if (target.clientId === myClientId || targetLabel === senderName) void revalidator.revalidate()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '강퇴 실패')
    }
  }

  async function handleBlock(target: { nickname: string; displayName?: string; clientId?: string }) {
    setAdminError(null)
    const targetLabel = target.displayName?.trim() || target.nickname
    try {
      await blockMember(room.id, senderName, target.nickname)
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      if (target.clientId === myClientId || targetLabel === senderName) void revalidator.revalidate()
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

  async function handleDelegate(targetLabel?: string) {
    const to = (targetLabel ?? delegateTo).trim()
    if (!to) return
    setAdminError(null)
    try {
      await delegateOwner(room.id, senderName, to)
      setDelegateTo('')
      showOpenchatToast('방장을 위임했습니다.')
      void revalidator.revalidate()
      await refreshMe()
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '위임 실패')
    }
  }

  async function handleDelegateToRow(row: RoomMemberRow) {
    const label = memberAdminLabel(row)
    if (!window.confirm(`「${label}」님에게 방장을 위임할까요?`)) return
    await handleDelegate(label)
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

  async function handleAddManager(targetLabel?: string) {
    const t = (targetLabel ?? managerTarget).trim()
    if (!t) return
    setAdminError(null)
    try {
      await addRoomManager(room.id, senderName, t)
      setManagerTarget('')
      showOpenchatToast('매니저로 지정했습니다.')
      const d = await listRoomMembers(room.id, senderName)
      setMemberDirectory(d)
      await refreshMe()
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : '매니저 추가 실패')
    }
  }

  async function handleRemoveManager(row: RoomMemberRow) {
    setAdminError(null)
    try {
      await removeRoomManager(room.id, senderName, memberAdminLabel(row))
      showOpenchatToast('매니저를 해제했습니다.')
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
      await deleteMessage(room.id, messageId, senderName)
      void revalidator.revalidate()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  const patchMessageInList = useCallback(
    (updated: OpenChatMessage) => {
      setSnapMessages((prev) => {
        const base = prev ?? messages
        return base.map((m) => (m.id === updated.id ? updated : m))
      })
      setMessageMenu((cur) => (cur?.id === updated.id ? updated : cur))
    },
    [messages],
  )

  const handleToggleReaction = useCallback(
    async (msg: OpenChatMessage, emoji: string, opts?: { closeMenu?: boolean }) => {
      if (!canPost) return
      try {
        const updated = await toggleMessageReaction(room.id, msg.id, emoji, senderName)
        patchMessageInList(updated)
        if (opts?.closeMenu) setMessageMenu(null)
        if (!firestoreLive) void revalidator.revalidate()
      } catch (e) {
        alert(e instanceof Error ? e.message : '반응을 남기지 못했습니다.')
      }
    },
    [canPost, room.id, senderName, patchMessageInList, firestoreLive, revalidator],
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    requestAnimationFrame(() => {
      const chatScroll = chatScrollRef.current
      if (isOpenchatMobileChatViewport() && chatScroll) {
        chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior })
      } else {
        const doc = document.documentElement
        window.scrollTo({ top: doc.scrollHeight, left: 0, behavior })
      }
      isAtBottomRef.current = true
      setIsAtBottom(true)
      setNewMsgCount(0)
    })
  }, [])

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const chatScroll = chatScrollRef.current
    if (isOpenchatMobileChatViewport() && chatScroll) {
      chatScroll.scrollTo({ top: 0, behavior })
    } else {
      window.scrollTo({ top: 0, behavior })
    }
  }, [])

  const maintainMobileComposeAfterSend = useCallback((retainFocus: boolean) => {
    if (!isOpenchatMobileChatViewport()) return

    const tick = () => {
      if (retainFocus) {
        composeTextareaRef.current?.focus({ preventScroll: true })
      } else {
        blurOpenchatCompose()
      }
      syncOpenchatKeyboardLayout(composeBarRef.current)
      const chatScroll = chatScrollRef.current
      if (chatScroll) {
        chatScroll.scrollTop = chatScroll.scrollHeight
        isAtBottomRef.current = true
        setIsAtBottom(true)
        setNewMsgCount(0)
      }
    }

    tick()
    requestAnimationFrame(tick)
    window.setTimeout(tick, 50)
    window.setTimeout(tick, 150)
    window.setTimeout(tick, 300)
  }, [])

  const scrollToQuotedMessage = useCallback((messageId: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`openchat-msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const submitCompose = useCallback(() => {
    if (!canPost || !canSendCompose || fetcher.state !== 'idle') return
    keyboardWasOpenOnSendRef.current = isOpenchatKeyboardLikelyOpen()
    scrollAfterOwnSendRef.current = true
    formRef.current?.requestSubmit()
    if (keyboardWasOpenOnSendRef.current) {
      composeTextareaRef.current?.focus({ preventScroll: true })
    }
    syncOpenchatKeyboardLayout(composeBarRef.current)
  }, [canPost, canSendCompose, fetcher.state])

  useLayoutEffect(() => {
    const el = composeBarRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const sync = () => {
      const rect = el.getBoundingClientRect()
      document.documentElement.style.setProperty('--openchat-compose-h', `${Math.round(rect.height * 1000) / 1000}px`)
      if (window.matchMedia('(max-width: 767px)').matches) {
        syncOpenchatKeyboardLayout(el)
      } else {
        document.documentElement.style.setProperty('--openchat-compose-top', `${Math.round(rect.top * 1000) / 1000}px`)
      }
    }

    sync()
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [replyTo?.id, outgoingAttachments.length, selectedSticker, canPost, isNicknameOpen])

  useLayoutEffect(() => {
    const el = stickerPreviewRef.current
    if (!selectedSticker || !el || typeof ResizeObserver === 'undefined') {
      document.documentElement.style.removeProperty('--openchat-sticker-preview-h')
      return
    }

    const sync = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--openchat-sticker-preview-h', `${Math.round(h * 1000) / 1000}px`)
      syncOpenchatKeyboardLayout(composeBarRef.current)
    }

    sync()
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--openchat-sticker-preview-h')
    }
  }, [selectedSticker])

  useLayoutEffect(() => {
    if (selectedSticker && canPost) {
      document.documentElement.setAttribute('data-openchat-sticker-preview', '')
      syncOpenchatKeyboardLayout(composeBarRef.current)
    } else {
      document.documentElement.removeAttribute('data-openchat-sticker-preview')
    }
    return () => document.documentElement.removeAttribute('data-openchat-sticker-preview')
  }, [selectedSticker, canPost])

  useLayoutEffect(() => {
    const el = roomStickyHeadRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const sync = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--openchat-room-head-h', `${Math.round(h * 1000) / 1000}px`)
    }

    sync()
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [memberDirectory?.members.length, room.title, moderatorTabs.length, mentionNotifOn, canViewChatHistory])

  useEffect(() => {
    const bottomThreshold = 72
    const topThreshold = 120
    const directionThreshold = 6

    const onScroll = () => {
      const chatScroll = isOpenchatMobileChatViewport() ? chatScrollRef.current : null

      if (chatScroll) {
        const y = chatScroll.scrollTop
        const delta = y - lastScrollYRef.current
        lastScrollYRef.current = y

        const atBottom = chatScroll.scrollHeight - y - chatScroll.clientHeight <= bottomThreshold
        if (isAtBottomRef.current !== atBottom) {
          isAtBottomRef.current = atBottom
          setIsAtBottom(atBottom)
          if (atBottom) setNewMsgCount(0)
        }

        let nextFab = showScrollTopFabRef.current
        if (y <= topThreshold || atBottom) {
          nextFab = false
        } else if (delta < -directionThreshold) {
          nextFab = true
        } else if (delta > directionThreshold) {
          nextFab = false
        }
        if (showScrollTopFabRef.current !== nextFab) {
          showScrollTopFabRef.current = nextFab
          setShowScrollTopFab(nextFab)
        }
        return
      }

      const doc = document.documentElement
      const y = window.scrollY
      const delta = y - lastScrollYRef.current
      lastScrollYRef.current = y

      const visibleBottom = y + window.innerHeight
      const atBottom = doc.scrollHeight - visibleBottom <= bottomThreshold
      if (isAtBottomRef.current !== atBottom) {
        isAtBottomRef.current = atBottom
        setIsAtBottom(atBottom)
        if (atBottom) setNewMsgCount(0)
      }

      let nextFab = showScrollTopFabRef.current
      if (y <= topThreshold || atBottom) {
        nextFab = false
      } else if (delta < -directionThreshold) {
        nextFab = true
      } else if (delta > directionThreshold) {
        nextFab = false
      }
      if (showScrollTopFabRef.current !== nextFab) {
        showScrollTopFabRef.current = nextFab
        setShowScrollTopFab(nextFab)
      }
    }

    let removeListeners: (() => void) | undefined

    const bind = () => {
      removeListeners?.()
      const chatScroll = isOpenchatMobileChatViewport() ? chatScrollRef.current : null
      lastScrollYRef.current = chatScroll?.scrollTop ?? window.scrollY
      onScroll()

      if (chatScroll) {
        chatScroll.addEventListener('scroll', onScroll, { passive: true })
        removeListeners = () => chatScroll.removeEventListener('scroll', onScroll)
        return
      }

      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      removeListeners = () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
      }
    }

    bind()
    const raf = requestAnimationFrame(bind)
    const mq = window.matchMedia('(max-width: 767px)')
    mq.addEventListener('change', bind)

    return () => {
      cancelAnimationFrame(raf)
      mq.removeEventListener('change', bind)
      removeListeners?.()
    }
  }, [canViewChatHistory, sortedMessages.length])

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
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    if (!mobile) {
      scrollToBottom('auto')
      requestAnimationFrame(() => {
        scrollToBottom('auto')
        composeTextareaRef.current?.focus({ preventScroll: true })
      })
    } else {
      maintainMobileComposeAfterSend(keyboardWasOpenOnSendRef.current)
    }
  }, [fetcher.state, fetcher.data?.message?.id, scrollToBottom, maintainMobileComposeAfterSend])

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
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
          requestAnimationFrame(() => {
            scrollToBottom('auto')
            syncOpenchatKeyboardLayout(composeBarRef.current)
          })
        }
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
  }, [lastMsgId, sortedMessages.length, scrollToBottom])

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

  const participationRefreshKey = `${membership}-${myDisplayName}-${room.id}`

  return (
    <div className='openchat-room-layout min-w-0 max-w-full overflow-x-clip'>
      <div className='openchat-room-split space-y-4'>
        <OpenchatParticipationSidebar currentRoomId={room.id} refreshKey={participationRefreshKey} />

        <div className='openchat-room-chat-column min-w-0 flex-1 space-y-4'>
      {showMockStorageNotice ? (
        <div className='mx-4 break-words rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95'>
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

      <div className='openchat-room-sticky-stack bg-white dark:bg-[#161a25]'>
      <div
        ref={roomStickyHeadRef}
        className='openchat-room-sticky-head flex min-w-0 items-center gap-3 border-b border-[#e5e8ed] px-4 py-3 dark:border-white/10'
      >
        <button
          type='button'
          className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#949ba4] transition hover:bg-[#f2f3f5] hover:text-[#191f28] dark:hover:bg-white/10 dark:hover:text-zinc-100 lg:hidden'
          aria-label='참여한 방 목록'
          aria-expanded={participationDrawerOpen}
          aria-controls='openchat-participation-drawer'
          onClick={() => setParticipationDrawerOpen(true)}
        >
          <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.75' aria-hidden>
            <path d='M4 7h16M4 12h16M4 17h16' strokeLinecap='round' />
          </svg>
        </button>
        <div
          className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white'
          style={{ backgroundImage: gradientFor(room.id) }}
          aria-hidden
        >
          {initialOf(room.title)}
        </div>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-base font-semibold leading-snug text-[#191f28] dark:text-white'>{room.title}</h1>
          <p className='truncate text-xs text-[#949ba4] dark:text-zinc-500'>
            방장 · {room.ownerNickname}
            <span className='mx-1'>·</span>
            <span className={policyChip.cls}>{policyChip.label}</span>
            {memberDirectory ? (
              <>
                <span className='mx-1'>·</span>
                {memberDirectory.members.length}명
              </>
            ) : null}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-0.5'>
          {moderatorTabs.length > 0 ? (
            <button
              type='button'
              className={[
                'relative inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition sm:px-3',
                moderatorPanelOpen
                  ? 'bg-[#5C87FF]/15 text-[#4a6bcc] dark:text-[#BFD0FF]'
                  : 'text-[#949ba4] hover:bg-[#f2f3f5] hover:text-[#191f28] dark:hover:bg-white/10 dark:hover:text-zinc-100',
              ].join(' ')}
              aria-expanded={moderatorPanelOpen}
              aria-controls='openchat-moderator-panel'
              title={moderatorPanelOpen ? '멤버 관리 닫기' : '멤버 관리'}
              onClick={() => setModeratorPanelOpen((open) => !open)}
            >
              <svg viewBox='0 0 24 24' className='h-4 w-4 shrink-0' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden>
                <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' strokeLinecap='round' strokeLinejoin='round' />
                <circle cx='9' cy='7' r='4' />
                <path d='M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' strokeLinecap='round' strokeLinejoin='round' />
              </svg>
              <span className='hidden sm:inline'>관리</span>
              {room.policy === 'gated_open' && pendingNicknames.length > 0 ? (
                <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white'>
                  {pendingNicknames.length > 9 ? '9+' : pendingNicknames.length}
                </span>
              ) : null}
            </button>
          ) : null}
          {canViewChatHistory ? (
            <button
              type='button'
              className={[
                'relative inline-flex h-9 w-9 items-center justify-center rounded-full transition',
                mentionNotifOn
                  ? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                  : 'text-[#949ba4] hover:bg-[#f2f3f5] hover:text-[#191f28] dark:hover:bg-white/10 dark:hover:text-zinc-100',
              ].join(' ')}
              title={mentionNotifOn ? '멘션 알림 끄기' : '멘션 알림 켜기'}
              aria-label={mentionNotifOn ? '멘션 알림 끄기' : '멘션 알림 켜기'}
              aria-pressed={mentionNotifOn}
              onClick={() => void handleMentionNotifClick()}
            >
              <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden>
                <path d='M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' strokeLinecap='round' strokeLinejoin='round' />
                <path d='M13.73 21a2 2 0 0 1-3.46 0' strokeLinecap='round' strokeLinejoin='round' />
                {!mentionNotifOn ? <path d='M4 4l16 16' strokeLinecap='round' /> : null}
              </svg>
            </button>
          ) : null}
          <Link
            to='/rooms'
            className='inline-flex h-9 w-9 items-center justify-center rounded-full text-[#949ba4] transition hover:bg-[#f2f3f5] hover:text-[#191f28] dark:hover:bg-white/10 dark:hover:text-zinc-100'
            aria-label='나가기'
            title='나가기'
            onClick={() => setParticipationDrawerOpen(false)}
          >
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.75' aria-hidden>
              <path
                d='M9 18l-6-6 6-6M4 12h16'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </Link>
        </div>
        </div>
      </div>
      <div className='openchat-room-sticky-stack-spacer' aria-hidden />

      {room.policy !== 'open_link' && membership !== 'member' ? (
        <div className='card mx-4 overflow-hidden'>
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
            <label className='mb-3 block text-xs text-slate-600 dark:text-zinc-400'>
              이 방에서 쓸 표시 이름
              <input
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                className='input mt-1'
                placeholder='예: ㅇㅇ'
                maxLength={32}
              />
            </label>
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

      {adminError ? (
        <div className='rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'>{adminError}</div>
      ) : null}

      {moderatorPanelOpen && moderatorTabs.length > 0 ? (
        <div
          className='openchat-moderator-overlay'
          role='dialog'
          aria-modal='true'
          aria-label='방 관리'
        >
          <div id='openchat-moderator-panel' className='openchat-moderator-panel'>
          <div className='flex items-stretch border-b border-slate-200 dark:border-white/10'>
          {moderatorTabs.length > 1 ? (
            <div className='flex min-w-0 flex-1' role='tablist' aria-label='방 운영'>
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
            <div className='flex min-w-0 flex-1 items-center px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-zinc-400'>
              {moderatorTabs[0]?.label}
            </div>
          )}
          <button
            type='button'
            className='inline-flex shrink-0 items-center justify-center border-l border-slate-200 px-3 text-[#949ba4] transition hover:bg-slate-100 hover:text-[#191f28] dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-zinc-100'
            aria-label='멤버 관리 닫기'
            onClick={() => setModeratorPanelOpen(false)}
          >
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden>
              <path d='M18 6L6 18M6 6l12 12' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </button>
          </div>

          <div className='openchat-moderator-panel-body p-4 md:p-5'>
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
                    <div className='flex min-w-0 gap-2'>
                      <select
                        value={delegateTo}
                        onChange={(e) => setDelegateTo(e.target.value)}
                        className='input min-w-0 flex-1'
                        aria-label='방장 위임 대상'
                      >
                        <option value=''>방장 위임할 멤버</option>
                        {ownerAssignableMembers.map((m) => {
                          const label = memberAdminLabel(m)
                          return (
                            <option key={m.clientId ?? m.nickname} value={label}>
                              {label}
                            </option>
                          )
                        })}
                      </select>
                      <button
                        type='button'
                        className='btn-ghost shrink-0'
                        disabled={!delegateTo.trim()}
                        onClick={() => void handleDelegate()}
                      >
                        위임
                      </button>
                    </div>
                    <div className='flex min-w-0 gap-2'>
                      <select
                        value={managerTarget}
                        onChange={(e) => setManagerTarget(e.target.value)}
                        className='input min-w-0 flex-1'
                        aria-label='매니저 지정 대상'
                      >
                        <option value=''>매니저로 지정할 멤버</option>
                        {ownerAssignableMembers
                          .filter((m) => !memberMatchesManagerList(memberDirectory.managers, m))
                          .map((m) => {
                            const label = memberAdminLabel(m)
                            return (
                              <option key={m.clientId ?? m.nickname} value={label}>
                                {label}
                              </option>
                            )
                          })}
                      </select>
                      <button
                        type='button'
                        className='btn-ghost shrink-0'
                        disabled={!managerTarget.trim()}
                        onClick={() => void handleAddManager()}
                      >
                        추가
                      </button>
                    </div>
                  </div>
                ) : null}

                <ul className='mt-3 max-h-[min(50vh,24rem)] space-y-1.5 overflow-y-auto pr-1'>
                  {memberDirectory.members.map((row) => {
                    const rowLabel = row.displayName?.trim() || row.nickname
                    const isRowOwner = isOpenchatRoomOwner(room, row.nickname, row.clientId)
                    const isRowManager = memberMatchesManagerList(memberDirectory.managers, row)
                    return (
                      <li
                        key={row.clientId ?? row.nickname}
                        className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/15 px-3 py-2 text-sm'
                      >
                        <div className='flex items-center gap-2'>
                          <Avatar name={rowLabel} />
                          <span className='text-slate-800 dark:text-zinc-100'>{rowLabel}</span>
                          <span className='text-[11px] text-slate-500 dark:text-zinc-500'>
                            {row.status === 'member' ? '멤버' : row.status === 'pending' ? '대기' : '거절됨'}
                          </span>
                          {isRowOwner ? <span className='chip chip-brand text-[10px]'>방장</span> : null}
                          {isRowManager && !isRowOwner ? <span className='chip chip-brand text-[10px]'>매니저</span> : null}
                        </div>
                        <div className='flex flex-wrap items-center gap-1'>
                          {row.status === 'member' && !isRowOwner ? (
                            <>
                              <button type='button' className='btn-danger-ghost h-7 px-2 text-[11px]' onClick={() => void handleKick(row)}>
                                강퇴
                              </button>
                              <button type='button' className='btn-danger-ghost h-7 px-2 text-[11px]' onClick={() => void handleBlock(row)}>
                                차단
                              </button>
                            </>
                          ) : null}
                          {isOwner && row.status === 'member' && !isRowOwner && !isRowManager ? (
                            <>
                              <button
                                type='button'
                                className='btn-ghost h-7 px-2 text-[11px]'
                                onClick={() => void handleDelegateToRow(row)}
                              >
                                방장 위임
                              </button>
                              <button
                                type='button'
                                className='btn-ghost h-7 px-2 text-[11px]'
                                onClick={() => void handleAddManager(memberAdminLabel(row))}
                              >
                                매니저
                              </button>
                            </>
                          ) : null}
                          {isOwner && isRowManager && !isRowOwner ? (
                            <button type='button' className='btn-ghost h-7 px-2 text-[11px]' onClick={() => void handleRemoveManager(row)}>
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
                      {memberDirectory.blocked.map((n) => {
                        const blockedLabel =
                          memberDirectory.members.find((m) => m.nickname === n)?.displayName?.trim() || n
                        return (
                        <li key={n} className='flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300'>
                          <span className='flex items-center gap-2'>
                            <Avatar name={blockedLabel} size={24} />
                            {blockedLabel}
                          </span>
                          <button type='button' className='btn-ghost h-7 px-2 text-[11px]' onClick={() => void handleUnblock(n)}>
                            해제
                          </button>
                        </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isOwner ? (
              <div className='mt-6 border-t border-slate-200 pt-4 dark:border-white/10'>
                <div className='text-xs font-medium text-slate-700 dark:text-zinc-300'>방장 전용</div>
                <p className='mt-1 text-xs text-slate-500 dark:text-zinc-500'>
                  방을 삭제하면 메시지·멤버 데이터가 모두 사라지며 복구할 수 없어요.
                </p>
                {deleteRoomError ? <p className='mt-2 text-sm text-rose-400'>{deleteRoomError}</p> : null}
                <button
                  type='button'
                  className='btn-danger-ghost mt-3 h-10 px-4 text-sm'
                  disabled={deleteRoomBusy}
                  onClick={() => void handleDeleteRoom()}
                >
                  {deleteRoomBusy ? '삭제 중…' : '방 삭제'}
                </button>
              </div>
            ) : null}
          </div>
          </div>
          <button
            type='button'
            className='openchat-moderator-overlay-scrim'
            aria-label='멤버 관리 닫기'
            onClick={() => setModeratorPanelOpen(false)}
          />
        </div>
      ) : null}

      <div className='openchat-chat-panel relative min-w-0 overflow-hidden'>
        {isRoomDataLoading ? (
          <div className='openchat-page-loading-overlay'>
            <OpenchatPageLoading compact {...openchatPageLoadingCopy.roomChat} />
          </div>
        ) : null}
        {!canViewChatHistory && room.policy !== 'open_link' ? (
          <div className='border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 px-4 py-6 text-center text-sm text-slate-600 dark:text-zinc-400'>
            입장(초대코드 또는 방장 승인) 후에 대화 내용을 볼 수 있어요.
          </div>
        ) : null}
        <div ref={chatScrollRef} className='openchat-chat-scroll'>
        <ul
          className={[
            'relative space-y-4 overflow-x-clip px-4 pt-4 sm:px-5',
            selectedSticker && canPost
              ? 'pb-[calc(var(--openchat-compose-h)+5.5rem+var(--openchat-safe-bottom,env(safe-area-inset-bottom,0px)))]'
              : 'pb-[calc(var(--openchat-compose-h)+var(--openchat-compose-gap)+var(--openchat-safe-bottom,env(safe-area-inset-bottom,0px)))]',
          ].join(' ')}
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
              if (m.kind === 'system') {
                return (
                  <li key={m.id} className='flex justify-center py-2'>
                    <span className='rounded-full border border-slate-200 dark:border-white/5 bg-slate-900/[0.04] dark:bg-white/[0.03] px-3 py-1 text-center text-[11px] text-slate-600 dark:text-zinc-400'>
                      {m.text}
                    </span>
                  </li>
                )
              }

              const senderLabel = labelForMessage(m)
              const isMine = isOpenchatMessageMine(m, senderName, myClientId)
              const readCount = isMine && !m.deletedAt ? countReadersForMessage(m.createdAt, m.sender, readStates) : 0
              const replied = m.replyToMessageId ? sortedMessages.find((x) => x.id === m.replyToMessageId) : undefined
              const repliedLabel = replied ? labelForMessage(replied) : ''
              const stickerEmoji = messageStickerEmoji(m.attachments)
              const repliedSticker = replied ? messageStickerEmoji(replied.attachments) : undefined
              const msgReactions = reactionEntries(m.reactions)

              return (
                <li
                  id={`openchat-msg-${m.id}`}
                  key={m.id}
                  className={[
                    isMine ? 'flex justify-end pr-0' : 'flex justify-start gap-1.5',
                    'group scroll-mt-[calc(var(--app-header-h)+0.75rem)]',
                    messageSlideInIds.has(m.id) ? (isMine ? 'openchat-msg-slide-in-mine' : 'openchat-msg-slide-in-other') : '',
                  ].join(' ')}
                >
                  {!isMine ? <Avatar name={senderLabel} size={28} /> : null}
                  <div className={[
                      isMine
                        ? 'ml-auto flex w-fit max-w-[75%] flex-col items-end space-y-0.5 sm:max-w-[28rem]'
                        : 'flex min-w-0 max-w-full flex-1 flex-row items-end gap-1.5 sm:max-w-[36rem]',
                    ].join(' ')}>
                    <div
                      className={[
                        isMine
                          ? 'flex w-full flex-col items-end space-y-0.5'
                          : 'flex max-w-[75%] flex-col items-start space-y-1 text-left sm:max-w-[28rem]',
                      ].join(' ')}
                    >
                    {!isMine ? (
                      <div className='mb-1 text-xs font-medium text-[#4e5968] dark:text-zinc-300'>{senderLabel}</div>
                    ) : null}

                    <div
                      className={[
                        'flex items-end gap-1.5',
                        isMine ? 'w-fit flex-row-reverse' : 'max-w-full',
                      ].join(' ')}
                    >
                      <div
                        className='max-w-full shrink-0'
                      >
                    <div
                      className={[
                        'block w-fit max-w-full px-3 py-2 text-[15px] leading-snug',
                        isMine ? 'openchat-bubble-mine' : 'openchat-bubble-other',
                        m.deletedAt ? 'opacity-70 italic' : '',
                      ].join(' ')}
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
                                  'block max-w-full rounded-lg border-l-2 px-2 py-1.5 text-xs transition hover:brightness-110',
                                  isMine
                                    ? 'border-[#7eb3dc] bg-[#c5dff5]/80 text-right text-[#191f28]'
                                    : 'border-slate-300 bg-slate-50 text-left text-slate-700 dark:border-white/20 dark:bg-black/15 dark:text-zinc-200',
                                ].join(' ')}
                                onClick={() => scrollToQuotedMessage(replied.id)}
                              >
                                <span className='font-medium'>{repliedLabel}</span> ·{' '}
                                {replied.text
                                  ? replied.text.length > 180
                                    ? `${replied.text.slice(0, 180)}…`
                                    : replied.text
                                  : repliedSticker
                                    ? repliedSticker
                                    : '(내용 없음)'}
                              </button>
                            ) : replied?.deletedAt ? (
                              <div
                                className={[
                                  'rounded-lg border-l-2 px-2 py-1 text-xs italic',
                                  isMine
                                    ? 'border-white/35 bg-white/8 text-right text-white/75'
                                    : 'border-slate-400/60 bg-slate-100/80 text-left dark:bg-black/15 text-slate-600 dark:text-zinc-400',
                                ].join(' ')}
                              >
                                삭제된 메시지에 대한 답장
                              </div>
                            ) : (
                              <div
                                className={[
                                  'rounded-lg border-l-2 px-2 py-1 text-xs',
                                  isMine
                                    ? 'border-white/35 bg-white/8 text-right text-white/75'
                                    : 'border-slate-300 bg-slate-50 text-left dark:border-white/20 dark:bg-black/20 text-slate-600 dark:text-zinc-400',
                                ].join(' ')}
                              >
                                원문을 찾을 수 없어요
                              </div>
                            )
                          ) : null}

                          {stickerEmoji ? (
                            <div
                              className={['openchat-message-sticker', isMine ? 'text-right' : 'text-left'].join(' ')}
                              aria-hidden
                            >
                              {stickerEmoji}
                            </div>
                          ) : null}

                          {m.text ? (
                            <div
                              className={[
                                'min-w-0 whitespace-pre-wrap wrap-break-word',
                                isMine ? 'text-right' : 'text-left',
                              ].join(' ')}
                            >
                              {renderTextWithMentions(m.text)}
                            </div>
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
                                ) : a.kind === 'file' ? (
                                  <div
                                    key={i}
                                    className='rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 px-2 py-1 text-left text-xs text-slate-700 dark:text-zinc-200'
                                  >
                                    파일 · {a.name} ({Math.ceil(a.size / 1024)}KB)
                                  </div>
                                ) : null,
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                      </div>

                      {!m.deletedAt ? (
                        <div className='flex shrink-0 items-center gap-1 self-end pb-0.5'>
                          {isMine ? (
                            <>
                              <button
                                type='button'
                                className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#949ba4] transition hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15'
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
                              {readCount > 0 ? (
                                <span className='openchat-msg-meta whitespace-nowrap'>{readCount}명 읽음</span>
                              ) : null}
                              <span className='openchat-msg-meta tabular-nums whitespace-nowrap'>
                                {timeLabel(m.createdAt)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className='openchat-msg-meta tabular-nums whitespace-nowrap'>
                                {timeLabel(m.createdAt)}
                              </span>
                              <button
                                type='button'
                                className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#949ba4] transition hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15'
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
                            </>
                          )}
                        </div>
                      ) : (
                        <div
                          className={[
                            'openchat-msg-meta shrink-0 self-end tabular-nums',
                            isMine ? 'pb-0' : 'pb-1',
                          ].join(' ')}
                        >
                          {timeLabel(m.createdAt)}
                        </div>
                      )}
                    </div>

                    {!m.deletedAt && messageHasReactions(m) ? (
                      <div
                        className={['mt-1 flex flex-wrap gap-1', isMine ? 'justify-end' : 'justify-start'].join(' ')}
                        role='list'
                        aria-label='메시지 반응'
                      >
                        {msgReactions.map(({ emoji, count }) => {
                          const mine = hasMyReaction(m.reactions, emoji, myClientId)
                          return (
                            <button
                              key={emoji}
                              type='button'
                              role='listitem'
                              className={[
                                'openchat-msg-reaction-chip',
                                mine ? 'openchat-msg-reaction-chip--mine' : '',
                              ].join(' ')}
                              disabled={!canPost}
                              title={mine ? '내 반응 취소' : '같은 반응 남기기'}
                              onClick={() => void handleToggleReaction(m, emoji)}
                            >
                              <span aria-hidden>{emoji}</span>
                              <span className='openchat-msg-reaction-count'>{count}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          <li aria-hidden className='pointer-events-none h-0 shrink-0 list-none' />
        </ul>
        </div>

      </div>

      {canViewChatHistory && typistLabel ? (
        <div className='openchat-typing-float' role='status' aria-live='polite' aria-atomic='true'>
          <div className='openchat-typing-float-inner' title={typistLabel}>
            <span className='sr-only'>{typistLabel}</span>
            <span className='openchat-typing-float-dots' aria-hidden>
              <span className='openchat-typing-dot' />
              <span className='openchat-typing-dot' />
              <span className='openchat-typing-dot' />
            </span>
          </div>
        </div>
      ) : null}

      {selectedSticker && canPost ? (
        <div ref={stickerPreviewRef} className='openchat-chat-sticker-preview' role='region' aria-label='선택한 이모티콘'>
          <div className='openchat-chat-sticker-preview-inner'>
            <span className='openchat-chat-sticker-preview-emoji' aria-hidden>
              {selectedSticker}
            </span>
            <button
              type='button'
              className='openchat-chat-sticker-preview-close'
              aria-label='이모티콘 선택 취소'
              onClick={() => setSelectedSticker(null)}
            >
              <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' aria-hidden>
                <path d='M18 6 6 18M6 6l12 12' />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {newMsgCount > 0 && !isAtBottom ? (
        <button
          type='button'
          className='openchat-banner-above-compose fixed left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-[#5C87FF]/90 px-4 py-2 text-xs font-medium text-white shadow-[0_10px_30px_-10px_rgba(92,135,255,0.7)] backdrop-blur-md transition hover:bg-[#5C87FF]'
          onClick={() => {
            scrollToBottom()
            setNewMsgCount(0)
          }}
        >
          새 메시지 {newMsgCount}개 · 아래로
        </button>
      ) : null}

      <button
        type='button'
        className={[
          'openchat-fab-above-compose focus-ring fixed right-[max(1.25rem,env(safe-area-inset-right))] z-[95] flex h-10 min-w-10 flex-col items-center justify-center gap-0 rounded-lg border border-slate-200/90 bg-white/95 px-1.5 py-1.5 text-[9px] font-bold leading-none tracking-wide text-slate-800 shadow-[0_6px_24px_-8px_rgba(15,23,42,0.35)] backdrop-blur-md transition-[opacity,transform,visibility] duration-200 hover:bg-slate-50 dark:border-white/12 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.55)] dark:hover:bg-zinc-800/95',
          showScrollTopFab
            ? 'pointer-events-auto visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible translate-y-2 opacity-0',
        ].join(' ')}
        onClick={() => scrollToTop('smooth')}
        aria-label='맨 위로'
        aria-hidden={!showScrollTopFab}
        tabIndex={showScrollTopFab ? 0 : -1}
      >
        <svg viewBox='0 0 24 24' className='h-3.5 w-3.5 shrink-0' fill='none' stroke='currentColor' strokeWidth='2.2' aria-hidden>
          <path d='M12 19V5M5 12l7-7 7 7' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
        <span className='mt-0.5 select-none'>TOP</span>
      </button>

      <div
        ref={composeBarRef}
        className='openchat-compose-dock fixed inset-x-0 z-30 border-t border-[#e5e8ed] bg-white dark:border-white/10 dark:bg-[#161a25]'
      >
        <div className='openchat-compose-dock-inner mx-auto w-full max-w-[1024px] px-4 pt-3'>
          <fetcher.Form
            ref={formRef}
            className='flex flex-col gap-2.5 pb-3'
            method='post'
            onSubmit={() => {
              keyboardWasOpenOnSendRef.current = isOpenchatKeyboardLikelyOpen()
              scrollAfterOwnSendRef.current = true
            }}
          >
            <input type='hidden' name='sender' value={senderName} />
            <input type='hidden' name='replyToMessageId' value={replyTo?.id ?? ''} />
            <input
              type='hidden'
              name='attachmentsJson'
              value={outgoingAttachments.length ? JSON.stringify(outgoingAttachments) : ''}
            />

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
                      <span className='font-semibold text-slate-900 dark:text-white'>{labelForMessage(replyTo)}</span>
                      <span className='font-normal text-slate-600 dark:text-zinc-400'>
                        {' '}
                        <span className='text-slate-400 dark:text-zinc-600'>·</span>{' '}
                        {replyTo.text
                          ? replyTo.text.length > 160
                            ? `${replyTo.text.slice(0, 160)}…`
                            : replyTo.text
                          : messageStickerEmoji(replyTo.attachments) ?? '(내용 없음)'}
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
                    ) : a.kind === 'file' ? (
                      <div className='flex h-14 w-14 items-center justify-center rounded-lg bg-white/5 text-[10px] text-slate-600 dark:text-zinc-400'>
                        FILE
                      </div>
                    ) : null}
                    {a.kind === 'file' ? <div className='mt-1 max-w-[120px] truncate'>{a.name}</div> : null}
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

            <div className='openchat-compose-mention-wrap relative min-w-0'>
              {showMentionPicker ? (
                mentionPickerOptions.length > 0 ? (
                  <ul
                    className='openchat-compose-mention-picker absolute bottom-full left-0 z-40 mb-1 max-h-40 w-full min-w-[12rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#161a25]'
                    role='listbox'
                    aria-label='멘션 대상'
                  >
                    {mentionPickerOptions.map((name, i) => (
                      <li key={name} role='option' aria-selected={i === mentionPickerIndex}>
                        <button
                          type='button'
                          className={[
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                            i === mentionPickerIndex
                              ? 'bg-[#5C87FF]/15 text-slate-900 dark:text-white'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-white/5',
                          ].join(' ')}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            applyMentionPick(name)
                          }}
                        >
                          <span className='font-medium text-[#5C87FF]'>@</span>
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p
                    className='openchat-compose-mention-picker absolute bottom-full left-0 z-40 mb-1 w-full min-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 shadow-lg dark:border-white/10 dark:bg-[#161a25] dark:text-zinc-400'
                    role='status'
                  >
                    멘션할 참여자가 없어요. 메시지가 쌓이면 표시 이름이 나타납니다.
                  </p>
                )
              ) : null}
              <div className='openchat-compose-box'>
                <textarea
                  ref={composeTextareaRef}
                  name='text'
                  rows={1}
                  value={composeText}
                  onChange={(e) => {
                    const v = e.target.value
                    setComposeText(v)
                    setComposeCursor(e.target.selectionStart ?? v.length)
                    if (!v.trim()) flushTypingOff()
                    else bumpTyping()
                  }}
                  onClick={(e) => setComposeCursor(e.currentTarget.selectionStart ?? composeText.length)}
                  onKeyUp={(e) => setComposeCursor(e.currentTarget.selectionStart ?? composeText.length)}
                  onKeyDown={(e) => {
                    if (showMentionPicker && mentionPickerOptions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setMentionPickerIndex((i) => (i + 1) % mentionPickerOptions.length)
                        return
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setMentionPickerIndex(
                          (i) => (i - 1 + mentionPickerOptions.length) % mentionPickerOptions.length,
                        )
                        return
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault()
                        const pick = mentionPickerOptions[mentionPickerIndex]
                        if (pick) applyMentionPick(pick)
                        return
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        const pos = e.currentTarget.selectionStart ?? composeText.length
                        const active = getActiveMentionQuery(composeText, pos)
                        if (active) {
                          setComposeText(composeText.slice(0, active.start) + composeText.slice(pos))
                        }
                        return
                      }
                    } else if (showMentionPicker && e.key === 'Escape') {
                      e.preventDefault()
                      const pos = e.currentTarget.selectionStart ?? composeText.length
                      const active = getActiveMentionQuery(composeText, pos)
                      if (active) {
                        setComposeText(composeText.slice(0, active.start) + composeText.slice(pos))
                      }
                      return
                    }
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      submitCompose()
                    }
                  }}
                  placeholder={
                    !canPost
                      ? '입장 후 메시지를 보낼 수 있어요'
                      : replyTo
                        ? `${labelForMessage(replyTo)}님에게 답장…`
                        : '메시지를 입력하세요.'
                  }
                  disabled={!canPost}
                  className='openchat-compose-input'
                  autoComplete='off'
                  enterKeyHint='send'
                  onFocus={() => syncOpenchatKeyboardLayout(composeBarRef.current)}
                  title={!canPost ? '입장 후 메시지를 보낼 수 있어요' : 'Enter 전송 · Shift+Enter 줄바꿈 · @로 멘션'}
                />
                <div className='openchat-compose-toolbar'>
                <div className='flex min-w-0 flex-1 items-center justify-start gap-1.5'>
                  <div
                    className={[
                      'openchat-compose-icon-group',
                      !canPost ? 'openchat-compose-icon-group--disabled' : '',
                    ].join(' ')}
                  >
                    <label className='openchat-compose-icon-btn' aria-label='첨부'>
                      <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.6' aria-hidden>
                        <rect x='3' y='5' width='18' height='14' rx='2' />
                        <circle cx='8.5' cy='10.5' r='1.5' />
                        <path d='M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L3 20' strokeLinecap='round' strokeLinejoin='round' />
                      </svg>
                      <input type='file' className='hidden' multiple disabled={!canPost} onChange={(e) => void handleFiles(e.target.files)} />
                    </label>
                    <ComposeEmojiPicker disabled={!canPost} onSelect={selectSticker} />
                  </div>

                  <div
                    className={[
                      'openchat-compose-nickname-slot',
                      isNicknameOpen ? 'openchat-compose-nickname-slot--expanded' : 'openchat-compose-nickname-slot--collapsed',
                    ].join(' ')}
                  >
                    {isNicknameOpen ? (
                      <div className='flex h-full min-w-0 items-center gap-1 rounded-lg border border-[#e5e8ed] bg-[#f8f9fb] pl-1.5 pr-2 dark:border-white/10 dark:bg-white/[0.04]'>
                        <Avatar name={senderName} size={20} />
                        <input
                          value={displayNameDraft}
                          onChange={(e) => setDisplayNameDraft(e.target.value)}
                          className='openchat-compose-nickname-input min-w-0 flex-1'
                          placeholder='표시 이름'
                          maxLength={32}
                          aria-label='이 방 표시 이름'
                          enterKeyHint='done'
                        />
                        <button
                          type='button'
                          className='openchat-compose-nickname-action'
                          onClick={() => {
                            setDisplayNameDraft(senderName)
                            setIsNicknameOpen(false)
                          }}
                        >
                          닫기
                        </button>
                        <button
                          type='button'
                          className='openchat-compose-nickname-action openchat-compose-nickname-action--save'
                          onClick={() => {
                            void (async () => {
                              const name = displayNameDraft.trim() || defaultNick
                              try {
                                await setRoomDisplayName(room.id, name)
                                setMyDisplayName(name)
                                setIsNicknameOpen(false)
                                void revalidator.revalidate()
                              } catch (e) {
                                window.alert(e instanceof Error ? e.message : '표시 이름 변경 실패')
                              }
                            })()
                          }}
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <button
                        type='button'
                        title={!canPost ? '입장 후 설정할 수 있어요' : '표시 이름 변경'}
                        className='openchat-compose-nickname-trigger'
                        aria-expanded={isNicknameOpen}
                        onClick={() => {
                          setDisplayNameDraft(senderName)
                          setIsNicknameOpen(true)
                        }}
                      >
                        <Avatar name={senderName} size={20} />
                        <span className='openchat-compose-nickname-label'>{senderName}</span>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type='button'
                  disabled={fetcher.state !== 'idle' || !canPost || !canSendCompose}
                  className='openchat-compose-send'
                  aria-label='보내기'
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={submitCompose}
                >
                  {fetcher.state === 'idle' ? '보내기' : '전송중…'}
                </button>
              </div>
              </div>
            </div>
            <p className='hidden text-[10px] text-slate-500 dark:text-zinc-500 sm:block'>
              Enter 전송 · Shift+Enter 줄바꿈 · 드래그&드롭 가능 · 이미지 500KB · 파일 2MB · 최대 4개
            </p>
          </fetcher.Form>
        </div>
      </div>

      {messageMenu ? (
        <div
          className='openchat-message-actions-overlay'
          role='presentation'
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMessageMenu(null)
          }}
        >
          <div
            ref={messageActionsMenuRef}
            className='openchat-message-actions-menu card w-full overflow-hidden p-0 shadow-xl'
            role='dialog'
            aria-modal='true'
            aria-labelledby='openchat-message-actions-title'
          >
            <div id='openchat-message-actions-title' className='sr-only'>
              메시지 메뉴
            </div>
            <div className='openchat-message-reaction-picker' role='group' aria-label='빠른 반응'>
              {QUICK_MESSAGE_REACTIONS.map((emoji) => {
                const active = hasMyReaction(messageMenu.reactions, emoji, myClientId)
                return (
                  <button
                    key={emoji}
                    type='button'
                    className={[
                      'openchat-message-reaction-picker-btn',
                      active ? 'openchat-message-reaction-picker-btn--active' : '',
                    ].join(' ')}
                    disabled={!canPost}
                    aria-label={`${emoji} 반응${active ? ' 취소' : ''}`}
                    aria-pressed={active}
                    onClick={() => void handleToggleReaction(messageMenu, emoji, { closeMenu: true })}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            <div className='flex flex-col border-t border-slate-200/90 py-1 dark:border-white/10'>
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
              {isModerator ? (
                <button
                  type='button'
                  className='rounded-none px-4 py-3 text-left text-sm text-rose-800 transition hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/35'
                  onClick={() => {
                    void handleDelete(messageMenu.id)
                    setMessageMenu(null)
                  }}
                >
                  삭제
                </button>
              ) : !isOpenchatMessageMine(messageMenu, senderName, myClientId) ? (
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

        </div>
      </div>

      <OpenchatParticipationDrawer
        open={participationDrawerOpen}
        onClose={() => setParticipationDrawerOpen(false)}
        panelRef={participationDrawerRef}
        currentRoomId={room.id}
        refreshKey={participationRefreshKey}
      />

      <OpenchatToastHost />
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
