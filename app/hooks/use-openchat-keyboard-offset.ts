import { useEffect } from 'react'

/**
 * iOS Safari: `interactive-widget=resizes-content` 이면 레이아웃이 이미 줄어들므로
 * 추가 bottom offset 은 입력창이 키보드 위로 이중으로 올라갑니다.
 * visualViewport `scroll` 은 채팅 스크롤 시 offset 을 흔들어 고정 UI가 떨립니다 — resize 만 사용.
 */
export function useOpenchatKeyboardOffset(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const vv = window.visualViewport
    if (!vv) return

    let raf = 0

    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const gap = window.innerHeight - vv.height
        // 뷰포트가 이미 키보드만큼 줄었으면(메타 resizes-content) 수동 offset 불필요
        const layoutAlreadyResized = gap < 48
        const offset = layoutAlreadyResized
          ? 0
          : Math.max(0, gap - Math.max(0, vv.offsetTop))
        document.documentElement.style.setProperty('--openchat-keyboard-offset', `${Math.round(offset)}px`)
      })
    }

    sync()
    vv.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      document.documentElement.style.removeProperty('--openchat-keyboard-offset')
    }
  }, [active])
}
