import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { OPENCHAT_STICKER_GROUPS } from '@/lib/openchat-stickers'

type ComposeEmojiPickerProps = {
  disabled?: boolean
  layerTargetRef: RefObject<HTMLElement | null>
  onSelect: (emoji: string) => void
}

export function ComposeEmojiPicker({ disabled, layerTargetRef, onSelect }: ComposeEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const tabStripRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || layerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!disabled) return
    setOpen(false)
  }, [disabled])

  const scrollTabs = (dir: -1 | 1) => {
    const el = tabStripRef.current
    if (!el) return
    el.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  const handleSelect = (emoji: string) => {
    onSelect(emoji)
    setOpen(false)
  }

  const group = OPENCHAT_STICKER_GROUPS[activeGroup]!
  const layerHost = open ? layerTargetRef.current : null
  const layer =
    open && layerHost ? (
      <div
        ref={layerRef}
        className='openchat-emoji-layer'
        role='dialog'
        aria-label='이모티콘 선택'
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          className='openchat-emoji-layer-scrim'
          aria-label='이모티콘 선택 닫기'
          onClick={() => setOpen(false)}
        />
        <div className='openchat-emoji-picker-card'>
          <div className='openchat-emoji-picker-toolbar'>
            <button type='button' className='openchat-emoji-tab-scroll' aria-label='이전 카테고리' onClick={() => scrollTabs(-1)}>
              <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' aria-hidden>
                <path d='M15 6l-6 6 6 6' />
              </svg>
            </button>

            <div ref={tabStripRef} className='openchat-emoji-tab-strip' role='tablist' aria-label='이모티콘 카테고리'>
              {OPENCHAT_STICKER_GROUPS.map((g, i) => {
                const active = i === activeGroup
                return (
                  <button
                    key={g.label}
                    type='button'
                    role='tab'
                    aria-selected={active}
                    aria-label={g.label}
                    className={['openchat-emoji-tab', active ? 'openchat-emoji-tab--active' : ''].join(' ')}
                    onClick={() => setActiveGroup(i)}
                  >
                    <span className='openchat-emoji-tab-icon' aria-hidden>
                      {g.tabIcon}
                    </span>
                  </button>
                )
              })}
            </div>

            <button type='button' className='openchat-emoji-tab-scroll' aria-label='다음 카테고리' onClick={() => scrollTabs(1)}>
              <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' aria-hidden>
                <path d='M9 6l6 6-6 6' />
              </svg>
            </button>
          </div>

          <div className='openchat-emoji-picker-body' role='tabpanel' aria-label={group.label}>
            <div className='openchat-compose-emoji-grid' role='listbox' aria-label={group.label}>
              {group.emojis.map((emoji) => (
                <button
                  key={`${group.label}-${emoji}`}
                  type='button'
                  role='option'
                  className='openchat-compose-emoji-cell'
                  aria-label={emoji}
                  onClick={() => handleSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : null

  return (
    <div ref={rootRef} className='relative shrink-0'>
      <button
        type='button'
        className={['openchat-compose-icon-btn', open ? 'openchat-compose-icon-btn--active' : ''].join(' ')}
        aria-label='이모티콘'
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.6' aria-hidden>
          <circle cx='12' cy='12' r='9' />
          <path d='M8 14s1.5 2 4 2 4-2 4-2' strokeLinecap='round' />
          <circle cx='9' cy='10' r='1' fill='currentColor' stroke='none' />
          <circle cx='15' cy='10' r='1' fill='currentColor' stroke='none' />
        </svg>
      </button>
      {layer && layerHost ? createPortal(layer, layerHost) : null}
    </div>
  )
}
