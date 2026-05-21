import { useCallback } from 'react'

import { useOpenchatTheme } from '@/hooks/use-openchat-theme'
import { applyOpenchatTheme, type OpenchatTheme } from '@/lib/openchat-theme'

function IconSun() {
  return (
    <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.75' aria-hidden>
      <circle cx='12' cy='12' r='4' strokeLinecap='round' strokeLinejoin='round' />
      <path
        d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.75' aria-hidden>
      <path
        d='M20.985 12.486a8.5 8.5 0 1 1-9.471-9.472 7 7 0 0 0 9.471 9.472z'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function ThemeToggle() {
  const theme = useOpenchatTheme()

  const toggle = useCallback(() => {
    applyOpenchatTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <button
      type='button'
      onClick={toggle}
      className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#949ba4] transition hover:bg-[#f2f3f5] hover:text-[#191f28] dark:hover:bg-white/10 dark:hover:text-zinc-100'
      aria-label={isDark ? '밝은 테마로 전환' : '어두운 테마로 전환'}
      title={isDark ? '밝은 테마' : '어두운 테마'}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </button>
  )
}
