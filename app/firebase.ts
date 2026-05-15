import { initializeApp, type FirebaseApp } from 'firebase/app'

/**
 * Firebase Web SDK 초기화.
 * `.env`에 VITE_FIREBASE_* 값이 모두 있을 때만 앱 인스턴스를 만든다.
 * (값이 없으면 null — 아직 Firestore 등을 붙이지 않아도 빌드/실행이 깨지지 않게)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** 빈 값·플레이스홀더는 "설정됨"으로 보지 않는다. */
function isRealFirebaseEnvValue(v: string | undefined): boolean {
  if (v === undefined || typeof v !== 'string') return false
  const s = v.trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (s === '...') return false
  if (lower === 'xxx' || lower === 'changeme' || lower === 'todo' || lower === 'your-api-key') return false
  if (s.startsWith('<') && s.endsWith('>')) return false
  return true
}

export function isFirebaseConfigured(): boolean {
  return (
    isRealFirebaseEnvValue(firebaseConfig.apiKey) &&
    isRealFirebaseEnvValue(firebaseConfig.authDomain) &&
    isRealFirebaseEnvValue(firebaseConfig.projectId) &&
    isRealFirebaseEnvValue(firebaseConfig.storageBucket) &&
    isRealFirebaseEnvValue(firebaseConfig.messagingSenderId) &&
    isRealFirebaseEnvValue(firebaseConfig.appId)
  )
}

let app: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null
  if (!app) {
    app = initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    })
  }
  return app
}
