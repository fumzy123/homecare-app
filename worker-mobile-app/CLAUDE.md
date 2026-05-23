# Worker Mobile App

React Native + Expo app for Home Support Workers (HSW). See full architecture plan at `../docs/plans/worker-mobile-app-architecture.md`.

---

## Stack

| Concern | Tool |
|---|---|
| Framework | React Native + Expo SDK 56 |
| Language | TypeScript (strict) |
| Routing | Expo Router v4 (file-based, `app/` dir) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Styling | NativeWind v4 (Tailwind in React Native) |
| Forms | TanStack Form v1 + Zod |
| Auth | Supabase (@supabase/supabase-js) |
| HTTP | Axios (`src/shared/lib/api-client.ts`) |
| Secure storage | expo-secure-store |
| Build | EAS Build + EAS Submit |

---

## Architecture

```
Screen (app/**/*.tsx)
  → hooks from src/features/X/hooks/
    → api.ts (TanStack Query wrappers)
      → src/shared/lib/api-client.ts (Axios + JWT refresh)
        → backend FastAPI
```

Shared design tokens match `admin-frontend/src/index.css` exactly.

---

## Commands

```bash
npx expo start          # dev server + QR code for Expo Go
npm run typecheck       # tsc --noEmit
npm run android         # Android emulator
npm run ios             # iOS simulator (Mac only)
```

---

## Feature Roadmap

- [x] **Phase 0**: Project scaffold, design system, NativeWind, shared components, Expo Router setup
- [ ] **Phase 1**: Authentication — sign in, JWT storage, Zustand auth store, protected routes
- [ ] **Phase 2**: Onboarding flow — 3-screen intro, stored "seen" flag, deep-link from invite email
- [ ] **Phase 3**: Home screen — today's shifts summary, next shift card, quick actions
- [ ] **Phase 4**: Schedule / shifts — calendar view, shift detail screen, ShiftCard component
- [ ] **Phase 5**: Profile overview — read own profile (`GET /api/me/profile`), credentials view
- [ ] **Phase 6**: Availability — weekly availability picker, `PATCH /api/me/availability`
- [ ] **Phase 7**: Visit verification — GPS check-in, distance check against client address
- [ ] **Phase 8**: Progress notes — note editor per shift occurrence, voice-to-text
- [ ] **Phase 9**: Digital flowsheet — per-client task checklist during shift
- [ ] **Phase 10**: Notifications — push notification setup, notification centre screen
- [ ] **Phase 11**: Compliance documents — upload docs to profile, view uploaded docs
- [ ] **Phase 12**: Leaderboard — attendance ranking among org workers
- [ ] **Phase 13**: Polish pass — animations, loading skeletons, empty states, error states
- [ ] **Phase 14**: EAS Build setup, TestFlight beta, internal testers
- [ ] **Phase 15**: App Store submission (iOS) + Play Store submission (Android)

---

## Key Files

| File | Purpose |
|---|---|
| `app/_layout.tsx` | Root layout — fonts, providers, auth listener |
| `app/index.tsx` | Redirect: session → tabs, no session → onboarding |
| `src/shared/lib/api-client.ts` | Axios instance + JWT auto-refresh |
| `src/shared/lib/auth-store.ts` | Zustand session store |
| `src/shared/lib/query-client.ts` | TanStack Query global config |
| `src/shared/components/ui/index.tsx` | Design system components |
| `tailwind.config.js` | NativeWind — same tokens as admin-frontend |

---

## Backend Endpoints Needed (Phase 5+)

Each needs its own branch in the backend:

| Endpoint | Phase | Purpose |
|---|---|---|
| `GET /api/me/profile` | 5 | Worker reads own profile |
| `PATCH /api/me/availability` | 6 | Worker updates own availability |
| `GET /api/me/shifts` | 4 | Worker sees own shifts |
| `POST /api/me/shifts/{id}/check-in` | 7 | GPS check-in |
| `GET /api/me/notifications` | 10 | Notification history |
| `GET /api/leaderboard` | 12 | Org attendance ranking |
