import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  // 전역 복구 UI: `app/root.tsx`, `app/layouts/main-layout.tsx`, `routes/pages/rooms/room-detail.tsx` 의 ErrorBoundary
  layout('./layouts/main-layout.tsx', [
    index('routes/pages/home/index.tsx'),
    route('rooms', 'routes/pages/rooms/index.tsx'),
    route('rooms/new', 'routes/pages/rooms/new.tsx'),
    route('rooms/:roomId', 'routes/pages/rooms/room-detail.tsx'),
  ]),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig

