/** 화면별 로딩 문구 — 같은 UI, 메시지만 교체 */
export const openchatPageLoadingCopy = {
  roomChat: {
    title: '대화를 불러오고 있어요',
    hint: '메시지와 참여 정보를 가져오는 중입니다',
  },
  roomList: {
    title: '채팅방 목록을 불러오고 있어요',
    hint: '참여 중인 방을 가져오는 중입니다',
  },
  app: {
    title: 'OpenChat을 불러오고 있어요',
    hint: '잠시만 기다려 주세요',
  },
} as const

export type OpenchatPageLoadingCopy = {
  title: string
  hint?: string
}

type OpenchatPageLoadingProps = OpenchatPageLoadingCopy & {
  /** 채팅 패널 위 오버레이용 */
  compact?: boolean
}

export function OpenchatPageLoading({ title, hint, compact = false }: OpenchatPageLoadingProps) {
  return (
    <div
      className={['openchat-page-loading', compact ? 'openchat-page-loading--compact' : ''].join(' ')}
      role='status'
      aria-live='polite'
      aria-busy='true'
    >
      <div className='openchat-page-loading-stage' aria-hidden>
        <div className='openchat-page-loading-bubble openchat-page-loading-bubble--other'>
          <span className='openchat-page-loading-shimmer' />
        </div>
        <div className='openchat-page-loading-bubble openchat-page-loading-bubble--mine'>
          <span className='openchat-page-loading-shimmer' />
        </div>
        <div className='openchat-page-loading-bubble openchat-page-loading-bubble--other openchat-page-loading-bubble--short'>
          <span className='openchat-page-loading-shimmer' />
        </div>
        <div className='openchat-page-loading-typing'>
          <span className='openchat-page-loading-dot' />
          <span className='openchat-page-loading-dot' />
          <span className='openchat-page-loading-dot' />
        </div>
      </div>
      <p className='openchat-page-loading-title'>{title}</p>
      {hint && !compact ? <p className='openchat-page-loading-hint'>{hint}</p> : null}
    </div>
  )
}

type OpenchatPageLoadingShellProps = OpenchatPageLoadingCopy & {
  /** 채팅방: 카카오톡 패널 배경 / 그 외: 앱 기본 배경 */
  variant?: 'chat' | 'page'
}

/** 상단 앱 헤더 + 헤더 아래 로딩 — main-layout·HydrateFallback 공통 */
export function OpenchatPageLoadingShell({ variant = 'page', title, hint }: OpenchatPageLoadingShellProps) {
  const loading = <OpenchatPageLoading title={title} hint={hint} />

  return (
    <div
      className={[
        'openchat-page-loading-shell',
        variant === 'chat' ? 'openchat-page-loading-shell--chat' : 'openchat-page-loading-shell--page',
      ].join(' ')}
    >
      {variant === 'chat' ? <div className='openchat-page-loading-shell-panel'>{loading}</div> : loading}
    </div>
  )
}

/** HydrateFallback 전용 — main-layout TopNav 뜨기 전 로딩만(헤더 영역 비움) */
export function OpenchatHydrateLoadingShell({
  variant = 'page',
  title,
  hint,
}: OpenchatPageLoadingShellProps) {
  return (
    <div className='openchat-hydrate-layout'>
      <OpenchatPageLoadingShell variant={variant} title={title} hint={hint} />
    </div>
  )
}

/** @deprecated `OpenchatPageLoading` 사용 */
export function OpenchatRoomChatLoading({ compact }: { compact?: boolean }) {
  return <OpenchatPageLoading compact={compact} {...openchatPageLoadingCopy.roomChat} />
}

/** @deprecated `OpenchatPageLoadingShell` 사용 */
export function OpenchatRoomChatLoadingShell(props?: Partial<OpenchatPageLoadingShellProps>) {
  return (
    <OpenchatPageLoadingShell variant='chat' {...openchatPageLoadingCopy.roomChat} {...props} />
  )
}

