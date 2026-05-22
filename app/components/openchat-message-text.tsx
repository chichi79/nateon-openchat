import type { ReactNode } from 'react'

import { isMentionToken, splitMentionParts } from '@/lib/openchat-mention'
import { isUrlToken, normalizeMessageLinkHref, splitLinkParts, splitUrlToken } from '@/lib/openchat-message-links'
import { normalizeChatSearchQuery } from '@/lib/openchat-message-search'

function renderHighlightedPlain(text: string, query: string, keyPrefix: string) {
  const q = normalizeChatSearchQuery(query)
  if (!q) return <span key={keyPrefix}>{text}</span>

  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let start = 0
  let part = 0
  while (start <= text.length) {
    const idx = lower.indexOf(q, start)
    if (idx === -1) {
      if (start < text.length) parts.push(<span key={`${keyPrefix}-${part++}`}>{text.slice(start)}</span>)
      break
    }
    if (idx > start) parts.push(<span key={`${keyPrefix}-${part++}`}>{text.slice(start, idx)}</span>)
    parts.push(
      <mark key={`${keyPrefix}-${part++}`} className='openchat-chat-search-mark'>
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    start = idx + q.length
  }
  return parts
}

function renderPlainWithLinks(text: string, searchHighlight: string, keyPrefix: string) {
  const highlight = searchHighlight.trim()
  return splitLinkParts(text).map((part, i) => {
    if (!isUrlToken(part)) {
      return renderHighlightedPlain(part, highlight, `${keyPrefix}-${i}`)
    }
    const { core, trailing } = splitUrlToken(part)
    const href = normalizeMessageLinkHref(core)
    return (
      <span key={`${keyPrefix}-u-${i}`}>
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='openchat-msg-link'
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {highlight ? renderHighlightedPlain(core, highlight, `${keyPrefix}-u-${i}-c`) : core}
        </a>
        {trailing
          ? highlight
            ? renderHighlightedPlain(trailing, highlight, `${keyPrefix}-u-${i}-t`)
            : trailing
          : null}
      </span>
    )
  })
}

type OpenchatMessageTextProps = {
  text: string
  /** 채팅방 검색 하이라이트용 (비우면 미적용) */
  searchHighlight?: string
}

export function OpenchatMessageText({ text, searchHighlight = '' }: OpenchatMessageTextProps) {
  const highlight = searchHighlight.trim()
  return (
    <>
      {splitMentionParts(text).map((part, i) => {
        if (isMentionToken(part)) {
          return (
            <span key={i} className='font-semibold text-[#4a6bcc] dark:text-[#BFD0FF]'>
              {highlight ? renderHighlightedPlain(part, highlight, `m-${i}`) : part}
            </span>
          )
        }
        return <span key={i}>{renderPlainWithLinks(part, highlight, String(i))}</span>
      })}
    </>
  )
}
