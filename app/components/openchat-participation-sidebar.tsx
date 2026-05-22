import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router'

import type { MyClientParticipationRow, ParticipationRole } from '@/features/openchat/openchat.types'
import { OpenchatAdSlot } from '@/components/openchat-ad-slot'
import { OpenchatRoomIcon } from '@/components/openchat-room-icon'
import { listMyParticipations } from '@/services/openchat.service'

function statusHint(status: MyClientParticipationRow['status']) {
  if (status === 'pending') return '승인 대기'
  if (status === 'rejected') return '거절됨'
  return null
}

function roleLabel(role: ParticipationRole) {
  if (role === 'owner') return '방장'
  return '매니저'
}

type PanelProps = {
  currentRoomId: string
  refreshKey?: string | number
  /** 항목 선택 시 (모바일 드로어 닫기 등) */
  onNavigate?: () => void
  showClose?: boolean
  onClose?: () => void
  /** PC 고정 사이드바: 채팅방 목록 위 더미 광고 */
  showAdSlot?: boolean
}

function useParticipationRows(currentRoomId: string, refreshKey?: string | number) {
  const [rows, setRows] = useState<MyClientParticipationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listMyParticipations()
      .then((res) => {
        if (cancelled) return
        const list = res.participations.filter((p) => p.status !== 'rejected')
        list.sort((a, b) => {
          if (a.roomId === currentRoomId) return -1
          if (b.roomId === currentRoomId) return 1
          return a.roomTitle.localeCompare(b.roomTitle, 'ko')
        })
        setRows(list)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentRoomId, refreshKey])

  return { rows, loading, error }
}

function ParticipationPanel({
  currentRoomId,
  refreshKey,
  onNavigate,
  showClose,
  onClose,
  showAdSlot = false,
}: PanelProps) {
  const { rows, loading, error } = useParticipationRows(currentRoomId, refreshKey)

  return (
    <>
      <div className='openchat-participation-sidebar-head'>
        <div className='flex min-w-0 flex-1 items-start justify-between gap-2'>
          <div className='min-w-0'>
            <h2 className='openchat-participation-sidebar-title'>참여한 방</h2>
            <p className='openchat-participation-sidebar-sub'>방 · 내 대화명</p>
          </div>
          {showClose ? (
            <button
              type='button'
              className='openchat-participation-drawer-close'
              aria-label='목록 닫기'
              onClick={onClose}
            >
              <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
                <path d='M18 6L6 18M6 6l12 12' strokeLinecap='round' />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className='openchat-participation-sidebar-list' role='list'>
        {loading ? (
          <p className='openchat-participation-sidebar-empty'>불러오는 중…</p>
        ) : error ? (
          <p className='openchat-participation-sidebar-empty text-rose-600 dark:text-rose-300'>{error}</p>
        ) : rows.length === 0 ? (
          <p className='openchat-participation-sidebar-empty'>참여한 방이 없어요.</p>
        ) : (
          rows.map((row) => {
            const active = row.roomId === currentRoomId
            const hint = statusHint(row.status)
            const role = row.role
            return (
              <Link
                key={row.roomId}
                to={`/rooms/${encodeURIComponent(row.roomId)}`}
                role='listitem'
                className={[
                  'openchat-participation-sidebar-item',
                  active ? 'openchat-participation-sidebar-item--active' : '',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate?.()}
              >
                <OpenchatRoomIcon
                  roomId={row.roomId}
                  title={row.roomTitle}
                  iconUrl={row.iconUrl}
                  size={40}
                  className='rounded-xl'
                />
                <span className='min-w-0 flex-1'>
                  <span className='openchat-participation-sidebar-name'>{row.roomTitle}</span>
                  <span className='openchat-participation-sidebar-room'>{row.displayName}</span>
                </span>
                {role || hint ? (
                  <span className='flex shrink-0 flex-col items-end gap-1'>
                    {role ? (
                      <span
                        className={[
                          'openchat-participation-sidebar-badge',
                          role === 'owner'
                            ? 'openchat-participation-sidebar-badge--owner'
                            : 'openchat-participation-sidebar-badge--manager',
                        ].join(' ')}
                      >
                        {roleLabel(role)}
                      </span>
                    ) : null}
                    {hint ? (
                      <span className='openchat-participation-sidebar-badge openchat-participation-sidebar-badge--pending'>
                        {hint}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </Link>
            )
          })
        )}
      </div>

      {showAdSlot ? <OpenchatAdSlot placement='participation-sidebar' /> : null}

      <div className='openchat-participation-sidebar-foot'>
        <Link to='/rooms' className='openchat-participation-sidebar-foot-link' onClick={() => onNavigate?.()}>
          채팅방 목록
          <span aria-hidden>›</span>
        </Link>
      </div>
    </>
  )
}

/** PC: 좌측 고정 사이드바 */
export function OpenchatParticipationSidebar(props: Omit<PanelProps, 'showClose' | 'onClose'>) {
  return (
    <aside className='openchat-participation-sidebar' aria-label='참여한 방 목록'>
      <ParticipationPanel {...props} showAdSlot />
    </aside>
  )
}

type DrawerProps = Omit<PanelProps, 'showClose' | 'onClose'> & {
  open: boolean
  onClose: () => void
  panelRef?: RefObject<HTMLDivElement | null>
}

/** 모바일: 좌측 슬라이드 드로어 */
export function OpenchatParticipationDrawer({ open, onClose, panelRef, ...panelProps }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className='openchat-participation-drawer'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        id='openchat-participation-drawer'
        ref={panelRef}
        className='openchat-participation-drawer-panel openchat-participation-sidebar openchat-participation-sidebar--drawer'
        role='dialog'
        aria-modal='true'
        aria-label='참여한 방 목록'
      >
        <ParticipationPanel
          {...panelProps}
          showClose
          onClose={onClose}
          onNavigate={onClose}
          showAdSlot
        />
      </div>
    </div>
  )
}
