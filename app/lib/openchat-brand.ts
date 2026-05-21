/** NateOn OpenChat BI — 헤더 BrandMark·문서 메타와 동일 */
export const OPENCHAT_BRAND_NAME = 'NateOn OpenChat'
export const OPENCHAT_APP_TITLE = OPENCHAT_BRAND_NAME
export const OPENCHAT_APP_DESCRIPTION =
  'NateOn OpenChat — 공개·초대·신청/승인형 오픈채팅방을 만들고 실시간으로 대화하세요.'

export function formatOpenchatPageTitle(pageTitle: string): string {
  const page = pageTitle.trim()
  if (!page) return OPENCHAT_APP_TITLE
  return `${page} · ${OPENCHAT_BRAND_NAME}`
}

export function openchatFaviconLinks() {
  return [
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/favicon.svg' },
  ] as const
}
