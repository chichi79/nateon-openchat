import type { OpenChatAttachment } from '@/features/openchat/openchat.types'

export const OPENCHAT_STICKER_GROUPS: { label: string; tabIcon: string; emojis: string[] }[] = [
  {
    label: '표정',
    tabIcon: '😊',
    emojis: [
      '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪',
      '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭',
      '😤', '😠', '😡', '🤬', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤫', '🤭',
    ],
  },
  {
    label: '손·하트',
    tabIcon: '👍',
    emojis: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞', '🤟', '🤙', '👋', '💪', '❤️', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '🤍', '💕', '💞', '💓', '💗', '💖', '💘', '💔', '❣️', '💋', '💌',
    ],
  },
  {
    label: '기타',
    tabIcon: '🎉',
    emojis: [
      '🎉', '🔥', '✨', '💯', '⭐', '🌟', '💬', '🎁', '🍻', '☕', '🍕', '🐶', '🐱', '🐻', '🐼', '🦊',
      '🐸', '🐵', '👀', '💤', '✅', '❌', '❓', '❗', '‼️', 'ㅋ', 'ㅎ', 'ㅠ', 'ㅜ',
    ],
  },
]

export function messageStickerEmoji(attachments: OpenChatAttachment[] | undefined): string | undefined {
  const sticker = attachments?.find((a): a is Extract<OpenChatAttachment, { kind: 'sticker' }> => a.kind === 'sticker')
  return sticker?.emoji
}
