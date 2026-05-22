import { useEffect, useState } from 'react'

import type { OpenChatLinkPreview } from '@/features/openchat/openchat.types'
import { fetchLinkPreview } from '@/services/openchat.service'

const cache = new Map<string, OpenChatLinkPreview | null>()
const inflight = new Map<string, Promise<OpenChatLinkPreview | null>>()

function loadPreview(url: string): Promise<OpenChatLinkPreview | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null)
  const pending = inflight.get(url)
  if (pending) return pending
  const p = fetchLinkPreview(url)
    .then((preview) => {
      cache.set(url, preview)
      inflight.delete(url)
      return preview
    })
    .catch(() => {
      cache.set(url, null)
      inflight.delete(url)
      return null
    })
  inflight.set(url, p)
  return p
}

export function useLinkPreview(url: string | null | undefined) {
  const [preview, setPreview] = useState<OpenChatLinkPreview | null | 'loading'>(null)

  useEffect(() => {
    if (!url) {
      setPreview(null)
      return
    }
    if (cache.has(url)) {
      setPreview(cache.get(url) ?? null)
      return
    }
    setPreview('loading')
    let cancelled = false
    void loadPreview(url).then((p) => {
      if (!cancelled) setPreview(p)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return preview
}
