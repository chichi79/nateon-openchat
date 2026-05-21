export { readRoomIconDataUrl } from '@/lib/openchat-room-images'

/** 방 목록·헤더 아바타용 그라데이션 시드 */
export function openchatRoomGradient(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (a + 60) % 360
  return `linear-gradient(135deg, hsl(${a} 70% 58%) 0%, hsl(${b} 70% 50%) 100%)`
}

export function openchatRoomInitial(title: string) {
  const t = title.trim()
  if (!t) return '?'
  return [...t][0]!.toUpperCase()
}
