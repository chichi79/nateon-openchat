import { useSyncExternalStore } from 'react'

import { readOpenchatThemeFromDocument, type OpenchatTheme } from '@/lib/openchat-theme'

function subscribe(onChange: () => void) {
  window.addEventListener('openchat-theme', onChange)
  return () => window.removeEventListener('openchat-theme', onChange)
}

/** `document.documentElement[data-theme]` — 로딩 UI 등 CSS 로드 전에도 사용 */
export function useOpenchatTheme(): OpenchatTheme {
  return useSyncExternalStore(
    subscribe,
    () => readOpenchatThemeFromDocument(),
    () => readOpenchatThemeFromDocument(),
  )
}
