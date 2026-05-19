import { useLayoutEffect } from 'react'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import type { Route } from './+types/root'
import { OpenchatPageLoadingShell, openchatPageLoadingCopy } from '@/components/openchat-page-loading'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { hydrateFallbackPathname, resolveHydrateLoadingKind } from '@/lib/openchat-room-path'
import {
  applyOpenchatTheme,
  OPENCHAT_THEME_INIT_SCRIPT,
  readStoredOpenchatTheme,
} from '@/lib/openchat-theme'
import { useOpenchatFirestore } from '@/config/openchat-backend'
import { getFirebaseApp, isFirebaseConfigured } from '@/firebase'
import { isViteEnvFalse, isViteEnvTrue } from '@/lib/vite-env-flags'
import { installMockFetch } from '@/mocks/install-mock-fetch'

import '@/assets/styles/app.css'

void getFirebaseApp()

const firestoreLive = useOpenchatFirestore()
const mockDisabled = isViteEnvFalse(import.meta.env.VITE_ENABLE_MOCK_API)
const wantsFirestore = isViteEnvTrue(import.meta.env.VITE_USE_FIRESTORE)

if (typeof window !== 'undefined') {
  ;(window as unknown as { __OPENCHAT_BACKEND__?: Record<string, unknown> }).__OPENCHAT_BACKEND__ = {
    firestoreLive,
    firebaseConfigured: isFirebaseConfigured(),
    viteUseFirestore: import.meta.env.VITE_USE_FIRESTORE,
    viteEnableMockApi: import.meta.env.VITE_ENABLE_MOCK_API,
  }
}

if (firestoreLive) {
  // Firestore만 사용 (SDK). `/api/openchat` 목 인터셉터는 설치하지 않음.
} else if (!mockDisabled) {
  installMockFetch()
} else if (wantsFirestore) {
  // Firestore를 켜 두었는데 Firebase env 가 비어 있거나 플레이스홀더인 경우 — 채팅이 전부 막히지 않도록 Mock 을 켠다.
  installMockFetch()
  console.warn(
    '[openchat] VITE_USE_FIRESTORE=true 인데 VITE_FIREBASE_* 가 비어 있거나 플레이스홀더(...)입니다. Mock API를 설치했습니다. 콘솔의 Firebase 설정을 채우면 Firestore로 전환됩니다.',
  )
} else {
  console.warn(
    '[openchat] Mock API(VITE_ENABLE_MOCK_API)가 꺼져 있고 Firestore도 비활성입니다. /api/openchat 를 제공하는 백엔드가 없으면 방 목록·생성이 실패합니다.',
  )
}

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ko' suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: OPENCHAT_THEME_INIT_SCRIPT }} />
        <meta charSet='utf-8' />
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content'
        />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <noscript>
          <div
            style={{
              padding: '2rem',
              fontFamily: 'system-ui, sans-serif',
              background: '#07090f',
              color: '#e7ebf3',
              minHeight: '100vh',
            }}
          >
            <strong>JavaScript가 꺼져 있어요.</strong>
            <p style={{ marginTop: '0.75rem', color: '#9ba4b3', fontSize: '0.9rem' }}>
              NateOn OpenChat을 사용하려면 브라우저에서 JavaScript를 허용해 주세요.
            </p>
          </div>
        </noscript>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  useLayoutEffect(() => {
    applyOpenchatTheme(readStoredOpenchatTheme())
  }, [])

  return <Outlet />
}

/** SPA 초기 청크 로딩 중 — 경로별 문구, 앱 테마(var(--bg)) 유지 */
export function HydrateFallback() {
  const kind = resolveHydrateLoadingKind(hydrateFallbackPathname())
  const copy = openchatPageLoadingCopy[kind]
  const variant = kind === 'roomChat' ? 'chat' : 'page'

  return (
    <div className='openchat-hydrate-fallback'>
      <OpenchatPageLoadingShell variant={variant} fullscreen {...copy} />
    </div>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className='min-h-dvh'>
      <RouteErrorFallback error={error} />
    </main>
  )
}

