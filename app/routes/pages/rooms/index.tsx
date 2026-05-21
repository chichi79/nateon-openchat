import { useEffect, useMemo, useState } from 'react'
import { Form, Link, useLoaderData, useRevalidator, useSearchParams } from 'react-router'

import { OpenchatNicknameIntroOverlay } from '@/components/openchat-nickname-intro-overlay'
import { OpenchatRoomIcon } from '@/components/openchat-room-icon'
import { useOpenchatFirestore } from '@/config/openchat-backend'
import type { OpenChatRoom, RoomPolicy } from '@/features/openchat/openchat.types'
import { bootstrapOpenchatIdentityOnRoomList, completeOpenchatNicknameIntro } from '@/lib/openchat-identity-bootstrap'
import { isViteEnvFalse } from '@/lib/vite-env-flags'
import { resetOpenchatMockStorage } from '@/mocks/install-mock-fetch'
import { filterRoomsByParams, subscribeRoomsCollection } from '@/services/openchat-firestore.service'
import { listRooms } from '@/services/openchat.service'
export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const policy = url.searchParams.get('policy') ?? ''

  try {
    const rooms = await listRooms({ q, policy: policy as '' | 'invite' | 'open_link' | 'gated_open' })
    return { rooms, q, policy, loadError: undefined as string | undefined }
  } catch (e) {
    const message = e instanceof Error ? e.message : '채팅방 목록을 불러오지 못했습니다.'
    return { rooms: [] as OpenChatRoom[], q, policy, loadError: message }
  }
}

function policyMeta(policy: RoomPolicy): { label: string; chip: string; desc: string } {
  switch (policy) {
    case 'invite':
      return { label: '초대형', chip: 'chip chip-amber', desc: '초대코드로만 입장' }
    case 'open_link':
      return { label: '공개형', chip: 'chip chip-emerald', desc: '목록에 항상 노출 · 누구나 바로 입장' }
    case 'gated_open':
      return { label: '신청/승인형', chip: 'chip chip-brand', desc: '신청 후 방장 승인' }
  }
}

