import { forwardRef, useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigation } from 'react-router'

import clsx from 'clsx'

import { getAuthFromCookie, type OpenChatAuth } from '@/auth/auth'
import { OpenchatPageLoadingShell, openchatPageLoadingCopy } from '@/components/openchat-page-loading'
import { NavigationProgress } from '@/components/navigation-progress'
import { isRoomChatDetailPath, isRoomsListPath } from '@/lib/openchat-room-path'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { ThemeToggle } from '@/components/theme-toggle'

import type { Route } from './+types/main-layout'

function BrandMark() {
  return (
    <Link to='/' className='group inline-flex items-center gap-2.5'>
      <span className='relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7CA1FF] via-[#5C87FF] to-[#7A55E6] shadow-[0_8px_24px_-8px_rgba(92,135,255,0.65)]'>
        <span className='absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-300/40 dark:ring-white/25' />
        <svg viewBox='0 0 24 24' className='h-4 w-4 text-white' fill='none' stroke='currentColor' strokeWidth={2.4} strokeLinecap='round' strokeLinejoin='round'>
          <path d='M21 12a8 8 0 0 1-11.4 7.3L4 21l1.7-5.6A8 8 0 1 1 21 12z' />
        </svg>
      </span>
      <span className='flex items-baseline gap-1'>
        <span className='text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white'>NateOn</span>
        <span className='text-[15px] font-light tracking-tight text-slate-600 dark:text-zinc-400'>OpenChat</span>
      </span>
      <span className='chip chip-brand ml-1 hidden text-[10px] sm:inline-flex'>BETA</span>
    </Link>
  )
}

function AuthBadge({ auth }: { auth: OpenChatAuth | null }) {
  return (
    <span className='chip'>
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          auth ? 'bg-emerald-400 pulse-glow' : 'bg-zinc-500',
        ].join(' ')}
      />
      {auth ? '로그인됨' : '게스트'}
    </span>
  )
}

const TopNav = forwardRef<HTMLElement>(function TopNav(_, ref) {
  const auth = getAuthFromCookie()

  return (
    <header
      ref={ref}
      data-openchat-app-header
      className='glass sticky top-0 z-40 border-b border-slate-200 dark:border-white/5 pt-[env(safe-area-inset-top,0px)]'
    >
      <div className='mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3'>
        <BrandMark />

        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <AuthBadge auth={auth} />
        </div>
      </div>
    </header>
  )
})

export default function MainLayout() {
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const roomChatDetail = isRoomChatDetailPath(pathname)
  /** 다른 화면→대상 진입만. 같은 URL F5 는 루트 HydrateFallback */
  const pendingRoomChatLoad =
    navigation.state === 'loading' &&
    navigation.location != null &&
    isRoomChatDetailPath(navigation.location.pathname) &&
    navigation.location.pathname !== pathname
  const pendingRoomsListLoad =
    navigation.state === 'loading' &&
    navigation.location != null &&
    isRoomsListPath(navigation.location.pathname) &&
    navigation.location.pathname !== pathname
  const headerRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const sync = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--app-header-h', `${Math.round(h * 1000) / 1000}px`)
    }

    sync()
    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  return (
    <div
      className={clsx(
        'min-h-dvh overflow-x-clip',
        roomChatDetail && 'lg:mx-auto lg:w-full lg:max-w-[1024px]',
      )}
    >
      <NavigationProgress />
      <TopNav ref={headerRef} />
      <main
        className={clsx(
          'mx-auto min-w-0 overflow-x-clip',
          roomChatDetail ? 'px-0 pb-0 pt-0' : 'max-w-5xl px-4 py-8',
        )}
      >
        {pendingRoomChatLoad ? (
          <OpenchatPageLoadingShell variant='chat' {...openchatPageLoadingCopy.roomChat} />
        ) : pendingRoomsListLoad ? (
          <OpenchatPageLoadingShell variant='page' {...openchatPageLoadingCopy.roomList} />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorFallback error={error} />
}
