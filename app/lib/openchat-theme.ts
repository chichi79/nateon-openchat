export const OPENCHAT_THEME_STORAGE_KEY = 'openchat-ui-theme'

export type OpenchatTheme = 'light' | 'dark'

/** `app.css` 의 `--bg` / `--text` 와 동일 — CSS 로드 전 첫 페인트용 */
export const OPENCHAT_THEME_COLORS = {
  dark: { bg: '#07090f', text: '#e7ebf3' },
  light: { bg: '#f4f6fc', text: '#0f172a' },
} as const

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
  const { bg, text } = OPENCHAT_THEME_COLORS[theme]
  return `html,body{background-color:${bg};color:${text};min-height:100%;min-height:100dvh;}`
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

/** Layout `<head>` 최상단 — CSS·HydrateFallback 보다 먼저 테마·배경 적용 */
export const OPENCHAT_THEME_INIT_SCRIPT = `(function(){function boot(bg,fg){var el=document.getElementById('openchat-theme-boot');if(!el){el=document.createElement('style');el.id='openchat-theme-boot';document.head.appendChild(el);}el.textContent='html,body{background-color:'+bg+';color:'+fg+';min-height:100%;min-height:100dvh;}';}try{var k='${OPENCHAT_THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var t=s==='light'||s==='dark'?s:'dark';var bg=t==='light'?'${OPENCHAT_THEME_COLORS.light.bg}':'${OPENCHAT_THEME_COLORS.dark.bg}';var fg=t==='light'?'${OPENCHAT_THEME_COLORS.light.text}':'${OPENCHAT_THEME_COLORS.dark.text}';document.documentElement.style.colorScheme=t;document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-openchat-path',location.pathname);boot(bg,fg);}catch(e){document.documentElement.style.colorScheme='dark';document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-openchat-path',location.pathname);boot('${OPENCHAT_THEME_COLORS.dark.bg}','${OPENCHAT_THEME_COLORS.dark.text}');}})();`
