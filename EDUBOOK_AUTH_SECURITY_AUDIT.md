# EduBook Authentication Security Audit

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

**Date:** 2026-05-25
**Version:** Phase 1 — Production-Ready Authentication
**Auditor:** EduCore Architecture Team

---

## 1. Authentication Endpoints

| Endpoint | Method | Auth Required | Rate Limited | Zod Validated | Status |
|---|---|---|---|---|---|
| `/api/auth/sign-in` | POST | No | Yes (10/15min) | Yes | IMPLEMENTED |
| `/api/auth/sign-up-parent` | POST | No | Yes (5/1hr) | Yes | IMPLEMENTED |
| `/api/auth/sign-out` | POST | No | No | No | IMPLEMENTED |
| `/api/auth/accept-invite` | POST | No | No | Yes | IMPLEMENTED |
| `/api/auth/forgot-password` | POST | No | Yes (3/15min) | Yes | IMPLEMENTED |
| `/api/auth/reset-password` | POST | No | No | Yes | IMPLEMENTED |
| `/api/auth/me` | GET | Yes (session) | No | No | IMPLEMENTED |
| `/api/auth/login` (legacy) | POST | No | Forwarded | Forwarded | BACKWARD COMPAT |
| `/api/auth/logout` (legacy) | POST | No | Forwarded | Forwarded | BACKWARD COMPAT |

## 2. Password Security

- **Hashing:** bcrypt with cost factor 12 (new accounts/resets) or 10 (demo seed)
- **Minimum length:** 8 characters (enforced by Zod schema)
- **Maximum length:** 200 characters (enforced by Zod schema)
- **Storage:** `password_hash` column, never exposed in API responses
- **Demo accounts:** removed 2026-09-02 — the application ships with no built-in accounts.

## 3. Session Security

- **Store:** PostgreSQL via connect-pg-simple (server-side sessions)
- **Cookie flags:**
  - `httpOnly: true` — prevents JavaScript access
  - `secure: true` in production — HTTPS only
  - `sameSite: "lax"` — CSRF protection
  - `maxAge: 30 days`
- **Session regeneration:** On every successful login (prevents session fixation)
- **Session data:** userId, role, schoolId (minimal, server-side only)
- **Logout:** Session destroyed server-side + cookie cleared

## 4. Rate Limiting

- **Implementation:** In-memory Map with sliding window
- **Sign-in:** 10 attempts per IP per 15 minutes
- **Sign-up:** 5 attempts per IP per hour
- **Forgot password:** 3 attempts per IP per 15 minutes
- **Note:** In-memory limiter resets on server restart. For production clusters, replace with Redis-based limiter.

## 5. Account Status Controls

| Status | Can Login | Description |
|---|---|---|
| `active` | Yes | Normal active account |
| `invited` | No | Invite sent but not accepted |
| `disabled` | No | Administratively disabled |
| `locked` | No | Locked due to security concern |

- All non-active statuses return generic "Invalid username or password" (no enumeration)
- `/api/auth/me` destroys session if account becomes non-active

## 6. Invite System

- **Token format:** `{inviteId}.{randomToken}` where randomToken is 32 bytes hex
- **Token storage:** bcrypt hash of the random portion (not stored in plaintext)
- **Expiry:** 7 days for invites, 1 hour for password resets
- **States:** pending → accepted/expired/revoked
- **Parent exception:** Parents self-register (no invite required)
- **Admin only:** Only admin role can create invites
- **Duplicate prevention:** Checks for existing user email and pending invites

## 7. Password Reset

- **Anti-enumeration:** Always returns same success message regardless of email existence
- **Token:** Uses the invites table with special role `__password_reset__`
- **Expiry:** 1 hour
- **Single use:** Token marked as accepted after use
- **Dev mode:** Reset link logged to server console (email in production)

## 8. Input Validation

All auth endpoints use Zod schemas for strict input validation:
- `signInSchema` — username (1-100 chars), password (1-200 chars)
- `signUpParentSchema` — name (2-100), email (valid format, max 255), username (3-50, alphanumeric+.-_), password (8-200)
- `acceptInviteSchema` — token (required), name, username, password (same rules)
- `forgotPasswordSchema` — email (valid format)
- `resetPasswordSchema` — token (required), password (8-200)

## 9. Error Handling

- Generic error messages on all auth failures (no information leakage)
- Stack traces logged server-side only
- No password hashes or internal IDs in error responses
- `safeUser()` function strips sensitive fields from all user responses

## 10. Audit Logging

All auth-sensitive actions are logged to `audit_logs` table:
- `login_success` — successful sign-in
- `login_failed` — failed sign-in (with reason: user_not_found, invalid_password, account_disabled, etc.)
- `login_rate_limited` — rate limit triggered
- `parent_registered` — new parent self-registration
- `invite_created` — admin created invite
- `invite_accepted` — user accepted invite
- `password_reset_requested` — forgot password initiated
- `password_reset_completed` — password successfully reset
- `logout` — user signed out

Each log entry includes: userId, action, target, metadata (JSON), IP address, user agent, timestamp.

## 11. Role Architecture

| Role | Access Level | Registration |
|---|---|---|
| `owner` | Platform-wide | Invite only |
| `platform_admin` | Platform-wide | Invite only |
| `school_admin` | School-scoped | Invite only |
| `teacher` | Class-scoped | Invite only |
| `parent` | Child-scoped | Self-register |
| `finance` | School-scoped | Invite only |
| `it_personnel` | School-scoped | Invite only |
| `student` | Self-scoped | Invite only |

Legacy role "admin" maps to "school_admin" for backward compatibility.

## 12. Frontend Security

- Auth state managed via React Query (`/api/auth/me`)
- `AuthGuard` component enforces role-based route access
- All API calls use `credentials: "include"` for cookie transport
- No tokens stored in localStorage/sessionStorage
- Password fields use `type="password"` with toggle

## 13. Known Limitations (V1)

1. **Rate limiter is in-memory** — resets on restart, not cluster-safe
2. **Email delivery not implemented** — invite/reset links logged to console
3. **No CAPTCHA** — relies on rate limiting only
4. **No 2FA/MFA** — planned for V2
5. **No password complexity rules** — only minimum length enforced
6. **No account lockout after N failures** — rate limiting by IP instead
7. **Multi-tenancy isolation** — schoolId stored but not enforced in all queries yet

## 14. Recommendations for V2

1. Add Redis-based rate limiting for multi-server deployments
2. Implement email delivery (SendGrid/SES) for invites and password resets
3. Add TOTP-based 2FA for admin and finance roles
4. Implement CAPTCHA on public endpoints (sign-up, forgot-password)
5. Add password complexity scoring (zxcvbn)
6. Implement automatic account lockout after 5 failed attempts
7. Add CSRF tokens for non-cookie-based clients
8. Enforce schoolId tenant isolation in all data queries
9. Add session activity monitoring and forced logout
10. Implement refresh token rotation for mobile clients
