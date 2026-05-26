# Scholar Shelf — Email Integration Investigation

**Date:** 2026-05-25  
**Auditor:** Claude (Cowork)  
**Scope:** Full audit of email infrastructure before implementation

---

## 10-Question Audit

### 1. Is the `resend` package installed?
**YES.** `resend@^6.12.4` is listed as a production dependency in `package.json`.

### 2. Is there already an email service file?
**YES.** `server/email.ts` already exists with basic Resend integration.  
It exports: `isResendConfigured`, `sendPasswordResetEmail`, `sendInviteEmail`.  
**Problems:** Uses old "EduBook" branding, `onboarding@resend.dev` fallback sender, missing 4 email functions.

### 3. Are invite emails currently sent or only logged?
**ATTEMPTED.** `POST /api/invites` (line 955 of routes.ts) calls `sendInviteEmail(email, role, inviteLink)` and falls back to a `console.log` if Resend is not configured or sending fails. The email is wired — it just needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set in Vercel.

### 4. Are password reset emails currently sent or only logged?
**ATTEMPTED.** `POST /api/auth/forgot-password` calls `sendPasswordResetEmail(email, resetLink)` with a `console.log` fallback. Also wired — needs env vars.

### 5. Are parent linking code emails sent?
**NO.** `POST /api/students/:id/linking-code` (line 643) creates the linking code and stores `parentEmail` in the DB, but **never sends an email to that address**. This is a gap that must be filled.

### 6. Are payment submission confirmation emails sent?
**NO.** `POST /api/parent/payments` (line 704) creates the payment record and returns it. No email is sent to the parent confirming receipt of their submission.

### 7. Are payment verified/rejected emails sent?
**NO.** `POST /api/admin/payments/:id/confirm` (line 782) and `POST /api/admin/payments/:id/reject` (line 792) update payment status but **do not notify the parent via email**.

### 8. What env var names does the current code use?
- `RESEND_API_KEY` — used in `server/email.ts` (existing)
- `RESEND_FROM_EMAIL` — used in `server/email.ts` (existing; defaults to `"EduBook <onboarding@resend.dev>"`)
- Both already exist as **empty** Vercel environment variables (confirmed in `.env.resend-production`)

### 9. What is the correct sender configuration?
- **From:** `Scholar Shelf <noreply@scholarshelf.co.uk>`
- **Domain:** `scholarshelf.co.uk` (DNS/Resend setup confirmed complete)
- **App URL:** Must be derived from `process.env.APP_URL` or `VERCEL_URL` (for building links in emails)

### 10. Are there any security concerns with the current implementation?
- ✅ Password reset tokens are **hashed** before storage; only the raw token is sent in the link
- ✅ Invite tokens are **hashed** before storage
- ✅ `sendPasswordResetEmail` uses anti-enumeration (always returns 200 OK)
- ⚠️ Linking code values are stored **plaintext** in the DB — acceptable as they're short-lived and single-use
- ⚠️ Invite link is returned in the API response only when `NODE_ENV !== "production"` ✅ good
- ✅ Payment routes use `requireRole("admin", "school_admin")` and school-scoped lookups

---

## Files to Change

| File | Change |
|------|--------|
| `server/email.ts` | Rebrand to Scholar Shelf, fix sender, add 4 missing email functions |
| `server/routes.ts` | Wire `sendParentCodeEmail` into linking-code route; wire payment emails into submit/confirm/reject routes |

## Env Vars Required in Vercel (already exist, need values)

| Var | Value |
|-----|-------|
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | `Scholar Shelf <noreply@scholarshelf.co.uk>` |
| `APP_URL` | `https://scholarshelf.co.uk` (or your Vercel deployment URL) |
