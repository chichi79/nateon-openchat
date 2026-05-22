import { useLinkPreview } from '@/hooks/use-link-preview'
import { extractFirstUrlFromText } from '@/lib/openchat-link-preview'

type OpenchatMessageLinkPreviewProps = {
  text: string
  isMine?: boolean
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

export function OpenchatMessageLinkPreview({ text, isMine = false }: OpenchatMessageLinkPreviewProps) {
  const url = extractFirstUrlFromText(text)
  const preview = useLinkPreview(url)

  if (!url || preview === null) return null

  if (preview === 'loading') {
    return (
      <div
        className={[
          'openchat-link-preview openchat-link-preview--loading',
          isMine ? 'openchat-link-preview--mine' : '',
        ].join(' ')}
        aria-hidden
      >
        <span className='openchat-link-preview-shimmer' />
        <span className='openchat-link-preview-shimmer openchat-link-preview-shimmer--short' />
      </div>
    )
  }

  const href = preview.url
  const title = preview.title?.trim() || hostLabel(href)
  const desc = preview.description?.trim()

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className={[
        'openchat-link-preview',
        isMine ? 'openchat-link-preview--mine' : '',
      ].join(' ')}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {preview.imageUrl ? (
        <img src={preview.imageUrl} alt='' className='openchat-link-preview-image' loading='lazy' />
      ) : null}
      <span className='openchat-link-preview-body'>
        {preview.siteName ? <span className='openchat-link-preview-site'>{preview.siteName}</span> : null}
        <span className='openchat-link-preview-title'>{title}</span>
        {desc ? <span className='openchat-link-preview-desc'>{desc}</span> : null}
        <span className='openchat-link-preview-url'>{hostLabel(href)}</span>
      </span>
    </a>
  )
}
