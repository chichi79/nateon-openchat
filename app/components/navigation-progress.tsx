import { useNavigation } from 'react-router'

import clsx from 'clsx'

/** 라우트 전환 중 상단 인디케이터(브랜드 톤) */
export function NavigationProgress() {
  const navigation = useNavigation()
  const busy = navigation.state !== 'idle'

  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-x-0 top-0 z-[50] h-0.5 overflow-hidden transition-opacity duration-200',
        busy ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden
    >
      <div className={clsx('openchat-nav-progress h-full', busy && 'openchat-nav-progress--active')} />
    </div>
  )
}
