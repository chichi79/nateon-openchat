export type OpenchatTheme = 'light' | 'dark'

/** `app.css` 의 `--bg` / `--text` / 채팅 패널과 동일 — CSS 로드 전 첫 페인트용 */
export const OPENCHAT_THEME_COLORS = {
  dark: { bg: '#07090f', text: '#e7ebf3', chatPanel: '#12141c' },
  light: { bg: '#f4f6fc', text: '#0f172a', chatPanel: '#eceff4' },
} as const
