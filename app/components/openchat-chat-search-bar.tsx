import type { RefObject } from 'react'

type OpenchatChatSearchBarProps = {
  query: string
  onQueryChange: (value: string) => void
  matchCount: number
  matchIndex: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  onSearchFocus?: () => void
}

export function OpenchatChatSearchBar({
  query,
  onQueryChange,
  matchCount,
  matchIndex,
  onPrev,
  onNext,
  onClose,
  inputRef,
  onSearchFocus,
}: OpenchatChatSearchBarProps) {
  const hasQuery = query.trim().length > 0
  const pos = matchCount > 0 ? matchIndex + 1 : 0

  return (
    <div className='openchat-chat-search-bar'>
      <div className='relative min-w-0 flex-1'>
        <svg
          viewBox='0 0 24 24'
          className='openchat-chat-search-icon pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden
        >
          <circle cx='11' cy='11' r='7' />
          <path d='M21 21l-4.3-4.3' />
        </svg>
        <input
          ref={inputRef}
          type='search'
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder='대화 내용 검색…'
          className='openchat-chat-search-input'
          aria-label='대화 검색'
          enterKeyHint='search'
          autoComplete='off'
          onFocus={onSearchFocus}
        />
      </div>
      <span className='openchat-chat-search-count' aria-live='polite'>
        {hasQuery ? (matchCount > 0 ? `${pos} / ${matchCount}` : '0건') : ' '}
      </span>
      <button
        type='button'
        className='openchat-chat-search-nav'
        aria-label='이전 결과'
        disabled={!hasQuery || matchCount === 0}
        onClick={onPrev}
      >
        <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
          <path d='M15 18l-6-6 6-6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>
      <button
        type='button'
        className='openchat-chat-search-nav'
        aria-label='다음 결과'
        disabled={!hasQuery || matchCount === 0}
        onClick={onNext}
      >
        <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
          <path d='M9 18l6-6-6-6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>
      <button type='button' className='openchat-chat-search-close' aria-label='검색 닫기' onClick={onClose}>
        닫기
      </button>
    </div>
  )
}
