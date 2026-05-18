export type OpenchatToastItem = {
  id: string
  message: string
}

type Listener = (items: OpenchatToastItem[]) => void

let items: OpenchatToastItem[] = []
const listeners = new Set<Listener>()
const dismissTimers = new Map<string, number>()

function emit() {
  const snapshot = [...items]
  for (const listener of listeners) listener(snapshot)
}

export function subscribeOpenchatToasts(listener: Listener): () => void {
  listeners.add(listener)
  listener([...items])
  return () => listeners.delete(listener)
}

export function dismissOpenchatToast(id: string) {
  const timer = dismissTimers.get(id)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    dismissTimers.delete(id)
  }
  const next = items.filter((t) => t.id !== id)
  if (next.length === items.length) return
  items = next
  emit()
}

let lastToastMessage = ''
let lastToastAtMs = 0

export function clearOpenchatToasts() {
  if (typeof window === 'undefined') return
  for (const id of [...dismissTimers.keys()]) dismissOpenchatToast(id)
  if (items.length > 0) {
    items = []
    emit()
  }
  lastToastMessage = ''
  lastToastAtMs = 0
}

export function showOpenchatToast(message: string, durationMs = 3800) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (message === lastToastMessage && now - lastToastAtMs < 1500) return
  lastToastMessage = message
  lastToastAtMs = now

  const id = crypto.randomUUID()
  items = [...items, { id, message }]
  emit()
  const timer = window.setTimeout(() => dismissOpenchatToast(id), durationMs)
  dismissTimers.set(id, timer)
}
