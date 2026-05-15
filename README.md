# nateon-openchat (web)

업종별/주제별 오픈채팅(제한 공개/초대형 포함)을 위한 웹 프론트엔드 프로젝트입니다.

## Tech

- React 19
- React Router 7 (SPA 모드)
- Vite 6
- TypeScript 5
- Tailwind CSS 4 (`@tailwindcss/vite`)

## Requirements

- Node.js 18+
- npm 10+

## Getting started

```bash
npm install
npm run dev
```

기본 포트는 `SERVER_PORT` 환경변수(없으면 8080)를 사용합니다.

## Env

- `SERVER_PORT`: dev/preview 포트 (기본 8080)
- `VITE_OAUTH_LOGIN_URL`: `oauth` 로그인 페이지 URL (예: 같은 도메인 환경의 `/social/login`)
- `VITE_ENABLE_MOCK_API`: 클라이언트 전용 Mock API(`/api/openchat/*`) 활성화 (기본 `true`). 실제 백엔드 연결 시 `false`.
- `VITE_USE_FIRESTORE`: `true`이면 Mock 대신 **Firestore**에 오픈채팅 데이터를 저장합니다. `VITE_FIREBASE_*`가 모두 설정되어 있어야 하며, Firebase 콘솔에서 Firestore를 켜고 `firestore.rules`를 배포해야 합니다. 이 모드에서는 `app/root.tsx`가 Mock fetch 인터셉터를 설치하지 않습니다.
- `VITE_FIREBASE_*`: Firebase Web `firebaseConfig` 6필드 (`.env.example` 참고). 모두 있으면 `app/firebase.ts`에서 `initializeApp` 실행. 비우면 초기화 생략.

Firestore를 쓸 때는 `rooms` 컬렉션(문서 필드: `title`, `policy`, `tags`, `ownerNickname`, `createdAt`, `managers`, `blocked`, 초대방이면 `inviteCode`, `inviteExpiresAt`)과 하위 `messages`, `memberRecords` 서브컬렉션이 생성됩니다. `listRooms`가 `orderBy('createdAt')`를 쓰므로, 콘솔 오류에 안내되면 링크로 **복합 인덱스**를 추가하세요.

**보안**: 현재 저장소 어댑터는 클라이언트에서만 권한을 검사합니다. `firestore.rules`의 기본안은 개발용(time-limited wide open)이며, 공개 배포 전에 규칙을 강화하고 Firebase Auth 등을 붙이세요.

## Scripts

- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 미리보기 서버 실행
- `npm run typecheck`: 타입 체크
- `npm run lint`: ESLint 실행 (추가 예정)
- `npm run deploy:hosting`: 빌드 후 Hosting만 배포 (`npx firebase deploy --only hosting`)
- `npm run deploy`: 빌드 후 **전체** Firebase 배포 (`npx firebase deploy`, 공식 문서와 동일)

### Firebase Hosting

**CLI**: `npm install -g firebase-tools` 또는 이 저장소에서 `npm install` 후 `npx firebase …` 사용.

웹 앱 **저장소 루트**(이 `README.md`가 있는 디렉터리)에서 진행합니다.

#### 1. Google 로그인

```bash
npx firebase login
```

(전역 CLI를 썼다면 `firebase login`.) 브라우저에서 Google 계정으로 로그인합니다.

#### 2. 프로젝트 시작 (`firebase init`)

이 저장소에는 이미 **`firebase.json`**(Hosting: `build/client`, SPA rewrite)과 **`.firebaserc`**(플레이스홀더 프로젝트 ID)가 있습니다.

| 목적 | 할 일 |
|------|--------|
| **호스팅만 배포** | `firebase init` **없이** `.firebaserc`의 `YOUR_FIREBASE_PROJECT_ID`를 콘솔 프로젝트 ID로 바꾸거나 `npx firebase use --add`로 프로젝트만 연결한 뒤 `npm run deploy:hosting` 또는 아래 **3. 웹 앱 배포** 참고 |
| **Firestore·Functions 등 추가** | `npx firebase init firestore` 등 **필요한 기능만** 실행. `firebase init hosting`을 돌리면 기존 `firebase.json` 덮어쓰기를 물을 수 있으므로 **기존 Hosting 설정을 유지하려면 덮어쓰기에 No** 하거나, Hosting 단계는 건너뜁니다. |
| **처음부터 전부 새로** | `npx firebase init` 후 안내에 따라 진행. Hosting 질문이 나오면 public 디렉터리는 **`build/client`**, SPA용 rewrite는 **예**로 두는 것이 이 앱과 동일합니다. |

