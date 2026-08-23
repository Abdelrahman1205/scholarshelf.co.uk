# ScholarShelf Programmer Handover Index

This is the primary navigation file for developers continuing build work and refactoring.

Use this file as the entry point. Keep implementation details inside their original files.

## 1) Quick Start

- Install dependencies: `npm install`
- Typecheck: `npm run check`
- Run backend dev server: `npm run dev`
- Build: `npm run build`

## 2) Core Runtime (Read First)

- [package.json](package.json)
- [server/index.ts](server/index.ts)
- [server/app.ts](server/app.ts)
- [server/routes.ts](server/routes.ts)
- [server/storage.ts](server/storage.ts)
- [shared/schema.ts](shared/schema.ts)

## 3) Frontend App Shell

- [client/src/main.tsx](client/src/main.tsx)
- [client/src/App.tsx](client/src/App.tsx)
- [client/src/components/layout.tsx](client/src/components/layout.tsx)
- [client/src/hooks/use-auth.ts](client/src/hooks/use-auth.ts)
- [client/src/lib/queryClient.ts](client/src/lib/queryClient.ts)

## 4) Role Dashboards (Largest Refactor Surface)

- [client/src/pages/admin.tsx](client/src/pages/admin.tsx)
- [client/src/pages/teacher.tsx](client/src/pages/teacher.tsx)
- [client/src/pages/parent.tsx](client/src/pages/parent.tsx)
- [client/src/pages/finance.tsx](client/src/pages/finance.tsx)

## 5) Build and Deployment

- [vite.config.ts](vite.config.ts)
- [tsconfig.json](tsconfig.json)
- [drizzle.config.ts](drizzle.config.ts)
- [script/build.ts](script/build.ts)
- [vercel.json](vercel.json)

## 6) Integrations and Services

- [server/email.ts](server/email.ts)
- [server/paymentIntegration.ts](server/paymentIntegration.ts)
- [utils/supabase/client.ts](utils/supabase/client.ts)
- [utils/supabase/server.ts](utils/supabase/server.ts)
- [utils/supabase/middleware.ts](utils/supabase/middleware.ts)

## 7) Tests and Safety

- [tests/security-regression.ts](tests/security-regression.ts)

## 8) Existing Technical Documentation

- [SCHOLARSHELF_PROGRAMMER_HANDOVER_MERGED.md](SCHOLARSHELF_PROGRAMMER_HANDOVER_MERGED.md)
- [EDUBOOK_REVIEW.md](EDUBOOK_REVIEW.md)
- [EDUBOOK_FULL_SYSTEM_REPORT.md](EDUBOOK_FULL_SYSTEM_REPORT.md)
- [WORKFLOW_COVERAGE_MATRIX.md](WORKFLOW_COVERAGE_MATRIX.md)

## 9) Refactor Order (Recommended)

1. Stabilize backend contracts in [server/routes.ts](server/routes.ts) and [server/storage.ts](server/storage.ts).
2. Extract shared domain/service layers from large route and page files.
3. Break [client/src/pages/admin.tsx](client/src/pages/admin.tsx) into feature modules.
4. Normalize API data-fetch patterns via [client/src/lib/queryClient.ts](client/src/lib/queryClient.ts).
5. Add or extend coverage in [tests/security-regression.ts](tests/security-regression.ts).

## 10) Ownership Notes

- Keep this file short and navigational.
- Add links here when new modules become critical.
- Do not duplicate large content from source docs into this index.
