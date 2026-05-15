import { Link, isRouteErrorResponse, useRevalidator } from 'react-router'

export function RouteErrorFallback({ error }: { error: unknown }) {
  const revalidator = useRevalidator()

  let title = '문제가 발생했어요'
  let desc = '예기치 않은 오류로 화면을 불러오지 못했습니다.'

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? '찾을 수 없어요' : `오류 ${error.status}`
    desc =
      error.status === 404
        ? '주소가 바뀌었거나 삭제되었을 수 있어요.'
        : error.statusText || '요청을 처리하지 못했습니다.'
  } else if (error instanceof Error) {
    desc = import.meta.env.DEV ? error.message : desc
  }

  return (
    <div className='mx-auto max-w-lg px-4 py-16'>
      <div className='card p-6 text-center'>
        <h1 className='text-lg font-semibold text-slate-900 dark:text-white'>{title}</h1>
        <p className='mt-2 text-sm text-slate-600 dark:text-zinc-400'>{desc}</p>
        <div className='mt-6 flex flex-wrap justify-center gap-2'>
          <button
            type='button'
            className='btn-primary'
            onClick={() => void revalidator.revalidate()}
            disabled={revalidator.state !== 'idle'}
          >
            {revalidator.state !== 'idle' ? '불러오는 중…' : '다시 시도'}
          </button>
          <Link to='/' className='btn-ghost'>
            홈
          </Link>
          <Link to='/rooms' className='btn-ghost'>
            채팅방 목록
          </Link>
        </div>
        {import.meta.env.DEV && error instanceof Error && error.stack ? (
          <pre className='mt-6 max-h-48 w-full overflow-auto rounded-lg bg-slate-900/10 p-3 text-left text-[11px] leading-relaxed text-slate-700 dark:bg-black/30 dark:text-zinc-300'>
            <code>{error.stack}</code>
          </pre>
        ) : null}
      </div>
    </div>
  )
}
