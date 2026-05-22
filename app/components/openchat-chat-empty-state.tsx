type OpenchatChatEmptyStateProps = {
  canPost: boolean
}

/** 채팅 메시지 0건 — 첫 대화 유도 */
export function OpenchatChatEmptyState({ canPost }: OpenchatChatEmptyStateProps) {
  return (
    <li className='openchat-chat-empty' aria-live='polite'>
      <div className='openchat-chat-empty-inner'>
        <div className='openchat-chat-empty-icon' aria-hidden>
          <svg viewBox='0 0 24 24' className='h-7 w-7' fill='none' stroke='currentColor' strokeWidth='1.5'>
            <path
              d='M8 10h8M8 14h5M6 20l2.5-2H18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11z'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </div>
        <p className='openchat-chat-empty-title'>아직 대화가 없어요</p>
        <p className='openchat-chat-empty-desc'>
          {canPost ? (
            <>
              첫 메시지를 보내 대화를 시작해 보세요.
              <br />
              텍스트·이미지·이모지·답장을 사용할 수 있어요.
            </>
          ) : (
            <>입장 후 멤버들과 대화를 시작할 수 있어요.</>
          )}
        </p>
      </div>
    </li>
  )
}
