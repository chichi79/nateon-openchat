import { getFirebaseApp, isFirebaseConfigured } from '@/firebase'

/** Firestore에 방·메시지·멤버를 저장하는 오픈채팅 백엔드 사용 여부 */
export function useOpenchatFirestore(): boolean {
  return (import.meta.env.VITE_USE_FIRESTORE ?? 'false') === 'true' && isFirebaseConfigured() && getFirebaseApp() !== null
}
