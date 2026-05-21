import {
  openchatHydrateBootHelpersScript,
  openchatHydrateBootRunScript,
} from '@/lib/openchat-hydrate-boot'
import { OPENCHAT_THEME_COLORS, type OpenchatTheme } from '@/lib/openchat-theme-tokens'

export const OPENCHAT_THEME_STORAGE_KEY = 'openchat-ui-theme'

export type { OpenchatTheme } from '@/lib/openchat-theme-tokens'

export { OPENCHAT_THEME_COLORS } from '@/lib/openchat-theme-tokens'

export function openchatPageLoadingShellColors(theme: OpenchatTheme, variant: 'chat' | 'page') {
  const c = OPENCHAT_THEME_COLORS[theme]
  return {
    backgroundColor: variant === 'chat' ? c.chatPanel : c.bg,
    color: c.text,
  }
}

export function readStoredOpenchatTheme(): OpenchatTheme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(OPENCHAT_THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

export function readOpenchatThemeFromDocument(): OpenchatTheme {
  if (typeof document === 'undefined') return readStoredOpenchatTheme()
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function themeBootCss(theme: OpenchatTheme) {
  const { bg, text, chatPanel } = OPENCHAT_THEME_COLORS[theme]
  return [
    `html,body{background-color:${bg}!important;color:${text}!important;min-height:100%;min-height:100dvh;}`,
    `html[data-theme="${theme}"] .openchat-hydrate-layout,html[data-theme="${theme}"] .openchat-page-loading-shell--page{background-color:${bg}!important;color:${text}!important;}`,
    `html[data-theme="${theme}"] .openchat-page-loading-shell--chat{background-color:${chatPanel}!important;color:${text}!important;}`,
    `.openchat-hydrate-layout{background-color:${bg}!important;color:${text}!important;min-height:100dvh;}`,
    `.openchat-page-loading-shell--page{background-color:${bg}!important;color:${text}!important;}`,
    `.openchat-page-loading-shell--chat{background-color:${chatPanel}!important;color:${text}!important;}`,
  ].join('')
}

export function syncOpenchatThemeBootStyle(theme: OpenchatTheme) {
  if (typeof document === 'undefined') return
  let boot = document.getElementById('openchat-theme-boot')
  if (!boot) {
    boot = document.createElement('style')
    boot.id = 'openchat-theme-boot'
    document.head.appendChild(boot)
  }
  boot.textContent = themeBootCss(theme)
}

export function applyOpenchatTheme(theme: OpenchatTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.style.colorScheme = theme
  document.documentElement.setAttribute('data-theme', theme)
  syncOpenchatThemeBootStyle(theme)
  window.dispatchEvent(new Event('openchat-theme'))
  try {
    localStorage.setItem(OPENCHAT_THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

const hydrateHelpers = openchatHydrateBootHelpersScript()
const hydrateRun = openchatHydrateBootRunScript(OPENCHAT_THEME_STORAGE_KEY)

/** Layout `<head>` 최상단 — html 즉시 배경(채팅 경로는 패널색) */
export const OPENCHAT_THEME_INIT_SCRIPT = `(function(){${hydrateHelpers}${hydrateRun}})();`

/** Layout `<body>` 최상단 — body 배경 즉시 적용 */
export const OPENCHAT_THEME_BODY_PAINT_SCRIPT = `(function(){${hydrateHelpers}${hydrateRun}})();`

/** HydrateFallback DOM 직후 — 셸 클래스·문구 재동기화 */
export const OPENCHAT_THEME_BODY_SYNC_SCRIPT = OPENCHAT_THEME_BODY_PAINT_SCRIPT
