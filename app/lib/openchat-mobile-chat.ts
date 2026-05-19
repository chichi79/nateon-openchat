/** 모바일 채팅방: 내부 스크롤 + 고정 입력창 레이아웃 */
export function isOpenchatMobileChatViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}
