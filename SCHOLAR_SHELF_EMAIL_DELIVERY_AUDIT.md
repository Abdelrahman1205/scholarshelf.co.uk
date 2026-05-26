# Scholar Shelf — Email Delivery Audit

**Date:** 2026-05-25  
**Auditor:** Claude (Cowork)

---

## What Was Implemented

This document records every email trigger in Scholar Shelf, the route it fires from,
and how failures are handled.

---

## Email Triggers

| # | Event | Route | Email Function | Fallback |
|---|-------|-------|----------------|----------|
| 1 | Staff/admin invite created | `POST /api/invites` | `sendInviteEmail` | `console.log` invite link |
| 2 | Password reset requested | `POST /api/auth/forgot-password` | `sendPasswordResetEmail` | `console.log` reset link |
| 3 | Linking code generated for parent | `POST /api/students/:id/linking-code` | `sendParentCodeEmail` | `console.log` code + student name |
| 4 | Parent submits payment | `POST /api/parent/payments` | `sendPaymentSubmittedEmail` | `console.log` reference + amount |
| 5 | Admin confirms payment | `POST /api/admin/payments/:id/confirm` | `sendPaymentVerifiedEmail` | `console.log` reference |
| 6 | Admin rejects payment | `POST /api/admin/payments/:id/reject` | `sendPaymentRejectedEmail` | `console.log` reference |

---

## Email Function Catalogue (`server/email.ts`)

| Function | Subject line | Recipient |
|----------|-------------|-----------|
| `sendPasswordResetEmail(to, resetLink)` | "Reset your Scholar Shelf password" | The requesting user |
| `sendInviteEmail(to, role, inviteLink)` | "Your Scholar Shelf invitation" | Invitee |
| `sendParentCodeEmail(to, studentName, code, expiresAt)` | "Scholar Shelf: Linking code for {name}" | Parent |
| `sendPaymentSubmittedEmail(to, ref, amount, method)` | "Scholar Shelf: Payment submitted (Ref: …)" | Parent |
| `sendPaymentVerifiedEmail(to, ref, amount)` | "Scholar Shelf: Payment verified (Ref: …)" | Parent |
| `sendPaymentRejectedEmail(to, ref, amount)` | "Scholar Shelf: Payment could not be verified (Ref: …)" | Parent |

---

## Sender Configuration

| Env Var | Value |
|---------|-------|
| `RESEND_API_KEY` (or `EMAIL_API_KEY`) | Your Resend API key |
| `RESEND_FROM_EMAIL` (or `EMAIL_FROM`) | `Scholar Shelf <noreply@scholarshelf.co.uk>` |

Both env var aliases are supported in code for forward compatibility.

---

## Security Review

| Check | Status | Notes |
|-------|--------|-------|
| API key never logged | ✅ | Only used in Resend client constructor |
| Reset tokens hashed before DB storage | ✅ | `bcrypt.hash(rawToken, 10)` in routes.ts |
| Invite tokens hashed before DB storage | ✅ | `bcrypt.hash(rawToken, 10)` in routes.ts |
| Invite link omitted from production API response | ✅ | `NODE_ENV !== "production"` guard at line ~1005 |
| Anti-enumeration on forgot-password | ✅ | Always returns 200 OK regardless of email existence |
| Linking codes short-lived & single-use | ✅ | `expiresAt = now + 3 months`, `isUsed` flag in DB |
| Payment email only fires if `parentIdentifier` present | ✅ | `if (payment?.parentIdentifier)` guard |
| School-scoped tenant isolation on all payment routes | ✅ | `requireRole` + `sessionSchoolId` checks |
| Email errors caught and logged, never crash route | ✅ | All sends use try/catch + boolean return |

---

## Failure Handling

All email sends are **non-blocking** — if Resend is unavailable or the API key is
missing, the route still returns a successful HTTP response and the event is logged
to `console.log` so it can be recovered manually.

The `isResendConfigured()` helper is used throughout to emit a clear warning when
`RESEND_API_KEY` is absent rather than silently failing.

---

## Vercel Environment Variables Checklist

Before going live, set these in the Vercel dashboard
(Project → Settings → Environment Variables → Production):

- [ ] `RESEND_API_KEY` — obtain from resend.com/api-keys
- [ ] `RESEND_FROM_EMAIL` — set to `Scholar Shelf <noreply@scholarshelf.co.uk>`
- [ ] `SESSION_SECRET` — a long random string (e.g. `openssl rand -hex 32`)
- [ ] `DATABASE_URL` — copy from `storage_POSTGRES_URL` (already in Vercel storage)

---

## How to Test Each Email

1. **Invite** — log in as admin, go to Users → Invite, send invite to a real email  
2. **Password reset** — click "Forgot password" on the login page  
3. **Linking code** — admin generates a linking code for a student with a parent email set  
4. **Payment submitted** — log in as parent, generate basket, submit payment  
5. **Payment verified** — log in as admin, go to Payments, click Confirm  
6. **Payment rejected** — log in as admin, go to Payments, click Reject  
