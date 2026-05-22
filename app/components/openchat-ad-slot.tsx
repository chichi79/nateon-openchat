export type OpenchatAdSlotPlacement = 'participation-sidebar' | 'rooms-list'

const PLACEMENT_DESC: Record<OpenchatAdSlotPlacement, string> = {
  'participation-sidebar': '참여 방 메뉴 · 더미 배너',
  'rooms-list': '채팅방 목록 · 더미 배너',
}

type OpenchatAdSlotProps = {
  placement: OpenchatAdSlotPlacement
}

/** 더미 광고 구좌 (MVP·레이아웃 검증용) */
export function OpenchatAdSlot({ placement }: OpenchatAdSlotProps) {
  return (
    <div
      className={['openchat-ad-slot', `openchat-ad-slot--${placement}`].join(' ')}
      role='complementary'
      aria-label='광고'
    >
      <span className='openchat-ad-slot-label'>광고</span>
      <a
        href='#'
        className='openchat-ad-slot-card'
        onClick={(e) => e.preventDefault()}
        aria-label='광고 더미 — 클릭 미연결'
      >
        <span className='openchat-ad-slot-visual' aria-hidden>
          <span className='openchat-ad-slot-visual-icon'>AD</span>
        </span>
        <span className='openchat-ad-slot-copy'>
          <span className='openchat-ad-slot-title'>오픈채팅 홍보 구좌</span>
          <span className='openchat-ad-slot-desc'>{PLACEMENT_DESC[placement]}</span>
        </span>
      </a>
    </div>
  )
}
