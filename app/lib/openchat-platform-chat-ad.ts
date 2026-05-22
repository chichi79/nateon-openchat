import { OPENCHAT_PLATFORM_CHAT_ADS, type OpenchatPlatformChatAd } from '@/config/openchat-platform-ads'
import { isViteEnvFalse } from '@/lib/vite-env-flags'

export type ChatSurfaceAdKind = 'owner' | 'platform' | null

export type ChatSurfaceDisplayMode = 'none' | 'owner-cover' | 'platform-center'

export type PlatformChatAdDisplay = {
  imageUrl: string
  title: string
  landingUrl?: string
}

export type ChatSurfaceBackground = {
  mode: ChatSurfaceDisplayMode
  /** 방장 배경 — 전체 cover */
  coverImageUrl?: string
  /** 운영 광고 — 중앙 원사이즈 */
  platformAd?: PlatformChatAdDisplay
  adKind: ChatSurfaceAdKind
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function isPlatformChatAdsEnabled(): boolean {
  return !isViteEnvFalse(import.meta.env.VITE_OPENCHAT_PLATFORM_CHAT_ADS)
}

function activePlatformAds(catalog = OPENCHAT_PLATFORM_CHAT_ADS): OpenchatPlatformChatAd[] {
  return catalog.filter((a) => a.active !== false)
}

/** 방·일자 기준으로 운영 광고 1건 선택 (같은 방·같은 날에는 동일 광고) */
export function pickPlatformChatAdForRoom(
  roomId: string,
  catalog = OPENCHAT_PLATFORM_CHAT_ADS,
): OpenchatPlatformChatAd | null {
  if (!isPlatformChatAdsEnabled()) return null
  const ads = activePlatformAds(catalog)
  if (ads.length === 0) return null
  const dayKey = new Date().toISOString().slice(0, 10)
  const idx = hashString(`${roomId}:${dayKey}`) % ads.length
  return ads[idx] ?? null
}

type RoomBgInput = {
  id: string
  chatBackgroundUrl?: string
  chatBackgroundAd?: boolean
}

/** 방장 배경(일반) > 광고 모드(방장 cover 또는 운영 중앙 배너) > 없음 */
export function resolveChatSurfaceBackground(room: RoomBgInput): ChatSurfaceBackground {
  const ownerUrl = room.chatBackgroundUrl?.trim()
  const adMode = room.chatBackgroundAd === true

  if (ownerUrl) {
    return {
      mode: 'owner-cover',
      coverImageUrl: ownerUrl,
      adKind: adMode ? 'owner' : null,
    }
  }

  if (!adMode) {
    return { mode: 'none', adKind: null }
  }

  const platform = pickPlatformChatAdForRoom(room.id)
  if (platform) {
    return {
      mode: 'platform-center',
      platformAd: {
        imageUrl: platform.imageUrl,
        title: platform.title,
        landingUrl: platform.landingUrl,
      },
      adKind: 'platform',
    }
  }

  return { mode: 'none', adKind: null }
}
