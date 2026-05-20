/** 멘션·표시 이름 규칙: 공백 없이 한글·영문·숫자·밑줄 */
const ADJECTIVES = [
  '맑은',
  '빠른',
  '조용한',
  '용감한',
  '느긋한',
  '반짝',
  '따뜻한',
  '시원한',
  '행복한',
  '다정한',
  '씩씩한',
  '영리한',
  '부드러운',
  '활발한',
  '차분한',
  '상큼한',
  '든든한',
  '유쾌한',
  '날쌘',
  '포근한',
] as const

const NOUNS = [
  '수달',
  '호랑이',
  '고양이',
  '토끼',
  '여우',
  '다람쥐',
  '펭귄',
  '돌고래',
  '부엉이',
  '참새',
  '바다',
  '구름',
  '별',
  '달',
  '바람',
  '산',
  '강',
  '숲',
  '꽃',
  '나무',
  '별빛',
  '햇살',
  '파도',
  '은하',
] as const

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/** 최초 방문용 띄어쓰기 없는 단어 조합 닉네임 (예: 맑은수달) */
export function generateRandomOpenchatNickname(): string {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}`
}
