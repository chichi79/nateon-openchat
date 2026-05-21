import clsx from 'clsx'

import { openchatRoomGradient, openchatRoomInitial } from '@/lib/openchat-room-icon'

type OpenchatRoomIconProps = {
  roomId: string
  title: string
  iconUrl?: string | null
  size?: number
  className?: string
}

/** 방 아이콘 — iconUrl 없으면 제목 첫 글자 + 그라데이션 */
export function OpenchatRoomIcon({ roomId, title, iconUrl, size = 48, className }: OpenchatRoomIconProps) {
  const icon = iconUrl?.trim()
  const px = `${size}px`
  const fontSize = Math.max(11, Math.round(size * 0.34))

  if (icon) {
    return (
      <img
        src={icon}
        alt=''
        className={clsx('shrink-0 rounded-2xl object-cover ring-1 ring-inset ring-slate-300/40 dark:ring-white/15', className)}
        style={{ width: px, height: px }}
        draggable={false}
      />
    )
  }

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] ring-1 ring-inset ring-slate-300/40 dark:ring-white/15',
        className,
      )}
      style={{ width: px, height: px, fontSize, backgroundImage: openchatRoomGradient(roomId) }}
      aria-hidden
    >
      {openchatRoomInitial(title)}
    </span>
  )
}
