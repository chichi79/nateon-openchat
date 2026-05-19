/** 멘션 알림: 앱 on/off + 브라우저 Notification (백그라운드 시 OS 알림) */

const MENTION_NOTIF_ENABLED_KEY = 'openchat.mentionNotificationsEnabled'

export function mentionNotificationSupported(): boolean {
  return typeof globalThis !== 'undefined' && typeof Notification !== 'undefined'
}

export function mentionNotificationPermission(): NotificationPermission {
  if (!mentionNotificationSupported()) return 'denied'
  return Notification.permission
}

export function mentionNotificationSecureContext(): boolean {
  return typeof globalThis !== 'undefined' && globalThis.isSecureContext === true
}

/** 앱에서 멘션 알림(토스트·OS) 사용 여부 — 브라우저 권한과 별도 */
export function readMentionNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(MENTION_NOTIF_ENABLED_KEY)
  if (raw === null) return true
  return raw === '1' || raw === 'true'
}

export function setMentionNotificationsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MENTION_NOTIF_ENABLED_KEY, on ? '1' : '0')
}

export async function promptMentionNotificationPermission(): Promise<NotificationPermission> {
  if (!mentionNotificationSupported()) return 'denied'
  const current = Notification.permission
  if (current !== 'default') return current
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function postMentionBrowserNotification(title: string, body: string, tag: string): boolean {
  if (!readMentionNotificationsEnabled()) return false
  if (!mentionNotificationSupported() || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, tag })
    return true
  } catch {
    return false
  }
}
