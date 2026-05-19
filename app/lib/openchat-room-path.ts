/** `/rooms/:roomId` 상세(채팅) 경로 — `/rooms/new` 제외 */
export function isRoomChatDetailPath(pathname: string) {
  if (!pathname.startsWith('/rooms/')) return false
  const seg = pathname.slice('/rooms/'.length).split('/')[0] ?? ''
  return Boolean(seg) && seg !== 'new'
}

export function isRoomsListPath(pathname: string) {
  return pathname === '/rooms'
}

/** SPA HydrateFallback 첫 페인트용 — `Layout` 인라인 스크립트가 pathname 을 넣어 둠 */
export function hydrateFallbackPathname() {
  if (typeof window !== 'undefined') return window.location.pathname
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-openchat-path') ?? '/'
  }
  return '/'
}

export type HydrateLoadingKind = 'roomChat' | 'roomList' | 'app'

export function resolveHydrateLoadingKind(pathname: string): HydrateLoadingKind {
  if (isRoomChatDetailPath(pathname)) return 'roomChat'
  if (isRoomsListPath(pathname)) return 'roomList'
  return 'app'
}
