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
        'openchat-toast-host pointer-events-none z-[45] flex flex-col items-center gap-2 px-4',
        'bottom-[calc(var(--openchat-keyboard-offset,0px)+var(--openchat-compose-h,5.25rem)+var(--openchat-compose-gap,0.5rem)+0.75rem+var(--openchat-safe-bottom,env(safe-area-inset-bottom,0px)))]',
        className,
      )}
      aria-live='polite'
      aria-relevant='additions'
    >
      {toasts.map((t) => (
        <div key={t.id} className='openchat-toast openchat-toast-enter pointer-events-auto'>
          <span className='openchat-toast-message'>{t.message}</span>
          <button
            type='button'
            className='openchat-toast-close'
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
