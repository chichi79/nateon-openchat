import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

import type { Route } from './+types/root'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { useOpenchatFirestore } from '@/config/openchat-backend'
import { getFirebaseApp, isFirebaseConfigured } from '@/firebase'
import { isViteEnvFalse, isViteEnvTrue } from '@/lib/vite-env-flags'
import { installMockFetch } from '@/mocks/install-mock-fetch'

import '@/assets/styles/app.css'

import { ThemeToggle } from '@/components/theme-toggle'

void getFirebaseApp()

const OPENCHAT_THEME_INIT = `(function(){try{var k='openchat-ui-theme';var s=localStorage.getItem(k);var t=s==='light'||s==='dark'?s:'dark';document.documentElement.style.colorScheme=t;document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.style.colorScheme='dark';document.documentElement.setAttribute('data-theme','dark');}})();`

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
    <html lang='ko' suppressHydrationWarning data-theme='dark' style={{ colorScheme: 'dark' }}>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: OPENCHAT_THEME_INIT }}
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
        <ThemeToggle />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

/** SPA 초기 청크 로딩 중(Tailwind 전에도 보이도록 인라인 스타일만 사용) */
export function HydrateFallback() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0 1.5rem',
        textAlign: 'center',
        background: '#07090f',
        color: '#9ba4b3',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #7CA1FF, #5C87FF, #7A55E6)',
          boxShadow: '0 8px 24px -8px rgba(92,135,255,0.55)',
        }}
        aria-hidden
      />
      <p style={{ fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>OpenChat 불러오는 중…</p>
      <p style={{ fontSize: '0.75rem', lineHeight: 1.6, margin: 0, maxWidth: '22rem', color: '#6a7484' }}>
        화면이 계속 비어 있으면 F12 → Console·Network에서 <span style={{ padding: '0 0.25rem', borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>/assets/</span> 요청이 404인지, 빨간 오류가 있는지 확인해 주세요.
      </p>
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

