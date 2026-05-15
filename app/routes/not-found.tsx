import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className='mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-16 text-center'>
      <div className='inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5C87FF]/10 text-[#9DB6FF] ring-1 ring-inset ring-[#5C87FF]/25'>
        <svg viewBox='0 0 24 24' className='h-7 w-7' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='9' />
          <path d='M9 9h.01M15 9h.01M8.5 16a4 4 0 0 1 7 0' />
        </svg>
      </div>
      <h1 className='mt-5 text-4xl font-semibold tracking-tight md:text-5xl'>
        <span className='text-brand-gradient'>404</span>
      </h1>
      <p className='mt-2 text-sm text-slate-600 dark:text-zinc-400'>찾으시는 페이지가 없어요.</p>
      <div className='mt-6 flex flex-wrap items-center justify-center gap-2'>
        <Link to='/' className='btn-primary'>
          홈으로
        </Link>
        <Link to='/rooms' className='btn-ghost'>
          채팅방 둘러보기
        </Link>
      </div>
    </main>
  )
}
