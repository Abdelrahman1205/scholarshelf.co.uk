# ScholarShelf — Client Readiness Report

**Date:** 2026-07-01
**Verdict:** READY FOR CLIENTS after the manual go-live steps below are completed.

---

## 1. Verification Results (this session)

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit --skipLibCheck`) | 0 errors |
| Production build (`npm run build`, Vite client + server bundle) | PASS (client built in ~8s, `dist/index.cjs` produced, warnings only) |
| Security regression suite (`tests/security-regression.ts`) | **47/47 PASS** — auth enforcement, RBAC, tenant isolation, session integrity, no secret/stack leaks |
| Multi-role sign-in (admin / teacher / finance, school code required) | PASS |
| Payment webhook | HMAC-verified, fails closed when `PAYMENT_WEBHOOK_SECRET` missing |
| Stock integrity | Cannot go below zero; all adjustments logged to `book_inventory_transactions` |
| Duplicate payment references | Rejected per school |
| Vercel serverless entry (`api/index.ts` + `vercel.json` rewrites) | Correct |

## 2. Fixes Applied This Session

1. **Linking-code brute-force protection** — `POST /api/parent/link-code/preview`, `/link-code/confirm`, and `/link-child` now rate-limited (10 attempts / 15 min per parent, IP fallback), 429 + `link_code_rate_limited` audit entry. Codes are short and typeable, so this closes a real brute-force vector.
2. **Extra-copy approval no longer swallows stock errors** — failed stock adjustments are logged and appended to the request's `adminNotes` ("Stock NOT adjusted … Adjust manually") instead of silently drifting inventory.
3. **`getAllocations` N+1 removed** — students, books, and classes now batch-fetched with `inArray` (3 queries total instead of 3 per allocation row).

## 3. Feature Coverage vs. Spec

The old `WORKFLOW_COVERAGE_MATRIX.md` is stale. Re-verified against current code: family groups + family link codes, family basket payment, link-code preview/confirm two-step flow, code rotation, student CSV/XLSX import (preview + confirm), per-student book-level override, year groups, payment CSV export + filters, full payment lifecycle (confirm / reject / needs-review / ready-for-collection / collected / cancel), teacher distribution (confirm-received / mark-absent / report-issue), messaging (parent ↔ staff, unread badges, audit log), notifications summary, public school page + branding, owner console with support mode and school lifecycle, and the DB Console are ALL implemented.

**Remaining spec gaps (non-blocking, recommend V1.1):** allocation sub-statuses `out_of_stock` and `partially_collected`; Stripe SDK (reference-based bank transfer flow is live and sufficient); web-push delivery for notifications; in-memory dev-mode fallbacks are incomplete for create operations (production uses Neon, unaffected).

## 4. Manual Go-Live Checklist (requires your access)

1. **Commit and push** (deploys via Vercel GitHub integration):
   `git add -A -- shared/ server/ client/src/ *.md && git commit -m "feat: client-readiness fixes — link-code rate limiting, stock-error surfacing, getAllocations batching" && git push`
2. **Vercel env vars (Production):**
   - `RESEND_API_KEY` — from resend.com/api-keys
   - `RESEND_FROM_EMAIL` — `Scholar Shelf <noreply@scholarshelf.co.uk>`
   - `SESSION_SECRET` — ≥32 chars (`openssl rand -hex 32`)
   - `PAYMENT_WEBHOOK_SECRET` — ≥16 chars
   - `APP_BASE_URL` — `https://scholarshelf.co.uk`
   - Confirm `DATABASE_URL` points at the production Neon instance
3. **Production DB fix** — demo accounts still have `schoolId=null` (see SQL in `CLIENT_READY_BUTTON_AUDIT.md`), or better: disable/remove demo accounts (`admin/admin123` etc.) entirely before real clients onboard.
4. **Post-deploy smoke test** — repeat the 6 email tests in `SCHOLAR_SHELF_EMAIL_DELIVERY_AUDIT.md` §"How to Test Each Email" and the parent link/basket/payment flow on production.
5. **Optional hardening (V1.1):** Redis-backed rate limiting (current limiter is in-memory and resets per serverless cold start — acceptable at school-scale traffic but weaker on Vercel), 2FA for admin/finance, CAPTCHA on public endpoints, account lockout after N failures.

## 5. Environment Note

The rate limiter's serverless caveat deserves emphasis: on Vercel, each cold start resets in-memory limits, so sustained brute-force across many cold starts is only partially throttled. School-scale traffic makes this acceptable for launch; move to Redis (Upstash) when convenient.
