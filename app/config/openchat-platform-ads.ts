/** 운영(플랫폼) 채팅 광고 — 코드·정적 자산으로 관리 (추후 CMS/API 연동 가능) */
export type OpenchatPlatformChatAd = {
  id: string
  /** public 기준 경로 또는 절대 URL */
  imageUrl: string
  title: string
  /** 탭 시 이동 (없으면 미연결) */
  landingUrl?: string
  /** false면 로테이션에서 제외 */
  active?: boolean
}

export const OPENCHAT_PLATFORM_CHAT_ADS: OpenchatPlatformChatAd[] = [
  {
    id: 'coupang-rocketwow',
    imageUrl: '/ads/coupang-rocketwow.png',
    title: '쿠팡 로켓와우',
    landingUrl: 'https://www.coupang.com/',
    active: true,
  },
]
