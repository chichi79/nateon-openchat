import type { Plugin } from 'vite'
import { fetchOpenchatLinkPreview, normalizeLinkPreviewTarget } from './app/lib/openchat-link-preview.server'

export function openchatLinkPreviewPlugin(): Plugin {
  return {
    name: 'openchat-link-preview',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://local')
        if (url.pathname !== '/api/openchat/link-preview') return next()

        const target = url.searchParams.get('url') ?? ''
        if (!normalizeLinkPreviewTarget(target)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'invalid url' }))
          return
        }

        try {
          const preview = await fetchOpenchatLinkPreview(target)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ preview }))
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ preview: null }))
        }
      })
    },
  }
}
