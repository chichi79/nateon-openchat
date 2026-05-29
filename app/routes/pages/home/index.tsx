import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { formatOpenchatPageTitle } from '@/lib/openchat-brand'

import type { Route } from './+types/index'

export function meta(): Route.MetaDescriptors {
  return [{ title: formatOpenchatPageTitle('홈') }]
}

function FeatureCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: ReactNode
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

type FeatureGroup = {
  title: string
  summary: string
  items: string[]
}

const IMPLEMENTED_FEATURES: FeatureGroup[] = [
  {
    title: '방·목록',
    summary: '만들기부터 찾기까지',
    items: [
      '방 만들기 — 제목, 공개 범위(초대·공개·신청/승인), 태그, 방 아이콘·채팅 배경',
      '방 공지(고정) — 입장 직후 규칙·링크·일정 안내(방장·매니저 편집)',
      'Firestore 실시간 동기화 — 메시지·멤버·읽음 상태',
      '방장 전용 「꾸미기」 — 아이콘·배경·홍보·광고 배경(켜면 노출·혜택 안내)',
      '운영 채팅 광고 — 광고 배경 켠 방·배경 미등록 시 중앙 배너(방·일자별)·AD 바로가기',
      '목록 검색·정책 필터, 태그로 주제 구분',
      '참여 방 사이드바·모바일 드로어 — 다른 방 이동, 대기·방장·매니저 뱃지',
      '목록·사이드바 더미 광고 구좌(레이아웃 검증용)',
      '첫 이용 시 표시 이름 안내(목록 진입)',
    ],
  },
  {
    title: '대화',
    summary: '카카오톡 스타일 채팅 UI',
    items: [
      '텍스트, 이미지·파일, 스티커, 답장, @멘션, URL 링크·OG 미리보기',
      '메시지 이모지 반응, 입력 중 표시, 날짜 구분선(오늘·어제 등)',
      '채팅방 안 대화 검색(하이라이트·이전/다음)',
      '메시지 0건 빈 대화 안내, 드래그앤드롭 첨부',
      '스크롤 UX — 새 메시지 배너·맨 아래로, TOP 버튼(모바일 헤더 스크롤 시 접기)',
      '메시지 메뉴 — 반응·답장(방장·매니저 메시지 삭제, 신고는 준비 중)',
      '시스템 메시지 — 입장·이름 변경 등 안내',
    ],
  },
  {
    title: '알림·읽음',
    summary: '받는 사람 기준',
    items: [
      '멘션 알림 on/off(방 헤더), @멘션 시 토스트(탭이 보일 때) · 브라우저 알림(백그라운드)',
      '내 메시지 읽음 수(· N명 읽음)',
      '새 멤버 입장 토스트',
    ],
  },
  {
    title: '운영·내 설정',
    summary: '방장·매니저·멤버',
    items: [
      '초대코드 입장·가입 신청·대기/취소(정책별), 승인/거절, 차단, 매니저 지정, 강퇴',
      '초대 코드 조회·재발급(초대형), 방장 위임, 방 삭제(방장)',
      '방마다 표시 이름 변경(방장·레거시 방은 OAuth 전 제한)',
      '라이트/다크 테마',
    ],
  },
]

function FeatureGroupCard({ group, delay = 0 }: { group: FeatureGroup; delay?: number }) {
  return (
    <div className='card anim-in p-5' style={{ animationDelay: `${delay}ms` }}>
      <div className='text-[15px] font-semibold text-slate-900 dark:text-white'>{group.title}</div>
      <p className='mt-0.5 text-xs text-slate-500 dark:text-zinc-500'>{group.summary}</p>
      <ul className='mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-zinc-400'>
        {group.items.map((item) => (
          <li key={item} className='flex gap-2'>
            <span className='mt-2 h-1 w-1 shrink-0 rounded-full bg-[#5C87FF]' aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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

        <span className='chip chip-brand'>Firestore 실시간 · 방 공개 범위</span>
        <h1 className='mt-5 text-3xl font-semibold leading-[1.15] tracking-tight md:text-5xl'>
          업종별/주제별 <span className='text-brand-gradient'>오픈채팅</span>
        </h1>
        <p className='mt-5 max-w-xl text-[15px] leading-7 text-slate-600/90 dark:text-zinc-300/90'>
          방·메시지·참여 정보는 Firebase Firestore에 저장되며, 같은 방에 있는 브라우저와 기기에서 실시간으로 맞춰집니다.
          <span className='mt-2 block'>
            <strong className='font-medium text-slate-800 dark:text-zinc-200'>초대형</strong>은 초대 코드로만 입장하고,{' '}
            <strong className='font-medium text-slate-800 dark:text-zinc-200'>공개형</strong>은 누구나 목록에서 찾아 대화할 수 있으며,{' '}
            <strong className='font-medium text-slate-800 dark:text-zinc-200'>신청/승인형</strong>은 방장·매니저 승인 후 멤버만 대화 내용을 볼 수
            있습니다.
          </span>
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <Link to='/rooms' className='btn-primary'>
            채팅방 둘러보기
            <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M5 12h14M13 5l7 7-7 7' />
            </svg>
          </Link>
        </div>
      </section>

      <div>
          <h2 className='text-xl font-semibold tracking-tight text-slate-900 dark:text-white'>지금 쓸 수 있는 기능</h2>
      </div>
      <section className='grid gap-3 md:grid-cols-3'>
        <FeatureCard
          delay={40}
          icon={
            <svg viewBox='0 0 24 24' className='h-5 w-5' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
            </svg>
          }
          title='방 공개 범위'
          desc='초대형(코드 초대) · 공개형(누구나 참여·열람) · 신청/승인형(승인 멤버만). 정책에 따라 목록·대화·읽음 표시 범위가 달라집니다.'
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

      <section className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          {IMPLEMENTED_FEATURES.map((group, i) => (
            <FeatureGroupCard key={group.title} group={group} delay={160 + i * 40} />
          ))}
        </div>
      </section>
    </div>
  )
}
