import { useRef } from 'react'

import { useFocusTrap } from '@/hooks/use-focus-trap'

function nicknameGradient(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (a + 60) % 360
  return `linear-gradient(135deg, hsl(${a} 70% 58%) 0%, hsl(${b} 70% 50%) 100%)`
}

function nicknameInitial(name: string) {
  const t = name.trim()
  if (!t) return '?'
  return [...t][0]!.toUpperCase()
}

type OpenchatNicknameIntroOverlayProps = {
  nickname: string
  onConfirm: () => void
}

export function OpenchatNicknameIntroOverlay({ nickname, onConfirm }: OpenchatNicknameIntroOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, panelRef, { onEscape: onConfirm })

  return (
    <div
      className='openchat-nickname-intro-overlay'
      role='presentation'
      onClick={(e) => {
        if (e.target === e.currentTarget) onConfirm()
      }}
    >
      <div
        ref={panelRef}
        className='openchat-nickname-intro-card card anim-in'
        role='dialog'
        aria-modal='true'
        aria-labelledby='openchat-nickname-intro-title'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id='openchat-nickname-intro-title' className='text-lg font-semibold tracking-tight text-slate-900 dark:text-white'>
          기본 닉네임이 정해졌어요
        </h2>
        <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400'>
          이 브라우저에서 채팅할 때 쓰는 기본 이름입니다. 아래 이름으로 방에 입장하고 메시지를 보낼 수 있어요.
        </p>

        <div className='openchat-nickname-intro-profile mt-5'>
          <div
            className='openchat-nickname-intro-avatar'
            style={{ backgroundImage: nicknameGradient(nickname) }}
            aria-hidden
          >
            {nicknameInitial(nickname)}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='text-xs font-medium text-slate-500 dark:text-zinc-500'>기본 닉네임</div>
            <div className='mt-0.5 truncate text-xl font-semibold text-slate-900 dark:text-white'>{nickname}</div>
          </div>
        </div>

        <div className='mt-5 rounded-xl border border-[#5C87FF]/20 bg-[#5C87FF]/[0.08] px-3.5 py-3 text-sm leading-6 text-slate-700 dark:border-[#5C87FF]/25 dark:bg-[#5C87FF]/[0.12] dark:text-zinc-300'>
          <span className='font-medium text-[#4A6BCC] dark:text-[#B4C8FF]'>방마다 다른 이름</span>을 쓸 수도 있어요. 채팅방에
          들어간 뒤 입력창 옆 이름을 눌러 그 방에서만 보이는 표시 이름을 바꿀 수 있습니다.
        </div>

        <p className='mt-4 text-xs leading-5 text-slate-500 dark:text-zinc-500'>
          이 기기에 익명 ID가 생성되어, 같은 닉네임을 쓰는 다른 사람과 구분됩니다.
        </p>

        <button type='button' className='btn-primary mt-6 w-full' onClick={onConfirm}>
          확인하고 둘러보기
        </button>
      </div>
    </div>
  )
}
