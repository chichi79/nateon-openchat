import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export type UseFocusTrapOptions = {
  onEscape?: () => void
}

/** 모달 등에 포커스를 가두고 Tab 순환, Escape 시 `onEscape` 호출 */
export function useFocusTrap(
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  options?: UseFocusTrapOptions,
) {
  const onEscape = options?.onEscape
  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    if (!root) return

    const listFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    const t = window.setTimeout(() => {
      listFocusable()[0]?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape?.()
        return
      }
      if (e.key !== 'Tab') return
      const els = listFocusable()
      if (els.length === 0) return
      const first = els[0]!
      const last = els[els.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, rootRef, onEscape])
}
