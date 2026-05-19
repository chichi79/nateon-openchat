import { useEffect } from 'react'

const KEYBOARD_OFFSET_VAR = '--openchat-keyboard-offset'
const SAFE_BOTTOM_VAR = '--openchat-safe-bottom'

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

/**
 * layout viewport 하단과 visual viewport 하단 차이.
 * 양수: 키보드·스크롤 drift → 입력창을 위로
 * 음수: Safari 하단 툴바 숨김 → visual 이 더 길어지면 입력창을 아래로
 */
function visualBottomInset(vv: VisualViewport) {
  return window.innerHeight - vv.offsetTop - vv.height
}

function syncKeyboardLayout() {
  if (typeof window === 'undefined') return

  const root = document.documentElement

  if (!isMobileViewport()) {
    root.style.setProperty(KEYBOARD_OFFSET_VAR, '0px')
    root.style.removeProperty(SAFE_BOTTOM_VAR)
    return
  }

  const vv = window.visualViewport
  if (!vv) {
    root.style.setProperty(KEYBOARD_OFFSET_VAR, '0px')
    root.style.removeProperty(SAFE_BOTTOM_VAR)
    return
  }

  const inset = visualBottomInset(vv)
  const keyboardLikely = vv.height < window.innerHeight * 0.85

  root.style.setProperty(KEYBOARD_OFFSET_VAR, `${Math.round(inset)}px`)
  if (keyboardLikely) {
    root.style.setProperty(SAFE_BOTTOM_VAR, '0px')
  } else {
    root.style.removeProperty(SAFE_BOTTOM_VAR)
  }
}

let raf = 0
function scheduleSync() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    syncKeyboardLayout()
  })
}

/** 전송·포커스 직후 iOS visualViewport 정렬이 늦을 때 수동 동기화 */
export function syncOpenchatKeyboardLayout(opts?: { absorbOffsetTop?: boolean }) {
  if (opts?.absorbOffsetTop && isMobileViewport()) {
    const vv = window.visualViewport
    if (vv && vv.offsetTop > 0 && vv.height < window.innerHeight * 0.85) {
      window.scrollTo(0, window.scrollY + vv.offsetTop)
    }
  }
  scheduleSync()
  requestAnimationFrame(scheduleSync)
}

/**
 * 모바일: `position:fixed` 입력창을 visualViewport 하단에 맞춤.
 * 하단 툴바가 접히면 inset 이 음수가 되어 입력창이 함께 내려갑니다.
 */
export function useOpenchatKeyboardOffset(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    scheduleSync()

    const vv = window.visualViewport
    vv?.addEventListener('resize', scheduleSync)
    vv?.addEventListener('scroll', scheduleSync)
    window.addEventListener('resize', scheduleSync)
    window.addEventListener('scroll', scheduleSync, { passive: true })
    window.addEventListener('orientationchange', scheduleSync)

    const mq = window.matchMedia('(max-width: 767px)')
    const onMq = () => scheduleSync()
    mq.addEventListener('change', onMq)

    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', scheduleSync)
      vv?.removeEventListener('scroll', scheduleSync)
      window.removeEventListener('resize', scheduleSync)
      window.removeEventListener('scroll', scheduleSync)
      window.removeEventListener('orientationchange', scheduleSync)
      mq.removeEventListener('change', onMq)
      document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
      document.documentElement.style.removeProperty(SAFE_BOTTOM_VAR)
    }
  }, [active])
}
