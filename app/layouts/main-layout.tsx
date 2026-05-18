import { forwardRef, useLayoutEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import clsx from 'clsx'

import { getAuthFromCookie, type OpenChatAuth } from '@/auth/auth'
import { NavigationProgress } from '@/components/navigation-progress'
import { RouteErrorFallback } from '@/components/route-error-fallback'

import type { Route } from './+types/main-layout'

function isRoomChatDetailPath(pathname: string) {
  if (!pathname.startsWith('/rooms/')) return false
  const seg = pathname.slice('/rooms/'.length).split('/')[0] ?? ''
  return Boolean(seg) && seg !== 'new'
}

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

function NavPill({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <span
          className={[
            'relative inline-flex h-9 items-center rounded-full px-3.5 text-sm transition',
            isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {isActive ? (
            <span className='absolute inset-0 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07] ring-1 ring-inset ring-slate-300/35 dark:ring-white/10' />
          ) : null}
          <span className='relative z-10'>{children}</span>
        </span>
      )}
    </NavLink>
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
  const oauthLoginUrl = (import.meta.env.VITE_OAUTH_LOGIN_URL as string | undefined) || ''

  return (
    <header
      ref={ref}
      className='glass sticky top-0 z-40 border-b border-slate-200 dark:border-white/5 pt-[env(safe-area-inset-top,0px)]'
    >
      <div className='mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3'>
        <div className='flex items-center gap-4'>
          <BrandMark />
          <span className='hidden h-5 w-px bg-white/10 md:inline-block' />
          <nav className='hidden items-center gap-1 md:flex'>
            <NavPill to='/' end>
              홈
            </NavPill>
            <NavPill to='/rooms'>채팅방</NavPill>
          </nav>
        </div>

        <div className='flex items-center gap-2'>
          <AuthBadge auth={auth} />
          {!auth && oauthLoginUrl ? (
            <a href={oauthLoginUrl} className='btn-ghost h-9 px-3 text-xs'>
              로그인
            </a>
          ) : !auth ? (
            <span className='hidden text-xs text-slate-500 dark:text-zinc-500 lg:inline'>VITE_OAUTH_LOGIN_URL 필요</span>
          ) : null}
        </div>
      </div>

      <nav className='flex items-center gap-1 border-t border-slate-200 dark:border-white/5 px-4 py-2 md:hidden'>
        <NavPill to='/' end>
          홈
        </NavPill>
        <NavPill to='/rooms'>채팅방</NavPill>
      </nav>
    </header>
  )
})

export default function MainLayout() {
  const { pathname } = useLocation()
  const roomChatDetail = isRoomChatDetailPath(pathname)
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
    <div className='min-h-dvh overflow-x-clip'>
      <NavigationProgress />
      <TopNav ref={headerRef} />
      <main
        className={clsx(
          'mx-auto min-w-0 max-w-5xl overflow-x-clip px-4',
          roomChatDetail ? 'pb-8 pt-0' : 'py-8',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorFallback error={error} />
}
