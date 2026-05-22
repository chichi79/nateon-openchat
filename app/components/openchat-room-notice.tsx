import { useCallback, useEffect, useState } from 'react'

import type { OpenChatRoomNotice } from '@/features/openchat/openchat.types'
import { OpenchatMessageText } from '@/components/openchat-message-text'

const EXPAND_KEY_PREFIX = 'openchat-room-notice-expanded:'

function readExpanded(roomId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(`${EXPAND_KEY_PREFIX}${roomId}`) === '1'
  } catch {
    return false
  }
}

function writeExpanded(roomId: string, expanded: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (expanded) window.localStorage.setItem(`${EXPAND_KEY_PREFIX}${roomId}`, '1')
    else window.localStorage.removeItem(`${EXPAND_KEY_PREFIX}${roomId}`)
  } catch {
    /* ignore */
  }
}

function noticePreviewLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function NoticeMegaphoneIcon() {
  return (
    <svg viewBox='0 0 20 20' className='openchat-room-notice-icon-svg' fill='currentColor' aria-hidden>
      <path
        fillRule='evenodd'
        d='M18 3a1 1 0 00-1.447-.894L8.524 7.5H5a1 1 0 00-1 1v4a1 1 0 001 1h3.524l8.03 5.394A1 1 0 0018 17.5V3z'
        clipRule='evenodd'
      />
    </svg>
  )
}

function NoticeChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox='0 0 24 24'
      className={['openchat-room-notice-chevron-svg', expanded ? 'openchat-room-notice-chevron-svg--up' : ''].join(' ')}
      fill='none'
      stroke='currentColor'
      strokeWidth='2.2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden
    >
      <path d='M6 9l6 6 6-6' />
    </svg>
  )
}

type OpenchatRoomNoticeBannerProps = {
  roomId: string
  notice: OpenChatRoomNotice
}

export function OpenchatRoomNoticeBanner({ roomId, notice }: OpenchatRoomNoticeBannerProps) {
  const [expanded, setExpanded] = useState(() => readExpanded(roomId))
  const preview = noticePreviewLine(notice.text)

  useEffect(() => {
    setExpanded(readExpanded(roomId))
  }, [roomId])

  const toggle = useCallback(() => {
    setExpanded((open) => {
      const next = !open
      writeExpanded(roomId, next)
      return next
    })
  }, [roomId])

  return (
    <section className='openchat-room-notice' aria-label='방 공지'>
      <button
        type='button'
        className='openchat-room-notice-pill'
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span className='openchat-room-notice-icon' aria-hidden>
          <NoticeMegaphoneIcon />
        </span>
        <span className='openchat-room-notice-pill-text'>
          <span className='openchat-room-notice-pill-label'>방 공지</span>
          <span className='openchat-room-notice-pill-preview'>{preview}</span>
        </span>
        <span className='openchat-room-notice-chevron' aria-hidden>
          <NoticeChevronIcon expanded={expanded} />
        </span>
      </button>
      {expanded ? (
        <div className='openchat-room-notice-panel'>
          <div className='openchat-room-notice-panel-body'>
            <OpenchatMessageText text={notice.text} />
          </div>
          {notice.updatedBy ? (
            <p className='openchat-room-notice-panel-meta'>
              {notice.updatedBy}
              {notice.updatedAt
                ? ` · ${new Date(notice.updatedAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

type OpenchatRoomNoticeEditorProps = {
  draft: string
  onDraftChange: (v: string) => void
  onSave: () => void
  onClear: () => void
  busy: boolean
  maxLength?: number
}

export function OpenchatRoomNoticeEditor({
  draft,
  onDraftChange,
  onSave,
  onClear,
  busy,
  maxLength = 4000,
}: OpenchatRoomNoticeEditorProps) {
  return (
    <div className='space-y-3'>
      <div>
        <div className='text-sm font-semibold text-slate-900 dark:text-white'>방 공지</div>
        <p className='mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400'>
          채팅 상단에 한 줄로 고정되며, 탭하면 전체 내용을 볼 수 있어요.
        </p>
      </div>
      <textarea
        className='input min-h-[8rem] resize-y py-2.5 text-sm leading-relaxed'
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={'예)\n· 참여 전 프로필 확인\n· 홍보·초대 링크: https://…\n· 정기 모임: 매주 수 20:00'}
        maxLength={maxLength}
        aria-label='방 공지 내용'
      />
      <div className='flex flex-wrap gap-2'>
        <button type='button' className='btn-primary h-9 px-4 text-sm' disabled={busy} onClick={onSave}>
          {busy ? '저장 중…' : '저장'}
        </button>
        <button type='button' className='btn-ghost h-9 px-4 text-sm' disabled={busy} onClick={onClear}>
          비우기
        </button>
      </div>
    </div>
  )
}
