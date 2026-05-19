/** managers 배열 항목이 멤버 행(내부 키·표시 이름)과 일치하는지 */
export function memberMatchesManagerList(
  managers: string[],
  row: { nickname: string; displayName?: string },
): boolean {
  const label = row.displayName?.trim() || row.nickname
  return managers.includes(row.nickname) || (label.length > 0 && managers.includes(label))
}

/** API에 넘길 표시 이름 또는 내부 키 */
export function memberAdminLabel(row: { nickname: string; displayName?: string }): string {
  return row.displayName?.trim() || row.nickname
}
