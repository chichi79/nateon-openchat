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
  onIconUrlChange: (url: string | null) => void
  onChatBackgroundUrlChange: (url: string | null) => void
}

export function OpenchatRoomAppearanceFields({
  roomId,
  roomTitle,
  iconUrl,
  chatBackgroundUrl,
  onIconUrlChange,
  onChatBackgroundUrlChange,
}: OpenchatRoomAppearanceFieldsProps) {
  const [iconBusy, setIconBusy] = useState(false)
  const [iconError, setIconError] = useState<string | null>(null)
  const [bgBusy, setBgBusy] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)

  return (
    <div className='space-y-4'>
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

      <ImageField
        label='채팅 배경'
        hint='메시지 목록 뒤에 깔리는 이미지입니다. 말풍선 가독을 위해 살짝 어둡게 처리됩니다.'
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
            <span className='relative z-10 flex h-full items-center justify-center text-[10px] text-white/90'>미리보기</span>
          </div>
        }
      />
    </div>
  )
}
