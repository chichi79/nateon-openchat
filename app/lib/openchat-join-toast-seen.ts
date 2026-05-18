const STORAGE_PREFIX = 'openchat.seen-join.'

export function readSeenJoinClientIds(roomId: string): Set<string> {
  if (typeof sessionStorage === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + roomId)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

export function addSeenJoinClientIds(roomId: string, clientIds: Iterable<string>) {
  if (typeof sessionStorage === 'undefined') return
  const set = readSeenJoinClientIds(roomId)
  let changed = false
  for (const id of clientIds) {
    if (!id || set.has(id)) continue
    set.add(id)
    changed = true
  }
  if (!changed) return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + roomId, JSON.stringify([...set]))
  } catch {
    // quota / private mode
  }
}
