import { useEffect } from 'react'

/** iOS Safari 등: 가상 키보드가 올라올 때 fixed 입력창이 가리지 않도록 하단 오프셋 동기화 */
export function useOpenchatKeyboardOffset(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--openchat-keyboard-offset', `${Math.round(offset)}px`)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
      document.documentElement.style.removeProperty('--openchat-keyboard-offset')
    }
  }, [active])
}
