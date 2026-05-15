import { getFirebaseApp, isFirebaseConfigured } from '@/firebase'
import { isViteEnvTrue } from '@/lib/vite-env-flags'

/** Firestore에 방·메시지·멤버를 저장하는 오픈채팅 백엔드 사용 여부 */
export function useOpenchatFirestore(): boolean {
  return isViteEnvTrue(import.meta.env.VITE_USE_FIRESTORE) && isFirebaseConfigured() && getFirebaseApp() !== null
}
