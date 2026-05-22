import { useState, type ReactNode } from 'react'

import { OpenchatRoomIcon } from '@/components/openchat-room-icon'
import { readRoomChatBackgroundDataUrl, readRoomIconDataUrl } from '@/lib/openchat-room-images'

type ImageFieldProps = {
  label: string
  hint: string
  preview: ReactNode
  hasImage: boolean
  busy: boolean
  error: string | null
  onPick: (file: File) => void
  onRemove: () => void
  pickLabel?: string
}

function ImageField({
  label,
  hint,
  preview,
  hasImage,
  busy,
  error,
  onPick,
  onRemove,
  pickLabel,
}: ImageFieldProps) {
  return (
    <div className='space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]'>
      <div>
        <div className='text-sm font-medium text-slate-900 dark:text-white'>{label}</div>
        <p className='mt-0.5 text-xs text-slate-500 dark:text-zinc-500'>{hint}</p>
      </div>
      <div className='flex flex-wrap items-start gap-4'>
        {preview}
        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          <div className='flex flex-wrap gap-2'>
            <label className='btn-ghost inline-flex h-9 cursor-pointer items-center px-3 text-xs'>
              {busy ? '처리 중…' : pickLabel ?? (hasImage ? '이미지 변경' : '이미지 등록')}
              <input
                type='file'
                accept='image/*'
                className='sr-only'
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) onPick(f)
                }}
              />
            </label>
            {hasImage ? (
              <button type='button' className='btn-ghost h-9 px-3 text-xs' disabled={busy} onClick={onRemove}>
                제거
              </button>
            ) : null}
          </div>
          {error ? <p className='text-xs text-rose-500 dark:text-rose-400'>{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

export type OpenchatRoomAppearanceFieldsProps = {
  roomId: string
  roomTitle: string
  iconUrl: string | null
  chatBackgroundUrl: string | null
  chatBackgroundAd: boolean
  onIconUrlChange: (url: string | null) => void
  onChatBackgroundUrlChange: (url: string | null) => void
  onChatBackgroundAdChange: (ad: boolean) => void
}

export function OpenchatRoomAppearanceFields({
  roomId,
  roomTitle,
  iconUrl,
  chatBackgroundUrl,
  chatBackgroundAd,
  onIconUrlChange,
  onChatBackgroundUrlChange,
  onChatBackgroundAdChange,
}: OpenchatRoomAppearanceFieldsProps) {
  const [iconBusy, setIconBusy] = useState(false)
  const [iconError, setIconError] = useState<string | null>(null)
  const [bgBusy, setBgBusy] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)

  return (
    <div className='openchat-appearance-fields space-y-4'>
      <ImageField
        label='방 아이콘'
        hint='목록·헤더에 보입니다. 없으면 방 제목 첫 글자 아바타를 씁니다.'
        hasImage={Boolean(iconUrl)}
        busy={iconBusy}
        error={iconError}
        onPick={(f) => {
          setIconError(null)
          setIconBusy(true)
          void readRoomIconDataUrl(f)
            .then((url) => onIconUrlChange(url))
            .catch((err) => setIconError(err instanceof Error ? err.message : '등록할 수 없습니다.'))
            .finally(() => setIconBusy(false))
        }}
        onRemove={() => {
          onIconUrlChange(null)
          setIconError(null)
        }}
        preview={<OpenchatRoomIcon roomId={roomId} title={roomTitle} iconUrl={iconUrl} size={56} />}
      />

      <div className='space-y-3'>
        <ImageField
          label='채팅 배경'
          hint='일반 꾸미기용 배경입니다. 홍보·광고는 아래 옵션을 켜면 노출되며, 직접 등록한 이미지가 운영 배너보다 우선해요.'
          hasImage={Boolean(chatBackgroundUrl)}
          busy={bgBusy}
          error={bgError}
          pickLabel={chatBackgroundUrl ? '배경 변경' : '배경 등록'}
          onPick={(f) => {
            setBgError(null)
            setBgBusy(true)
            void readRoomChatBackgroundDataUrl(f)
              .then((url) => onChatBackgroundUrlChange(url))
              .catch((err) => setBgError(err instanceof Error ? err.message : '등록할 수 없습니다.'))
              .finally(() => setBgBusy(false))
          }}
          onRemove={() => {
            onChatBackgroundUrlChange(null)
            onChatBackgroundAdChange(false)
            setBgError(null)
          }}
          preview={
            <div
              className='relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-white/15'
              style={
                chatBackgroundUrl
                  ? {
                      backgroundImage: `url(${chatBackgroundUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : { background: 'var(--openchat-chat-panel-bg, #eceff4)' }
              }
            >
              <div className='absolute inset-0 bg-black/35' aria-hidden />
              {chatBackgroundAd ? (
                <span className='absolute bottom-1 right-1 z-10 rounded bg-black/55 px-1 py-0.5 text-[9px] font-bold text-white'>
                  광고
                </span>
              ) : null}
              <span className='relative z-10 flex h-full items-center justify-center text-[10px] text-white/90'>미리보기</span>
            </div>
          }
        />
        <label className='flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 transition dark:border-white/10 dark:bg-white/[0.03]'>
          <input
            type='checkbox'
            className='mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#5C87FF] focus:ring-[#5C87FF]/40 dark:border-white/20'
            checked={chatBackgroundAd}
            onChange={(e) => onChatBackgroundAdChange(e.target.checked)}
          />
          <span className='min-w-0'>
            <span className='block text-sm font-medium text-slate-900 dark:text-white'>홍보·광고 배경으로 표시</span>
            <span className='mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-zinc-500'>
              켜면 제공 배너 또는 등록한 배경이 채팅에 노출돼요. 일정 기간 노출 시 운영 혜택이 제공될 예정입니다.
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}
