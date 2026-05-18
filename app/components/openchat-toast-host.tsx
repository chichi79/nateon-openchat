import { useEffect, useState } from 'react'

import clsx from 'clsx'

import { dismissOpenchatToast, subscribeOpenchatToasts, type OpenchatToastItem } from '@/lib/openchat-toast'

type OpenchatToastHostProps = {
  className?: string
}

/** 방 상세 등에서 `showOpenchatToast` 로 띄운 알림 */
export function OpenchatToastHost({ className }: OpenchatToastHostProps) {
  const [toasts, setToasts] = useState<OpenchatToastItem[]>([])

  useEffect(() => subscribeOpenchatToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-x-0 z-[45] flex flex-col items-center gap-2 px-4',
        'bottom-[calc(var(--openchat-keyboard-offset,0px)+var(--openchat-compose-h,5.25rem)+var(--openchat-compose-gap,0.5rem)+0.75rem+env(safe-area-inset-bottom,0px))]',
        className,
      )}
      aria-live='polite'
      aria-relevant='additions'
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className='openchat-toast-enter pointer-events-auto flex w-[min(24rem,calc(100%-2rem))] max-w-full items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-[#161a25]/95 dark:text-zinc-100'
        >
          <span className='min-w-0 flex-1 text-center'>{t.message}</span>
          <button
            type='button'
            className='shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'
            aria-label='닫기'
            onClick={() => dismissOpenchatToast(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
