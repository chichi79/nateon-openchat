import { useLayoutEffect } from 'react'

import { isOpenchatMobileChatViewport } from '@/lib/openchat-mobile-chat'

const KEYBOARD_OFFSET_VAR = '--openchat-keyboard-offset'
const COMPOSE_TOP_VAR = '--openchat-compose-top'
const SAFE_BOTTOM_VAR = '--openchat-safe-bottom'

function getComposeHeightPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--openchat-compose-h').trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 72
}

function isComposeFocused() {
  const el = document.activeElement
  return el instanceof HTMLElement && Boolean(el.closest('.openchat-compose-dock'))
}

/** 모바일 입력창(또는 compose 내부) 포커스 여부 */
export function isOpenchatComposeFocused() {
  return isComposeFocused()
}

/** 키보드가 올라와 있는 것으로 보이는지 (visualViewport + 포커스) */
export function isOpenchatKeyboardLikelyOpen() {
  if (typeof window === 'undefined') return false
  if (!isOpenchatMobileChatViewport()) return false
  if (isComposeFocused()) return true
  const vv = window.visualViewport
  if (!vv) return false
  return vv.height < window.innerHeight * 0.85
}

export function blurOpenchatCompose() {
  const el = document.activeElement
  if (el instanceof HTMLElement && el.closest('.openchat-compose-dock')) {
    el.blur()
  }
}

function resolveComposeDock(explicit?: HTMLElement | null) {
  if (explicit) return explicit
  const el = document.querySelector('.openchat-compose-dock')
  return el instanceof HTMLElement ? el : null
}

/** 입력창·이모티콘 미리보기 공통 앵커 — 실제 getBoundingClientRect().top */
export function syncOpenchatComposeAnchor(composeEl?: HTMLElement | null) {
  if (typeof window === 'undefined') return
  const compose = resolveComposeDock(composeEl)
  if (!compose) return
  const top = compose.getBoundingClientRect().top
  if (!Number.isFinite(top)) return
  document.documentElement.style.setProperty(COMPOSE_TOP_VAR, `${Math.round(top * 1000) / 1000}px`)
}

function syncKeyboardLayout(composeEl?: HTMLElement | null) {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const compose = resolveComposeDock(composeEl)

  if (!isOpenchatMobileChatViewport()) {
    root.style.setProperty(KEYBOARD_OFFSET_VAR, '0px')
    root.style.removeProperty(SAFE_BOTTOM_VAR)
    if (compose) syncOpenchatComposeAnchor(compose)
    else root.style.removeProperty(COMPOSE_TOP_VAR)
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

  /* 모바일: compose-top 은 visualViewport 계산값만 사용.
   * getBoundingClientRect 로 덮어쓰면 키보드 애니메이션 중 이전 위치로 되돌아감. */
}

let raf = 0
let pendingComposeEl: HTMLElement | null | undefined

function scheduleSync(composeEl?: HTMLElement | null) {
  if (composeEl !== undefined) pendingComposeEl = composeEl
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    syncKeyboardLayout(pendingComposeEl ?? null)
  })
}

/** 전송·포커스·키보드·미리보기 변경 직후 동기화 */
export function syncOpenchatKeyboardLayout(composeEl?: HTMLElement | null) {
  pendingComposeEl = composeEl
  scheduleSync(composeEl)
  requestAnimationFrame(() => scheduleSync())
  window.setTimeout(() => scheduleSync(), 50)
  window.setTimeout(() => scheduleSync(), 150)
}

/**
 * 모바일: 입력창을 visualViewport 하단(`offsetTop + height`)에 `top` 으로 고정.
 */
export function useOpenchatKeyboardOffset(active = true) {
  useLayoutEffect(() => {
    if (!active || typeof window === 'undefined') return

    const onViewportChange = () => scheduleSync()

    scheduleSync()

    const vv = window.visualViewport
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', onViewportChange)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('orientationchange', onViewportChange)
    document.addEventListener('focusin', onViewportChange)
    document.addEventListener('focusout', onViewportChange)

    const mq = window.matchMedia('(max-width: 767px)')
    mq.addEventListener('change', onViewportChange)

    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', onViewportChange)
      vv?.removeEventListener('scroll', onViewportChange)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('orientationchange', onViewportChange)
      document.removeEventListener('focusin', onViewportChange)
      document.removeEventListener('focusout', onViewportChange)
      mq.removeEventListener('change', onViewportChange)
      document.documentElement.style.removeProperty(KEYBOARD_OFFSET_VAR)
      document.documentElement.style.removeProperty(COMPOSE_TOP_VAR)
      document.documentElement.style.removeProperty(SAFE_BOTTOM_VAR)
    }
  }, [active])
}
