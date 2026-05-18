import { Link } from 'react-router'

function FeatureCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  delay?: number
}) {
  return (
    <div className='card card-hover anim-in p-5' style={{ animationDelay: `${delay}ms` }}>
      <div className='inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#5C87FF]/10 text-[#9DB6FF] ring-1 ring-inset ring-[#5C87FF]/25'>
        {icon}
      </div>
      <div className='mt-3 text-[15px] font-semibold text-slate-900 dark:text-white'>{title}</div>
      <div className='mt-1.5 text-sm leading-6 text-slate-600 dark:text-zinc-400'>{desc}</div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className='min-w-0 max-w-full space-y-10 overflow-x-clip'>
      <section className='relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/[0.06] p-8 md:p-12'>
        <div className='pointer-events-none absolute inset-0 -z-10'>
          <div className='absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#5C87FF] opacity-25 blur-3xl' />
          <div className='absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[#7A55E6] opacity-20 blur-3xl' />
          <div
            className='absolute inset-0'
            style={{
              background:
                'radial-gradient(80% 60% at 50% 0%, rgba(92,135,255,0.10), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0))',
            }}
          />
        </div>

        <span className='chip chip-brand'>v0.1 · 클라이언트 전용 MVP · 연동 확인</span>
        <h1 className='mt-5 text-3xl font-semibold leading-[1.15] tracking-tight md:text-5xl'>
          업종별/주제별 <span className='text-brand-gradient'>오픈채팅</span> 
        </h1>
        <p className='mt-5 max-w-2xl text-[15px] leading-7 text-slate-600/90 dark:text-zinc-300/90'>
          팀룸(초대형) · 공개형(완전 오픈) · 신청/승인형(제한 공개) — 세 가지 방 정책을 하나의 모델로 통일했습니다.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <Link to='/rooms' className='btn-primary'>
            채팅방 둘러보기
            <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M5 12h14M13 5l7 7-7 7' />
            </svg>
          </Link>
          <Link to='/rooms/new' className='btn-ghost'>
            방 만들기
          </Link>
        </div>
      </section>

      <section className='grid gap-3 md:grid-cols-3'>
        <FeatureCard
          delay={40}
          icon={
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
            </svg>
          }
          title='방 공개 범위'
          desc='초대형 · 공개형 · 신청-승인형. 같은 방 정책 모델 위에서 자유롭게 전환됩니다.'
        />
        <FeatureCard
          delay={80}
          icon={
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M16 11a4 4 0 1 0-8 0M3 21v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1' />
            </svg>
          }
          title='업종별 운영'
          desc='MD · 간호사 · 병원총무 등 도메인 채널을 태그와 정책으로 정돈해 운영합니다.'
        />
        <FeatureCard
          delay={120}
          icon={
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M9 12l2 2 4-4' />
              <circle cx='12' cy='12' r='9' />
            </svg>
          }
          title='모더레이션'
          desc='신청·승인, 차단, 매니저 위임, 강퇴까지 한 화면에서 처리합니다.'
        />
      </section>
    </div>
  )
}