`firebase init`은 대화형이라 이 환경에서는 대신 실행할 수 없습니다. 로컬 터미널에서 위 순서대로 실행하면 됩니다.

#### 3. 웹 앱 배포

1. **정적 파일 준비**  
   Firebase 기본 예시는 `public` 폴더이지만, 이 앱은 React Router 빌드 결과가 **`build/client`**에 생성됩니다. 먼저 빌드합니다.

   ```bash
   npm run build
   ```

2. **루트에서 배포**  
   앱 저장소 루트에서 공식 문서와 같이:

   ```bash
   npx firebase deploy
   ```

   Hosting만 올리려면 `npm run deploy:hosting` 또는 `npx firebase deploy --only hosting`을 써도 됩니다.

3. **배포 확인**  
   브라우저에서 `https://<프로젝트-ID>.web.app` (또는 콘솔에 안내된 URL)으로 접속합니다.  
   예: `.firebaserc`의 프로젝트 ID가 `nateon-openchat`이면 `https://nateon-openchat.web.app` 입니다.

한 번에 빌드+배포하려면 `npm run deploy`(전체) 또는 `npm run deploy:hosting`(Hosting만)을 사용할 수 있습니다.

`VITE_*` 값은 빌드 시 번들에 포함되므로, 배포용 `.env` 또는 CI 시크릿에 프로덕션 Firebase·API 변수를 맞춰 두세요.

#### 호스팅 후 화면이 비어 있을 때

