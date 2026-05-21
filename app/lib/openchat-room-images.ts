/** 방 아이콘·채팅 배경용 이미지 리사이즈(data URL) */

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

async function readImageDataUrl(
  file: File,
  opts: { maxInputBytes: number; maxSide: number; maxOutputBytes: number; label: string },
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 등록할 수 있어요.')
  }
  if (file.size > opts.maxInputBytes) {
    throw new Error(`${opts.label}은(는) ${Math.round(opts.maxInputBytes / 1_000_000)}MB 이하만 등록할 수 있어요.`)
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

  const scale = Math.min(1, opts.maxSide / Math.max(w, h))
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지 처리에 실패했습니다.')
  ctx.drawImage(img, 0, 0, w, h)

  for (const q of [0.88, 0.75, 0.6, 0.5, 0.42]) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', q)
    if (!blob) continue
    if (blob.size <= opts.maxOutputBytes) {
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

/** 방 아이콘 — 긴 변 256px, 약 120KB */
export function readRoomIconDataUrl(file: File) {
  return readImageDataUrl(file, {
    maxInputBytes: 2_000_000,
    maxSide: 256,
    maxOutputBytes: 120_000,
    label: '아이콘 이미지',
  })
}

/** 채팅 목록 배경 — 긴 변 1280px, 약 450KB */
export function readRoomChatBackgroundDataUrl(file: File) {
  return readImageDataUrl(file, {
    maxInputBytes: 8_000_000,
    maxSide: 1280,
    maxOutputBytes: 450_000,
    label: '배경 이미지',
  })
}
