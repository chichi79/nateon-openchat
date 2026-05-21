import clsx from 'clsx'

function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (a + 60) % 360
  return `linear-gradient(135deg, hsl(${a} 70% 58%) 0%, hsl(${b} 70% 50%) 100%)`
}

function initialOf(text: string) {
  const t = text.trim()
  if (!t) return '?'
  return [...t][0]!.toUpperCase()
}

function badgeSizeForAvatar(size: number) {
  if (size <= 24) return 11
  if (size <= 28) return 12
  return 14
}

type OpenchatMemberAvatarProps = {
  name: string
  size?: number
  isOwner?: boolean
  className?: string
}

/** 참여자 아바타 — 방장은 링 + 왕관 배지 */
export function OpenchatMemberAvatar({ name, size = 32, isOwner = false, className }: OpenchatMemberAvatarProps) {
  const textClass =
    size <= 24 ? 'text-[9px]' : size <= 28 ? 'text-[10px]' : size <= 32 ? 'text-[11px]' : 'text-xs'
  const badge = badgeSizeForAvatar(size)

  return (
    <span
      className={clsx('openchat-member-avatar', isOwner && 'openchat-member-avatar--owner', className)}
      title={isOwner ? '방장' : undefined}
    >
      <span
        className={clsx('openchat-member-avatar-face', textClass)}
        style={{ width: size, height: size, backgroundImage: gradientFor(name) }}
        aria-hidden
      >
        {initialOf(name)}
      </span>
      {isOwner ? (
        <span
          className='openchat-member-avatar-owner-badge'
          style={{ width: badge, height: badge }}
          aria-label='방장'
        >
          <svg viewBox='0 0 12 12' className='h-[65%] w-[65%]' fill='currentColor' aria-hidden>
            <path d='M6 1.2 7.35 4.1l3.15.46-2.28 2.22.54 3.14L6 8.35 3.24 9.92l.54-3.14L1.5 4.56l3.15-.46L6 1.2z' />
          </svg>
        </span>
      ) : null}
    </span>
  )
}
