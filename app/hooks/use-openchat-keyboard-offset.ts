import { useEffect } from 'react'

const KEYBOARD_OFFSET_VAR = '--openchat-keyboard-offset'

function viewportUsesResizesContent() {
  const content = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
  return content.includes('interactive-widget=resizes-content')
}

/**
 * `interactive-widget=resizes-content`(root viewport 메타)면 레이아웃이 키보드만큼 줄어들어
 * fixed 입력창은 bottom:0 만으로 충분합니다. 수동 offset 을 더하면 전송 후 입력창이 위로 뜁니다.
 * 구형 브라우저만 visualViewport 로 보조 offset 을 계산합니다.
 */
export function useOpenchatKeyboardOffset(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const setOffset = (px: number) => {
      document.documentElement.style.setProperty(KEYBOARD_OFFSET_VAR, `${Math.round(px)}px`)
    }

    if (viewportUsesResizesContent()) {
      setOffset(0)
      return () => document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
    }

    const vv = window.visualViewport
    if (!vv) {
      setOffset(0)
      return () => document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
    }

    let raf = 0

    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const gap = window.innerHeight - vv.height
        const layoutAlreadyResized = gap < 48
        const offset = layoutAlreadyResized ? 0 : Math.max(0, gap - Math.max(0, vv.offsetTop))
        setOffset(offset)
      })
    }

    sync()
    vv.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
    }
  }, [active])
}
