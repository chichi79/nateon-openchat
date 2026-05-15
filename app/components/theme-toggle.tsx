import { useCallback, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'

import clsx from 'clsx'

const STORAGE_KEY = 'openchat-ui-theme'

/** `/rooms/:roomId` 채팅 상세 — TOP 버튼과 세로 스택(테마가 아래, TOP은 room-detail에서 더 위) */
function isRoomChatDetailPath(pathname: string) {
  if (!pathname.startsWith('/rooms/')) return false
  const seg = pathname.slice('/rooms/'.length).split('/')[0] ?? ''
  return Boolean(seg) && seg !== 'new'
}

function readTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function subscribe(onChange: () => void) {
  window.addEventListener('openchat-theme', onChange)
  return () => window.removeEventListener('openchat-theme', onChange)
}

function applyTheme(next: 'light' | 'dark') {
  document.documentElement.style.colorScheme = next
  document.documentElement.dataset.theme = next
  window.dispatchEvent(new Event('openchat-theme'))
  requestAnimationFrame(() => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  })
}

export function ThemeToggle() {
  const { pathname } = useLocation()
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark')

  const toggle = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  const isDark = theme === 'dark'
  const stackWithTopFab = isRoomChatDetailPath(pathname)

  return (
    <button
      type='button'
      onClick={toggle}
      className={clsx(
        'focus-ring fixed right-[max(1.25rem,env(safe-area-inset-right))] z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-800 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] backdrop-blur-md transition hover:bg-slate-50 dark:border-white/12 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-[0_10px_36px_-10px_rgba(0,0,0,0.65)] dark:hover:bg-zinc-800/95',
        stackWithTopFab
          ? 'bottom-[calc(16px+3.5rem+max(1.25rem,env(safe-area-inset-bottom)))]'
          : 'bottom-[calc(16px+max(1.25rem,env(safe-area-inset-bottom)))]',
      )}
      aria-label={isDark ? '밝은 테마로 전환' : '어두운 테마로 전환'}
      title={isDark ? '밝은 테마' : '어두운 테마'}
    >
      {isDark ? (
        <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
          <circle cx='12' cy='12' r='4' />
          <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' />
        </svg>
      ) : (
        <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
          <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
        </svg>
      )}
    </button>
  )
}
