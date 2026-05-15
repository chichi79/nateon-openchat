import { useEffect, useMemo, useState } from 'react'
import { Link, useActionData, useNavigate, useSubmit } from 'react-router'

import type { RoomPolicy } from '@/features/openchat/openchat.types'
import { ensureOpenchatClientId } from '@/lib/openchat-identity'
import { createRoom } from '@/services/openchat.service'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'

export async function clientAction({ request }: { request: Request }) {
  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  const policy = String(form.get('policy') ?? '').trim() as RoomPolicy
  const tagsRaw = String(form.get('tags') ?? '').trim()
  const ownerNickname = String(form.get('ownerNickname') ?? 'ㅇㅇ').trim()
  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  try {
    const room = await createRoom({
      title,
      policy,
      tags,
      ownerNickname,
      ownerClientId: ensureOpenchatClientId(),
    })
    return { room, error: undefined as string | undefined }
  } catch (e) {
    const message = e instanceof Error ? e.message : '방을 만들 수 없습니다.'
    return { error: message }
  }
}

type PolicyOption = {
  value: RoomPolicy
  label: string
  desc: string
  icon: React.ReactNode
}

const POLICY_OPTIONS: PolicyOption[] = [
  {
    value: 'gated_open',
    label: '신청/승인형',
    desc: '신청 후 방장 승인으로 입장',
    icon: (
      <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M9 12l2 2 4-4' />
        <circle cx='12' cy='12' r='9' />
      </svg>
    ),
  },
  {
    value: 'open_link',
    label: '공개형',
    desc: '방 목록에 항상 보이며, 승인·초대 없이 누구나 입장',
    icon: (
      <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1' />
        <path d='M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1' />
      </svg>
    ),
  },
  {
    value: 'invite',
    label: '초대형',
    desc: '초대코드를 가진 사람만',
    icon: (
      <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
        <rect x='3' y='11' width='18' height='10' rx='2' />
        <path d='M7 11V7a5 5 0 0 1 10 0v4' />
      </svg>
    ),
  },
]

export default function NewRoomPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const actionData = useActionData() as undefined | { room?: { id: string }; error?: string }
  const [nickname] = useLocalStorageState('openchat.nickname', 'ㅇㅇ')

  const [title, setTitle] = useState('')
  const [policy, setPolicy] = useState<RoomPolicy>('gated_open')
  const [tags, setTags] = useState('MD, 커뮤니티')

  const canSubmit = useMemo(() => title.trim().length > 0, [title])

  const tagList = useMemo(
    () =>
      tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
    [tags],
  )

  useEffect(() => {
    const id = actionData?.room?.id
    if (id) navigate(`/rooms/${id}`)
  }, [actionData?.room?.id, navigate])

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>방 만들기</h1>
          <p className='mt-1 text-sm text-slate-600 dark:text-zinc-400'>Mock API 또는 Firestore로 생성됩니다.</p>
        </div>
        <Link to='/rooms' className='btn-ghost h-9 px-3 text-xs'>
          목록으로
        </Link>
      </div>

      {actionData?.error ? (
        <div className='rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100'>
          <div className='font-medium'>방을 만들지 못했어요</div>
          <p className='mt-1 text-rose-100/90'>{actionData.error}</p>
        </div>
      ) : null}

      <form
        className='card space-y-7 p-6'
        method='post'
        onSubmit={(e) => {
          e.preventDefault()
          submit(e.currentTarget, { method: 'post' })
        }}
      >
        <input type='hidden' name='ownerNickname' value={nickname || 'ㅇㅇ'} />

        <div className='space-y-2'>
          <label htmlFor='title' className='block text-sm font-medium'>
            방 제목
          </label>
          <input
            id='title'
            name='title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='예: 병원 총무 다 모여라'
            className='input'
            autoFocus
          />
          <div className='text-xs text-slate-500 dark:text-zinc-500'>방장: {nickname || 'ㅇㅇ'}</div>
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-medium'>정책</div>
          <div className='grid gap-2 md:grid-cols-3'>
            {POLICY_OPTIONS.map((opt) => {
              const active = policy === opt.value
              return (
                <label
                  key={opt.value}
                  className={[
                    'card card-hover relative cursor-pointer p-4 transition',
                    active ? 'border-[#5C87FF]/40 bg-[#5C87FF]/[0.06] ring-1 ring-[#5C87FF]/40' : '',
                  ].join(' ')}
                >
                  <input
                    type='radio'
                    name='policy'
                    value={opt.value}
                    checked={active}
                    onChange={() => setPolicy(opt.value)}
                    className='sr-only'
                  />
                  <div className='flex items-center justify-between'>
                    <span
                      className={[
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition',
                        active
                          ? 'bg-[#5C87FF]/15 text-[#9DB6FF] ring-[#5C87FF]/40'
                          : 'bg-slate-900/[0.05] dark:bg-white/[0.04] text-slate-600 dark:text-zinc-400 ring-slate-300/35 dark:ring-white/10',
                      ].join(' ')}
                    >
                      {opt.icon}
                    </span>
                    <span
                      className={[
                        'h-4 w-4 rounded-full border transition',
                        active ? 'border-[#5C87FF] bg-[#5C87FF] shadow-[0_0_0_4px_rgba(92,135,255,0.18)]' : 'border-slate-300 dark:border-white/15',
                      ].join(' ')}
                      aria-hidden
                    />
                  </div>
                  <div className='mt-3 text-sm font-semibold'>{opt.label}</div>
                  <div className='mt-1 text-xs text-slate-600 dark:text-zinc-400'>{opt.desc}</div>
                </label>
              )
            })}
          </div>
        </div>

        <div className='space-y-2'>
          <label htmlFor='tags' className='block text-sm font-medium'>
            태그
          </label>
          <input
            id='tags'
            name='tags'
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder='쉼표로 구분 — 예: MD, 리테일, 신제품'
            className='input'
          />
          {tagList.length ? (
            <div className='flex flex-wrap gap-1.5 pt-1'>
              {tagList.map((t) => (
                <span key={t} className='chip'>
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className='divider' />

        <div className='flex justify-end gap-2'>
          <button type='button' className='btn-ghost' onClick={() => navigate('/rooms')}>
            취소
          </button>
          <button type='submit' disabled={!canSubmit} className='btn-primary'>
            방 생성
            <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M5 12h14M13 5l7 7-7 7' />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