export default function RoomsPage() {
  const { rooms: loaderRooms, q, policy, loadError } = useLoaderData() as {
    rooms: OpenChatRoom[]
    q: string
    policy: string
    loadError?: string
  }
  const [searchParams] = useSearchParams()
  const revalidator = useRevalidator()
  const firestoreLive = useOpenchatFirestore()
  const mockApiEnvOn = !isViteEnvFalse(import.meta.env.VITE_ENABLE_MOCK_API)
  const showMockReset = !firestoreLive && mockApiEnvOn
  const [mockResetBusy, setMockResetBusy] = useState(false)
  const [rawLiveRooms, setRawLiveRooms] = useState<OpenChatRoom[] | undefined>(undefined)
  const [nicknameIntro, setNicknameIntro] = useState<string | null>(null)

  useEffect(() => {
    const { nickname, showIntro } = bootstrapOpenchatIdentityOnRoomList()
    if (showIntro) setNicknameIntro(nickname)
  }, [])

  function dismissNicknameIntro() {
    completeOpenchatNicknameIntro()
    setNicknameIntro(null)
  }

  async function handleClearAllMockRooms() {
    if (!showMockReset || mockResetBusy) return
    const ok = window.confirm(
      '이 브라우저에 저장된 Mock 채팅방·메시지·멤버 데이터를 모두 지울까요?\n(다른 탭·다른 브라우저에는 영향 없습니다.)',
    )
    if (!ok) return
    setMockResetBusy(true)
    try {
      resetOpenchatMockStorage('empty')
      setRawLiveRooms(undefined)
      await revalidator.revalidate()
    } finally {
      setMockResetBusy(false)
    }
  }

  useEffect(() => {
    if (!firestoreLive || loadError) return
    return subscribeRoomsCollection(setRawLiveRooms)
  }, [firestoreLive, loadError])

  const rooms = useMemo(
    () =>
      filterRoomsByParams(rawLiveRooms !== undefined ? rawLiveRooms : loaderRooms, {
        q,
        policy: policy as '' | 'invite' | 'open_link' | 'gated_open',
      }),
    [rawLiveRooms, loaderRooms, q, policy],
  )
  const segmentBtn = (value: string, label: string) => {
    const active = policy === value || (value === '' && !policy)
    return (
      <button
        key={value || 'all'}
        type='submit'
        name='policy'
        value={value}
        className={[
          'relative h-8 rounded-full px-3.5 text-xs font-medium transition',
          active ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100',
        ].join(' ')}
      >
        {active ? (
          <span className='absolute inset-0 rounded-full bg-[#5C87FF]/15 ring-1 ring-inset ring-[#5C87FF]/35' />
        ) : null}
        <span className='relative z-10'>{label}</span>
      </button>
    )
  }

  return (
    <>
      {nicknameIntro ? (
        <OpenchatNicknameIntroOverlay nickname={nicknameIntro} onConfirm={dismissNicknameIntro} />
      ) : null}
    <div className='min-w-0 max-w-full space-y-6 overflow-x-clip'>
      {loadError ? (
        <div className='rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100'>
          <div className='font-medium'>목록을 불러오지 못했어요</div>
          <p className='mt-1 text-amber-100/85'>{loadError}</p>
          <p className='mt-2 text-xs text-amber-200/70'>
            Firestore를 쓰는 경우: 콘솔에서 규칙 배포·인덱스 링크, `VITE_FIREBASE_*` 값을 확인하세요. Mock만 쓰는 경우: `.env`에서
            `VITE_ENABLE_MOCK_API` 를 켜거나 Firebase 설정을 비워 두세요.
          </p>
        </div>
      ) : null}

      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>채팅방</h1>
           </div>
        <div className='flex flex-wrap items-center gap-2'>
          {showMockReset ? (
            <button
              type='button'
              className='btn-ghost text-rose-600 dark:text-rose-400'
              disabled={mockResetBusy}
              onClick={() => void handleClearAllMockRooms()}
            >
              {mockResetBusy ? '초기화 중…' : 'Mock 목록 전체 삭제'}
            </button>
          ) : null}
          <Link to='/rooms/new' className='btn-primary'>
            <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 5v14M5 12h14' />
            </svg>
            방 만들기
          </Link>
        </div>
      </div>

      <Form method='get' className='card p-3'>
        <div className='flex flex-col gap-2 md:flex-row md:items-center'>
          <div className='relative flex-1'>
            <svg viewBox='0 0 24 24' className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-500' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <circle cx='11' cy='11' r='7' />
              <path d='M21 21l-4.3-4.3' />
            </svg>
            <input name='q' defaultValue={q} placeholder='방 제목 / 태그 검색…' className='input pl-9' />
          </div>
          <button type='submit' className='btn-primary'>
            검색
          </button>
          {searchParams.toString() ? (
            <Link to='/rooms' className='btn-ghost'>
              초기화
            </Link>
          ) : null}
        </div>

        <div className='mt-3 inline-flex flex-wrap items-center gap-1 rounded-full bg-slate-900/[0.04] dark:bg-white/[0.03] p-1 ring-1 ring-inset ring-slate-200/40 dark:ring-white/5'>
          {segmentBtn('', '전체')}
          {segmentBtn('open_link', '공개형')}
          {segmentBtn('gated_open', '신청/승인형')}
          {segmentBtn('invite', '초대형')}
        </div>
      </Form>

      {rooms.length === 0 ? (
        <div className='card p-10 text-center'>
          <div className='mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5C87FF]/10 ring-1 ring-inset ring-[#5C87FF]/25'>
            <svg viewBox='0 0 24 24' className='h-5 w-5 text-[#9DB6FF]' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M21 12a8 8 0 0 1-11.4 7.3L4 21l1.7-5.6A8 8 0 1 1 21 12z' />
            </svg>
          </div>
          <div className='mt-3 text-sm font-semibold'>일치하는 방이 없어요</div>
          <div className='mt-1 text-sm text-slate-600 dark:text-zinc-400'>검색어를 바꾸거나 새 방을 만들어 보세요.</div>
          <Link to='/rooms/new' className='btn-primary mt-5'>
            방 만들기
          </Link>
        </div>
      ) : (
        <ul className='grid gap-3 md:grid-cols-2'>
          {rooms.map((room, i) => {
            const meta = policyMeta(room.policy)
            return (
              <li key={room.id} className='anim-in' style={{ animationDelay: `${i * 30}ms` }}>
                <Link to={`/rooms/${room.id}`} className='card card-hover group block p-5'>
                  <div className='flex items-start gap-4'>
                    <OpenchatRoomIcon roomId={room.id} title={room.title} iconUrl={room.iconUrl} size={48} />

                    <div className='min-w-0 flex-1'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <div className='truncate text-base font-semibold text-slate-900 dark:text-white'>{room.title}</div>
                          <div className='mt-0.5 text-xs text-slate-500 dark:text-zinc-500'>{meta.desc}</div>
                        </div>
                        <span className={meta.chip}>{meta.label}</span>
                      </div>

                      {room.tags.length ? (
                        <div className='mt-3 flex flex-wrap gap-1.5'>
                          {room.tags.slice(0, 4).map((t) => (
                            <span key={t} className='chip'>
                              #{t}
                            </span>
                          ))}
                          {room.tags.length > 4 ? <span className='chip'>+{room.tags.length - 4}</span> : null}
                        </div>
                      ) : null}

                      <div className='mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500'>
                        <span>방장 · {room.ownerNickname}</span>
                        <span className='inline-flex items-center gap-1 text-[#9DB6FF] transition group-hover:translate-x-0.5'>
                          입장
                          <svg viewBox='0 0 24 24' className='h-3.5 w-3.5' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                            <path d='M5 12h14M13 5l7 7-7 7' />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
    </>
  )
}
