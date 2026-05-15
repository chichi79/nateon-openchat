/** Vercel/CI에서 공백·대소문자 혼동을 흡수 */
function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

export function isViteEnvTrue(v: unknown): boolean {
  const s = norm(v)
  return s === 'true' || s === '1' || s === 'yes'
}

export function isViteEnvFalse(v: unknown): boolean {
  const s = norm(v)
  return s === 'false' || s === '0' || s === 'no'
}
