/** 방 꾸미기 — 홍보·광고 배경 프로그램 안내 */
export function OpenchatAppearanceAdGuide() {
  return (
    <aside
      className='openchat-appearance-ad-guide'
      aria-labelledby='openchat-appearance-ad-guide-title'
    >
      <p id='openchat-appearance-ad-guide-title' className='openchat-appearance-ad-guide-title'>
        홍보·광고 배경 안내
      </p>
      <ul className='openchat-appearance-ad-guide-list'>
        <li>
          <strong>제공 배너 노출</strong> — 「홍보·광고 배경」을 켜면 플랫폼에서 제공하는 홍보 배너가 채팅
          영역에 표시됩니다. 직접 등록한 배경이 있으면 그 이미지가 우선해요.
        </li>
        <li>
          <strong>노출 방식</strong> — 배너는 방·일자 기준으로 바뀌며, 참여 멤버 화면에도 동일하게
          보입니다.
        </li>
        <li>
          <strong>운영 혜택</strong> — 일정 기간 광고 배경 노출이 누적되면 방 운영 혜택(노출 리포트,
          프로모션 지원 등)이 제공될 예정입니다. 세부 조건은 정식 오픈 시 안내드릴게요.
        </li>
      </ul>
      <p className='openchat-appearance-ad-guide-foot'>
        베타 기간에는 노출만 집계되며, 혜택 신청은 추후 「내 방」 또는 공지를 통해 안내됩니다.
      </p>
    </aside>
  )
}
