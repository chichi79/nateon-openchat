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

const ICON_MAX_BYTES = 120_000
const ICON_MAX_SIDE = 256

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}

/** 방 아이콘용 — 긴 변 maxSide, 용량 제한 내 JPEG data URL */
export async function readRoomIconDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 등록할 수 있어요.')
  }
  if (file.size > 2_000_000) {
    throw new Error('이미지는 2MB 이하만 등록할 수 있어요.')
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'))
    reader.readAsDataURL(file)
  })

  const img = await loadImage(raw)
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (!w || !h) throw new Error('이미지 크기를 확인할 수 없어요.')

  const scale = Math.min(1, ICON_MAX_SIDE / Math.max(w, h))
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 처리에 실패했습니다.')
  ctx.drawImage(img, 0, 0, w, h)

  for (const q of [0.88, 0.75, 0.6, 0.5]) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', q)
    if (!blob) continue
    if (blob.size <= ICON_MAX_BYTES) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('이미지 변환에 실패했습니다.'))
        reader.readAsDataURL(blob)
      })
    }
  }

  throw new Error('이미지가 너무 큽니다. 더 작은 사진을 사용해 주세요.')
}
