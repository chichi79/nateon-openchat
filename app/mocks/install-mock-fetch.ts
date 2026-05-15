import { createOpenChatDb, migrateOpenChatDb } from './openchat.db'
import type { OpenChatDb } from './openchat.db'

import { createOpenChatApiHandler } from './openchat-api-core'

export const OPENCHAT_MOCK_DB_STORAGE_KEY = 'openchat.mockdb.v1' as const

const STORAGE_KEY = OPENCHAT_MOCK_DB_STORAGE_KEY

function loadClientDb(): OpenChatDb {
  if (typeof window === 'undefined') return createOpenChatDb()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return migrateOpenChatDb(JSON.parse(raw) as unknown)
  } catch {
    // ignore
  }
  return createOpenChatDb()
}

function persistClient(db: OpenChatDb) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // ignore
  }
}

export function installMockFetch() {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __openchatMockFetchInstalled?: boolean }
  if (w.__openchatMockFetchInstalled) return
  w.__openchatMockFetchInstalled = true

  const handleOpenChatApiRequest = createOpenChatApiHandler({
    loadInitialDb: loadClientDb,
    onPersist: persistClient,
    syncInMemoryFromPersistence() {
      if (typeof window === 'undefined') return undefined
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return undefined
        return migrateOpenChatDb(JSON.parse(raw) as unknown)
      } catch {
        return undefined
      }
    },
  })

  if (typeof console !== 'undefined') {
    console.info(
      '[openchat] client-only mock API active for /api/openchat/* (set VITE_ENABLE_MOCK_API=false to disable).',
    )
  }

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init)
    const url = new URL(req.url, window.location.origin)

    if (!url.pathname.startsWith('/api/openchat/')) {
      return originalFetch(req)
    }

    return handleOpenChatApiRequest(req)
  }
}
