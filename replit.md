# TutorMatch

A full-stack mobile tutoring marketplace where students post questions, tutors bid to answer them, sessions are scheduled, and students rate tutors after completion.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `JWT_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native, expo-router (file-based routing)
- API: Express 5 on port 8080, served at `/api` path via shared proxy
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (bcryptjs + jsonwebtoken), tokens stored in AsyncStorage on mobile
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/` — 7 DB schema files (users, tutor_profiles, questions, bids, sessions, reviews, notifications)
- `artifacts/api-server/src/routes/` — 10 route files (auth, users, tutor-profiles, questions, bids, sessions, reviews, notifications, dashboard, admin)
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware + requireRole
- `artifacts/mobile/app/` — Expo screens (role-based: student/tutor/admin)
- `artifacts/mobile/contexts/AuthContext.tsx` — auth state, token persistence
- `artifacts/mobile/constants/colors.ts` — design tokens (navy/indigo palette)

## Architecture decisions

- JWT-based auth (no third-party auth). Token stored in AsyncStorage, injected via `setAuthTokenGetter` from `@workspace/api-client-react`.
- Role-based navigation: students go to `/(student)` tabs, tutors to `/(tutor)`, admins to `/(admin)`.
- All detail screens (question, session, post-question, propose-time, notifications) are root-level Stack screens to hide the tab bar when navigating to details.
- All timestamps in Singapore Time (SGT, UTC+8). Display via `toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })`.
- Session time negotiation: student proposes → tutor accepts or counter-proposes → student confirms → status becomes Confirmed.
- All monetary values in SGD.

## Product

- **Students** post questions with subject, description, duration, and optional budget. Tutors bid. Students accept a bid, propose a session time, and rate the tutor after completion.
- **Tutors** browse open questions, submit bids with price and message, manage sessions (accept/counter time, add meeting link, mark completed), and maintain a profile with bio, education, subjects, and hourly rate.
- **Admins** view all users and can suspend/unsuspend accounts.
- Notifications are generated server-side for key events (new bid, bid accepted, session confirmed, etc.).

## User preferences

- All times in Singapore timezone (SGT)
- No third-party auth — JWT only
- No emojis in UI
- All monetary values in SGD

## Gotchas

- All mutations use `{ data: ... }` wrapping (Orval codegen convention). e.g. `createQuestion.mutateAsync({ data: { title, ... } })`
- Mutations with path params use `{ paramName, data: ... }`. e.g. `updateBid.mutateAsync({ bidId, data: { status } })`
- `setBaseUrl` must be called at module level (outside components) in AuthContext.tsx
- The API server bundles to `dist/index.mjs` via esbuild before running
- Do not call `pnpm dev` at workspace root — use workflow restart instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
