type OpenchatPlatformChatAdCenterProps = {
  imageUrl: string
}

/** 운영 광고 — 채팅 영역 중앙, 패널 배경과 자연스럽게 섞이는 원사이즈 이미지 */
export function OpenchatPlatformChatAdCenter({ imageUrl }: OpenchatPlatformChatAdCenterProps) {
  return (
    <div className='openchat-platform-chat-ad-layer' aria-hidden>
      <img src={imageUrl} alt='' className='openchat-platform-chat-ad-img' decoding='async' />
    </div>
  )
}