1. **반드시 빌드 후 배포**: `build/client`에 `index.html`과 `assets/`가 없으면 빈 사이트가 됩니다. `npm run deploy` 또는 `npm run build` → `npx firebase deploy` 순서를 지켰는지 확인합니다.
2. **Firebase 콘솔**: [Hosting](https://console.firebase.google.com/) → 해당 프로젝트 → Hosting → 최신 릴리스에 파일이 올라갔는지 봅니다.
3. **브라우저 F12 → Network**: `index.html`은 200인데 `/assets/*.js`가 **404**면, 예전 `index.html`만 남고 에셋이 안 맞는 경우가 많습니다. 다시 `npm run build` 후 전체 배포하고, **강력 새로고침**(Ctrl+Shift+R)을 해 봅니다.
4. **Console**: 빨간 스크립트 오류가 있으면 메시지를 기준으로 수정합니다. (광고 차단기가 스크립트를 막는 경우도 있습니다.)

### Vercel (`*.vercel.app`)

프론트만 Vercel에 올리고 **Firestore 등 Firebase 백엔드는 그대로** 쓸 수 있습니다. 저장소 루트 **`vercel.json`**에 빌드·출력 디렉터리·SPA용 rewrite가 들어 있습니다.

#### 0. 저장소와 Vercel 연결 (GitLab)

- **gitlab.com** 저장소: [Vercel 대시보드](https://vercel.com/dashboard) → **Add New… → Project** → **Import Git Repository**에서 GitLab 계정을 연결한 뒤 저장소를 고릅니다.
- **사내 GitLab** (`gitlab.skcomms.co.kr` 등 Self-Managed): Vercel 플랜·설정에 따라 **Import 목록에 호스트가 안 나올 수 있습니다.** 그때는 아래 중 하나를 씁니다.
  - 조직에서 **GitLab Self-Managed ↔ Vercel 연동**을 이미 썼다면, 안내대로 OAuth/앱을 등록합니다. ([Vercel: Git providers](https://vercel.com/docs/deployments/git) 문서 참고)
  - **Vercel CLI**로 로컬 폴더를 프로젝트에 연결해 배포 (아래 **6. CLI**). Git 원격은 사내 GitLab 그대로 두고, 배포만 Vercel이 담당합니다.
  - 또는 **GitHub/GitLab.com 미러** 저장소를 두고, 그쪽만 Vercel에 연결합니다.

#### 1. 준비

- [Vercel](https://vercel.com) 계정 (GitHub/GitLab 로그인 가능).
- 로컬에서 **`npm install`** 후 **`npm run build`**가 끝까지 성공하는지 확인 (`build/client` 폴더 생성).

#### 2. 새 프로젝트 만들기 (대시보드)

1. **Add New… → Project**
2. 연결한 Git에서 **`frontend/openchat`** 저장소 선택 (또는 CLI로 연결).
3. **Project Name**: 원하는 이름 (URL에 쓰임: `프로젝트명.vercel.app`).
4. **Framework Preset**: `Other` 권장 (`vercel.json`의 `framework: null`과 맞춤). 자동으로 `Vite`가 잡혀도 되지만, 아래 **Output Directory**가 꼭 `build/client`인지 확인합니다.
5. **Root Directory**: `.` (저장소 루트)
6. **Build Command**: `npm run build`
7. **Output Directory**: `build/client`
8. **Install Command**: `npm install`
9. **Production Branch**: `main` (다른 브랜치를 쓰면 그에 맞게)
10. **Environment Variables** (아래 표). **Production**에 넣고, 필요하면 Preview/Development도 동일하게 복사합니다. **첫 Deploy 전에** 저장해야 빌드에 반영됩니다.
11. **Deploy** 클릭.

빌드 로그에서 `npm run build` 성공 후 `build/client`가 업로드되는지 확인합니다. 완료되면 **`https://<프로젝트명>.vercel.app`** 로 접속합니다. `vercel.json`의 `rewrites`로 `/rooms/...` 직접 주소·새로고침도 SPA로 동작합니다.

#### 3. 환경 변수 (`.env.example` 기준)

| 이름 | 설명 |
|------|------|
| `VITE_FIREBASE_API_KEY` ~ `VITE_FIREBASE_APP_ID` | Firestore 사용 시 6개 모두 프로덕션 값 |
| `VITE_USE_FIRESTORE` | `true` / `false` (Firestore 켤 때는 Firebase 6필드 필수) |
| `VITE_ENABLE_MOCK_API` | Mock API 사용 여부 (`false`면 동일 origin에 실 API 필요) |
| `VITE_OAUTH_LOGIN_URL` | OAuth 로그인 URL (배포 도메인 기준으로 절대 URL이 안전할 수 있음) |

`SERVER_PORT`는 Vercel 빌드에는 보통 필요 없습니다 (로컬 dev용).

변수 추가·수정 후에는 **Deployments → 해당 배포의 … → Redeploy** 하거나, 새 커밋을 푸시해 재빌드합니다.

#### 3-1. Vercel에서 **Firestore 모드**로 쓰기 (체크리스트)

대시보드 **Project → Settings → Environment Variables**에서 아래를 **Production**(필요하면 Preview도)에 넣고 **Save** 한 뒤, 반드시 **Deployments → … → Redeploy** 하세요. `VITE_*`는 빌드 시점에 번들에 박힙니다.

| 변수 | 값 |
|------|-----|
| `VITE_FIREBASE_API_KEY` | Firebase 콘솔 → 프로젝트 설정 → 일반 → 웹 앱의 `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `xxx.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | 프로젝트 ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `xxx.appspot.com` 등 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 숫자 문자열 |
| `VITE_FIREBASE_APP_ID` | `1:…:web:…` |
| `VITE_USE_FIRESTORE` | **`true`** |
| `VITE_ENABLE_MOCK_API` | **`false`** (Mock fetch를 끄고 Firestore SDK만 사용) |

**Firebase 콘솔 (같은 프로젝트)**

1. **Firestore Database** → 데이터베이스 만들기(없으면) → 위치 선택.
2. **규칙**: 저장소 루트 `firestore.rules` 내용을 콘솔 규칙 편집기에 붙여 넣거나, 로컬에서 `npx firebase deploy --only firestore:rules` 로 배포합니다. (`firebase.json`의 `firestore` 항목 사용.)
3. `orderBy('createdAt')` 등으로 **복합 인덱스**가 필요하면 브라우저 콘솔 오류의 링크를 따라 콘솔에서 인덱스를 추가합니다.
4. **Authentication → Settings → Authorized domains**에 `프로젝트명.vercel.app`(및 커스텀 도메인)을 추가합니다.

**배포 후**: 방 화면 상단의 **데모(Mock) localStorage** 안내는 Firestore가 실제로 켜진 빌드에서는 표시되지 않습니다. 여전히 보이면 변수 철자·`true`/`false` 문자열·Redeploy 여부를 다시 확인하세요. 값에 **앞뒤 공백**이 있어도 이제 허용됩니다. 배포 사이트에서 F12 → Console에 `window.__OPENCHAT_BACKEND__` 를 입력하면 `firestoreLive`, `firebaseConfigured`, 원시 env 문자열(비밀 아님)을 확인할 수 있습니다.

#### 4. 배포 후 확인

- 브라우저에서 홈·`/rooms`·방 상세 URL로 이동·새로고침.
- **F12 → Console / Network**에서 `/assets/*.js` 404나 빨간 오류 없는지 확인.

#### 5. Firebase·OAuth와 같이 쓸 때

- **Firestore / 규칙**: Vercel에서 Firestore 모드로 올릴 때는 위 **§3-1** 과 같이 환경 변수를 맞춘 뒤, 콘솔에서 규칙·인덱스·Authorized domains를 확인합니다.
- **Firebase Authentication**: 콘솔 → Authentication → Settings → **Authorized domains**에 `프로젝트명.vercel.app`, 커스텀 도메인, 필요 시 `*.vercel.app` 규칙을 추가합니다.
- **`VITE_OAUTH_LOGIN_URL`**: 실제 배포 URL과 IdP·백엔드의 **허용 redirect URI**가 맞는지 확인합니다.

#### 6. CLI만으로 연결·배포 (사내 GitLab용 우회)

저장소 루트에서:

```bash
npm i -g vercel
vercel login
cd /path/to/openchat
vercel link    # 팀·프로젝트 생성 또는 기존 프로젝트에 연결
vercel env pull   # 선택: 원격 환경변수를 .env.local에 받기
vercel --prod     # 프로덕션 배포 (또는 git push로 연동된 자동 배포)
```

`vercel link` 후 Git 연동을 끄고 CLI만 쓸 수도 있고, 나중에 대시보드에서 Git을 붙일 수도 있습니다. 팀 정책에 맞게 선택하면 됩니다.

## 클라이언트 전용 API (`/api/openchat/*`)

이 프로젝트는 백엔드 없이 “제품 단위로” 동작하는 것을 목표로 합니다. 서버를 띄우는 대신
**클라이언트 fetch 인터셉터**가 `/api/openchat/*` 요청을 가로채 in-memory + `localStorage`
기반 Mock 으로 응답합니다.

- 모든 모드에서 동일하게 동작합니다: `npm run dev` / `npm run build` / `npm run start`(=vite preview) / 정적 배포(Vercel, Netlify, S3 등) 모두 OK.
- 인터셉터는 `app/root.tsx` 에서 동기 import 로 설치되어, 첫 `clientLoader` 가 실행되기 전에
  반드시 부착되도록 보장합니다 (race condition 회피). `VITE_USE_FIRESTORE=true` 인 경우에는 설치하지 않습니다.
- 같은 origin 의 그 외 모든 요청은 원래 `window.fetch` 로 그대로 통과합니다.
- 데이터는 `localStorage` (`openchat.mockdb.v1`) 에 영속화되므로 새로고침 후에도 유지됩니다.
  초기화는 브라우저 devtools 에서 해당 키를 지우면 됩니다.
- 같은 브라우저의 여러 탭·창은 저장소를 공유하며, 다른 탭에서 채팅이 바뀌면 이 탭 목록도 갱신됩니다(브라우저 앱이 다르면 각자 저장소라 맞지 않습니다).

비활성화하려면 `.env` 에서 `VITE_ENABLE_MOCK_API=false` 로 설정하세요. 이 경우 동일 경로(`/api/openchat/*`)를
제공하는 실 백엔드를 동일 origin 또는 reverse-proxy 로 매핑해야 합니다.

### 왜 MSW 가 아닌 직접 fetch 인터셉터인가

- MSW(Mock Service Worker) 는 별도 service worker (`public/mockServiceWorker.js`) 가 필요하고,
  HTTPS 스코프/서브패스 배포에서 추가 설정이 필요합니다.
- 본 프로젝트는 API 계약이 `app/mocks/openchat-api-core.ts` 한곳에 모이고, 브라우저에서는 `installMockFetch()` 가 이를 감싼 형태입니다.
- 향후 일부 시나리오(WebSocket, push 알림 등)에서 service worker 가 필요해지면 MSW 로 전환하는 것은
  같은 핸들러 계약을 유지한 채 점진적으로 가능합니다 (인터셉터 → MSW handler 1:1 매핑).
