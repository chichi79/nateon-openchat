import { useLayoutEffect } from 'react'

const KEYBOARD_OFFSET_VAR = '--openchat-keyboard-offset'
const COMPOSE_TOP_VAR = '--openchat-compose-top'
const SAFE_BOTTOM_VAR = '--openchat-safe-bottom'

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

function getComposeHeightPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--openchat-compose-h').trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 84
}

function isComposeFocused() {
  const el = document.activeElement
  return el instanceof HTMLElement && Boolean(el.closest('.openchat-compose-dock'))
}

function syncKeyboardLayout() {
  if (typeof window === 'undefined') return

  const root = document.documentElement

  if (!isMobileViewport()) {
    root.style.setProperty(KEYBOARD_OFFSET_VAR, '0px')
    root.style.removeProperty(COMPOSE_TOP_VAR)
    root.style.removeProperty(SAFE_BOTTOM_VAR)
    return
  }

  const vv = window.visualViewport
  if (!vv) {
    root.style.setProperty(KEYBOARD_OFFSET_VAR, '0px')
    root.style.removeProperty(COMPOSE_TOP_VAR)
    root.style.removeProperty(SAFE_BOTTOM_VAR)
    return
  }

  const composeH = getComposeHeightPx()
  const focused = isComposeFocused()
  const keyboardLikely = vv.height < window.innerHeight * 0.85 || focused
  const visualBottom = vv.offsetTop + vv.height
  const top = Math.round(visualBottom - composeH)

  root.style.setProperty(COMPOSE_TOP_VAR, `${top}px`)
  root.style.setProperty(KEYBOARD_OFFSET_VAR, `${Math.round(window.innerHeight - visualBottom)}px`)

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

/** 전송·포커스 직후 visualViewport 정렬이 늦을 때 수동 동기화 */
export function syncOpenchatKeyboardLayout() {
  scheduleSync()
  requestAnimationFrame(scheduleSync)
}

/**
 * 모바일: 입력창을 visualViewport 하단에 `top` 으로 고정 (iOS fixed+bottom 버그 회피).
 */
export function useOpenchatKeyboardOffset(active = true) {
  useLayoutEffect(() => {
    if (!active || typeof window === 'undefined') return

    scheduleSync()

    const vv = window.visualViewport
    vv?.addEventListener('resize', scheduleSync)
    vv?.addEventListener('scroll', scheduleSync)
    window.addEventListener('resize', scheduleSync)
    window.addEventListener('scroll', scheduleSync, { passive: true })
    window.addEventListener('orientationchange', scheduleSync)
    document.addEventListener('focusin', scheduleSync)
    document.addEventListener('focusout', scheduleSync)

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
      document.removeEventListener('focusin', scheduleSync)
      document.removeEventListener('focusout', scheduleSync)
      mq.removeEventListener('change', onMq)
      document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
      document.documentElement.style.removeProperty(COMPOSE_TOP_VAR)
      document.documentElement.style.removeProperty(SAFE_BOTTOM_VAR)
    }
  }, [active])
}
