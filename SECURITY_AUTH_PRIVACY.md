# SECURITY_AUTH_PRIVACY.md — Stage 16: Security, Authentication, Authorisation & Privacy

```
STAGE 16 — SECURITY, AUTHENTICATION, AUTHORISATION & PRIVACY
STATUS: LOCKED
Written: 30 August 2026
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
STATUS AT LOCK: owner decisions applied — SECQ-1 = B · SECQ-2 = A
Open owner questions: 0
New conflicts: C-80 … C-90  (eleven, each verified directly in the current tree)
Existing conflicts given a target: C-18 · C-21 · C-29 · C-41 · C-60 · C-63 · C-67 · C-68 · C-70 ·
                                   C-71 · C-73 · C-79   — none closed
Traceable amendment raised against a locked stage: A15-001 (DATABASE_SCHEMA.md) — §49
```

**Owner decisions, applied in full:**

```
SECQ-1 = B    AUTH-FAMILY session: 7 days absolute · 7 days idle
              sensitive actions require re-authentication                    §8.2 · SEC-D088

SECQ-2 = A    MFA mandatory when AUTH-SCHOOL or AUTH-FINANCE is exercised
              AUTHORITY-based, never legacy-role-based                       §12.4 · SEC-D087

              SECQ-2 = A DOES NOT CLOSE C-21.
              C-21 = TARGET POLICY RESOLVED · IMPLEMENTATION OPEN
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` · `SYSTEM_ARCHITECTURE.md` · `CODEBASE_ARCHITECTURE.md` ·
`API_CONTRACT.md` · `DATABASE_SCHEMA.md` — **Stages 1–15, all LOCKED.**

**Security evidence, read directly on 30 August 2026** — `server/app.ts` (323 lines) in full,
`server/middleware/auth.ts` (1,108 lines), `server/middleware/test-superuser.ts`, `server/mfa.ts`
(127 lines) in full, `server/config/env.ts` in full, `server/routes/auth.routes.ts` (538 lines),
`server/routes/mfa.routes.ts`, `server/routes/db-console.routes.ts`, `server/routes/public.routes.ts`,
`server/routes/message.routes.ts`, `server/routes/cron.routes.ts`, `server/paymentIntegration.ts`,
`server/branding.ts`, the `users` table declaration in `shared/schema.ts`, and every raw
`process.env` reference in `server/`. **Middleware ordering, cookie flags, header directives, hash
costs, rate-limit keys and windows, signature computation and constant-time comparisons were read —
not inferred from file names or from comments.**

**Where a source comment claims a control, this document states whether the code delivers it.** Several
comments in this codebase are accurate and careful. Three are not, and all three are recorded — and so
is one place where **this document's own proposed draft made the same mistake** (§2.2, SEC-F21).

**A second evidence pass was run before locking**, covering `mfa.routes.ts` in full (220 lines), the
recovery-code consumption path, the MFA enrolment endpoints, `storage.updateUser`,
`storage.markInviteAccepted`, and every `getTxDb()` / `.transaction(` site in `server/`. **It produced
four further conflicts and corrected one claim this document had previously asserted.**

---

## 1. Purpose and boundary

Stage 16 states the **target security, authentication, authorisation and privacy model**: how a person
proves who they are, how the server decides what they may do, how tenant data is kept apart when a
control fails, what is protected in transit and at rest, what is written down and what must never be,
and how a person's data is handled under UK data-protection obligations.

It is the security backstop to a chain that is already locked: **Stage 7** defined the capability
model, **Stage 12** made the server the authority boundary, **Stage 13** put the decision in one place
in the code, **Stage 14** fixed the transport contract, and **Stage 15** put row-level security and
tenant-aware keys in the database. **Stage 16 does not invent a new authority model. It states how the
locked one is defended when something goes wrong.**

### 1.1 What Stage 16 decides

| Decides | Does not decide |
|---|---|
| credential storage, hashing and rotation | the retention period for any record — **Stage 18** |
| session mechanics, lifetime and revocation | audit record mechanics and schema — **Stage 19** |
| MFA algorithm, storage, enrolment, replay defence | performance tuning of any control — **Stage 20** |
| how a capability decision is reached at runtime | deployment, secrets delivery, WAF — **Stage 21** |
| CSRF, CORS, headers, CSP | the implementation itself — **Stage 22 onward** |
| upload trust states and object access | which provider is bought — commercial |
| logging prohibitions and error disclosure | whether the product is lawful — **BytHub Legal** |
| the personal-data map and DSAR mechanics | the lawful basis — **BytHub Legal** |

### 1.2 Nothing was executed

Per the standing instruction, **no code was written, no repository file was modified, no dependency was
installed, no password was rehashed, no session cookie was changed, no MFA table was created, no
production secret was encrypted or rotated, no RLS policy was created in Neon, no database role was
modified, no CORS, CSRF, rate-limit or header configuration was changed, no scanning was added, no
upload or CMS rendering path was touched, no provider callback was altered, no DSAR or erasure was
performed, no production data was edited, no provider was selected and nothing was deployed.**

Every file named above was **opened and read**. That is the whole of the interaction with the
repository.

### 1.3 The release boundary is unchanged

**Stage 16 approval is not production security clearance and is not legal sign-off.** This document
designs a target. Whether the built system meets it is decided by a security re-audit; whether the
product may process real children's data is decided by BytHub's legal review.

**The BytHub Legal & Compliance deployment halt and production go-live block of 23 August 2026 —
17 Critical, 52 High, across 14 domains, 0% compliance clearance — stands in full.** Nothing in this
document clears any part of it, and no compliance claim is made anywhere in it. Where this document
describes a GDPR or UK GDPR obligation, it records that the obligation is asserted by the audit or by
the regulation's plain text; **it does not adopt a finding of law.**

**The baseline remains UNVERIFIED.** The owner's native Windows test runs (`npm run check`,
`test:smoke`, `build`, `test:custody`, `npm test`) are still outstanding, so all evidence in this
document is capped at **E2 — read directly, not executed.**

---

## 2. Current security baseline — read, not assumed

This section records what the current system actually does. **It is deliberately even-handed: several
controls here are well built, and saying so is part of an honest baseline.** A stage that reported only
defects would be as untrustworthy as one that reported none.

### 2.1 Controls that are present and correct

| Control | Evidence | Assessment |
|---|---|---|
| session regeneration on login | `auth.routes.ts` — `req.session.regenerate()` on both the direct and post-MFA paths | **correct.** Session fixation is closed |
| cookie flags | `app.ts` — `httpOnly: true`, `secure: IS_PRODUCTION`, `sameSite: "strict"` | **correct** |
| `trust proxy` in production | `app.ts` — `app.set("trust proxy", 1)` | **correct** for Vercel; secure cookies survive the edge |
| session secret assertion | `app.ts` — throws in production below 32 characters | **correct.** Fails at startup, not mid-request |
| two-dimension login limiting | per-account 5 / 15 min **and** per-IP 50 / 15 min | **well judged** — the comment explaining why the per-IP cap is deliberately generous for a school behind one public IP is correct reasoning |
| counter reset on success | `clearRateLimit(accountKey)` after a correct password | **correct.** The counter accumulates failures only |
| MFA as partial auth | `pendingMfa` marker; `req.session.userId` stays unset until the second factor passes | **correct.** The marker grants nothing |
| enumeration resistance on reset | `/api/auth/forgot-password` returns the same body on every path, including parse failure and rate limit | **correct** |
| upload content verification | `branding.ts` — magic-byte detection, SVG excluded by design | **correct**, and the SVG exclusion is the right call |
| cron authentication | `cron.routes.ts` — bearer or header, `timingSafeEquals`, fails closed on a missing secret | **correct** |
| webhook fails closed | `paymentIntegration.ts` — no secret means reject, never accept | **correct** |
| 5xx disclosure | `app.ts` — correlation id returned, detail logged, `err.message` withheld | **correct**, and the comment explaining why PostgreSQL errors must not reach a client is right |
| console tiering | `db-console.routes.ts` — read-only enforced by a PostgreSQL role and `BEGIN READ ONLY`, not by regex | **the strongest control in the codebase.** The reasoning that you cannot win a regex war against a query language is correct, and the five independent controls are genuinely independent |
| console break-glass | fresh TOTP + a 20-character written reason + 15-minute expiry + notification to other owners | **correct design** |
| test-account ordering | the flag is read from the database, never from the request; the simulated context is written only after that read | **correct** — the security model is the ordering, as the comment says |

**Fourteen controls are present and correct.** Any account of this system that omits them is not
accurate.

### 2.2 Findings — each read directly

Each finding below names its file, what the code does, and what follows. **Nothing here is inferred
from a comment.**

**SEC-F01 · The password-reset link, with its raw token, is written to the log when email delivery
fails.** `auth.routes.ts` — `if (!sent) { console.log("[PASSWORD RESET] Link for ${email}:
${resetLink}") }`, not gated on `NODE_ENV`. On the deployment target these logs are the platform's log
store. **Anyone with log access holds an account-takeover primitive for any account whose reset email
bounced.** This is **C-18**, already recorded by BR-124 — **not a new conflict**, and Stage 16 states
its target rather than renumbering it.

**SEC-F02 · The payment webhook verifies a signature over a body it re-serialised itself.**
`message.routes.ts` — `const rawBody = JSON.stringify(req.body)`. `app.ts` captures the true bytes as
`req.rawBody` in the `express.json` verify hook, and **the webhook does not use them.** Key order,
whitespace, unicode escaping and number formatting all differ between a sender's bytes and Node's
`JSON.stringify`. **The endpoint is not verifying what it received.** → **C-80**.

**SEC-F03 · The payment webhook has no replay defence.** No timestamp is checked, no nonce is stored, no
provider event identifier is recorded. A single captured valid request can be replayed indefinitely.
→ **C-81**.

**SEC-F04 · The payment webhook confirms money with no tenant scope.** `updatePaymentByReference` resolves
a reference **globally**, and the handler's own comment states *"Webhook is trusted (signature verified)
— no schoolId filter needed."* Signature verification proves the sender; it proves nothing about which
tenant the reference belongs to. **This resolves C-41's open question**, which recorded that tenant
binding *"was not confirmed"* — it is now confirmed absent. **C-41 stays OPEN with its own identifier;
Stage 16 supplies the missing evidence, not a new number.**

**SEC-F05 · TOTP codes are never consumed.** `mfa.ts` `verifyTOTP` accepts any code inside a ±1 step
window and records nothing; the `users` table has no last-used-counter column. **A code observed once
stays valid for up to ninety seconds and can be used more than once.** This is part of **C-21**, which
already records *"no TOTP replay protection"* — **not a new conflict**.

**SEC-F06 · MFA secrets are stored in plaintext.** `users.mfaSecret text`. Also part of **C-21**. Anyone
holding a database read — including a support projection that forgets to exclude the column — holds
every platform owner's second factor. The console's read views do exclude it, which is why that
exclusion is listed as a correct control above; **the column itself is still plaintext.**

**SEC-F07 · Security-critical configuration bypasses the validated environment module.** `env.ts` states
its own rule: *"Import `env` instead of `process.env.*` throughout the server."* Nine variables are
read from raw `process.env` and are **absent from the Zod schema** — including **`ALLOW_TEST_SUPERUSER`**
(which grants an account every role the platform defines) and **`CRON_SECRET`** (which authenticates
the scheduler). **The one switch that most needs validation is the one that has none.** → **C-82**.

**SEC-F08 · The production Content-Security-Policy permits `'unsafe-inline'` in `script-src`.** `app.ts` —
`scriptSrc: IS_PRODUCTION ? ["'self'", "'unsafe-inline'"] : [...]`. The adjacent comment correctly
states that `'unsafe-eval'` *"must NOT be present in production, where it materially weakens XSS
defence"* — and `'unsafe-inline'` weakens it in the same way, for the same reason, on the same line.
**The control is careful about one directive value and not the other.** → **C-83**.

**SEC-F09 · The public base URL for password-reset links can come from a request header.**
`getPublicBaseUrl` falls back to `x-forwarded-host` when neither `APP_BASE_URL` nor `PUBLIC_APP_URL` is
set, and `APP_BASE_URL` is `.optional()` in the env schema — **so nothing requires it in production.**
A reset link is a bearer credential; its host must not be attacker-influenceable. → **C-84**.

**SEC-F10 · A password reset does not invalidate the account's existing sessions.** `reset-password`
updates the hash and marks the invite accepted. Nothing destroys other sessions. **The reason people
reset a password is that someone else may have it — and after the reset, that person is still signed
in.** → **C-85**.

**SEC-F11 · The rate-limit table is created by application DDL at request time.**
`auth.middleware`'s `ensureRateLimitTable()` runs `CREATE TABLE IF NOT EXISTS rate_limits`. `app.ts`
records at length that startup DDL was removed for good reasons — *"ALTER TABLE takes an ACCESS
EXCLUSIVE lock"*, *"a column that failed to add did not stop startup"*. **One instance of the pattern
the codebase deliberately removed is still live, in the security layer.** → **C-86**.

**SEC-F12 · The rate limiter fails open, in two places.** The global write limiter wraps its whole check
in `try { … } catch { /* never block traffic on limiter failure */ }`, and `rateLimit()` returns the
in-memory result when the database check throws. On serverless, the in-memory Map is empty on every
cold start. **Under the conditions that make limiting matter most — load, or a struggling database —
the limit approaches nothing.** This is a deliberate availability trade-off, stated in the comment;
Stage 16 records it as a decision to revisit (**SEC-D031**), not as a hidden defect.

**SEC-F13 · Authority is cached in the session.** `activeContext`, `role`, `schoolId`, `mfaEnabled` and
`testSuperuser` are stamped at login and refreshed only when a context-changing path runs. This is
**C-67**, already recorded — Stage 16 states its target.

**SEC-F14 · `/uploads` is publicly mounted.** `app.use("/uploads", express.static(...))`, before any
authorisation. This is **C-68**, already recorded.

**SEC-F15 · Several handlers return `e.message` on a 500.** The global handler is correct; individual
routes bypass it by catching and replying themselves — `message.routes.ts` and `mfa.routes.ts` both do.
This is **C-70**, already recorded.

**SEC-F16 · Public endpoints are unlimited.** The global limiter applies only to write methods, and the
public school and website endpoints are `GET`. School codes can be enumerated at any rate. Recorded as
a target requirement (**SECAR-024**), not as a conflict, because no control is being contradicted —
one is simply absent.

**SEC-F17 · Recovery-code single-use is asserted by a comment and enforced by nothing.**
`mfa.routes.ts` consumes a code by reading `user.mfaRecoveryCodes`, filtering the matched hash out in
JavaScript, and writing the remaining array back — **a read-modify-write on a JSON text column, with no
transaction, no conditional predicate and no version guard**, on the `getDb()` handle. Two consequences,
both real: two concurrent verifications with *different* valid codes each write a nine-element array
computed from the same ten-element read, so **the loser's code is resurrected**; and the same code
presented twice concurrently matches in both requests before either write lands, so **one code
authenticates two sessions**. The source comment on the line reads `// single-use`. → **C-87**.

**SEC-F18 · The enrolment TOTP secret is written into the session store.**
`/api/auth/mfa/setup` does `req.session.pendingMfaSetupSecret = secret`, and the session store is
`connect-pg-simple` writing `user_sessions.sess`. **The secret therefore sits in plaintext in a second
database location**, distinct from `users.mfa_secret`, and **nothing clears it if enrolment is
abandoned** — it survives until the session expires, which under the *current* configuration is up to
30 days for a guardian and 8 hours for an administrator. It is also outside every control built to
protect the first location: the console's read views exclude `mfa_secret`, and they do not exclude
`sess`. → **C-88**.

**SEC-F19 · The password-reset credential write is not atomic.**
`reset-password` performs `storage.updateUser(user.id, { passwordHash })` and then
`storage.markInviteAccepted(invite.id)` as **two independent auto-committing statements**, both on
`getDb()`. There are exactly four `.transaction(` sites in `server/` — family enrolment, the import
service and two in `storage.ts` — and **none of them is a credential path**. If the second write fails,
the password has changed and **the reset token is still `pending`, so the link remains redeemable**.
A leaked reset link therefore stays live after it has been used. → **C-89**.

**SEC-F20 · A credential write can silently fall back to process memory and still report success.**
Both `storage.updateUser` and `storage.markInviteAccepted` catch `isDbUnavailableError(e)` and write to
an in-process `Map` instead. **A password reset during a database outage returns "Password has been
reset successfully" and durably changes nothing.** This is **C-71** — *two persistence semantics can run
the same product* — already carried; Stage 16 records the credential-path consequence, which is the most
severe instance of it, and **does not issue a new identifier**.

**SEC-F21 · MFA enrolment requires no re-authentication — and this document previously said it did.**
`/mfa/setup` and `/mfa/enable` perform **no password check**; `/mfa/disable` and `/mfa/recovery-codes`
do. The proposed draft of this document stated that enrolment *"requires the current password, which the
current code already does"* — **that claim was wrong**, generalised from two endpoints to four, and it
is corrected at §12.5 rather than quietly edited out. The consequence: a hijacked session can enrol the
attacker's own authenticator, and on a platform-owner account `/mfa/disable` then refuses self-service
removal, **locking the legitimate owner out by a control built to protect them**. → **C-90**.

### 2.3 The honest summary of the baseline

```
Fourteen controls correct, several of them well argued.
Seven defects already carried as conflicts   C-18 · C-21 · C-41 · C-67 · C-68 · C-70 · C-71
Eleven defects newly found and verified      C-80 … C-90
One deliberate availability trade-off        SEC-F12
One absence, not a contradiction             SEC-F16
One claim this document itself got wrong     SEC-F21 — corrected, not removed
```

**Four of the eleven were found only on the second evidence pass** (SEC-F17 … SEC-F20), and three of
those four sit in the credential path — recovery codes, the enrolment secret, and the reset write.
**The first pass read the login and the reset request; it did not read the enrolment and consumption
paths line by line.** That is worth recording as a fact about how the finding count was reached, not
smoothed over.

**This is not a system with no security. It is a system whose strongest controls sit beside a small
number of primitives that undo them.** A plaintext MFA secret defeats a well-built break-glass flow; a
reset link in a log defeats a well-built login limiter. **The target is not more controls. It is
removing the primitives that make the existing ones bypassable.**

---

## 3. Security principles

**SEC-P1 — The server decides. Every time, from stored state.** Stage 12 SA-P2 restated as a security
rule: no decision is ever made from a value the client supplied, and no decision is ever cached past
the point where the underlying fact could have changed.

**SEC-P2 — A session proves continuity, not permission.** Stage 12 SA-P3. A session says *this is still
the same person*. What that person may do **now** is resolved now.

**SEC-P3 — Defence in depth is only depth if the layers are independent.** Two controls that fail for
the same reason are one control. Tenant isolation therefore has an application layer **and** a database
layer that does not depend on the application being correct.

**SEC-P4 — Fail closed on authority; fail open only on availability, and only where stated.** A control
that cannot reach its store must refuse access. A *limiter* that cannot reach its store may be
permitted to allow traffic — but only where the document says so, and only where allowing is not
granting authority.

**SEC-P5 — A credential is never written down in plaintext anywhere it can be read.** Not in a
database column, not in a log line, not in an error body, not in a support projection, not in an audit
record, not in a URL that a proxy or a browser history will keep.

**SEC-P6 — What proves identity and what grants authority are separate.** A password proves a person.
An authority grant says what they may do. Neither is stored inside the other, and revoking one does not
require rewriting the other.

**SEC-P7 — A second factor that can be replayed is one factor with extra steps.** Any one-time value is
consumed on use.

**SEC-P8 — Configuration that changes who may do what is validated at startup or the application does
not start.** A privilege switch read from an unvalidated string is not a control.

**SEC-P9 — Verify the bytes you received, not a reconstruction of them.** Any signature, hash or
comparison is computed over the exact input as it arrived.

**SEC-P10 — Every externally initiated state change is idempotent and replay-resistant.** Proving who
sent a message is not the same as proving it should be acted on twice.

**SEC-P11 — Losing a credential invalidates everything that credential established.** Changing a
password, disabling MFA or removing an authority takes effect on existing sessions, not only on new
ones.

**SEC-P12 — Personal data is minimised at the point of collection, not at the point of disclosure.** A
field that is never stored cannot be leaked, subpoenaed, breached or asked for under a DSAR.

**SEC-P13 — Children's data receives the strictest handling in the system, by default and without a
setting.** Every default is the protective one; no configuration makes a child's record more exposed.

**SEC-P14 — A log is a security record, and what may not be logged is stated positively.** Not "be
careful with logs" but an explicit prohibited-content list that a reviewer can check a line against.

**SEC-P15 — An error tells the caller what they may do about it and nothing about the system.**

**SEC-P16 — Platform access to a tenant is named, bounded, time-limited and visible to that tenant.**
Support is not a quiet capability.

**SEC-P17 — A security control that cannot be tested is a claim.** Every control in this document names
how it is verified.

**SEC-P18 — No control's correctness depends on every future caller remembering it.** Stage 12 SA-P6
generalised: where a control can be structural, it is structural.

**SEC-P19 — The absence of an attack is not evidence of a control.** Baseline claims cite code, not the
absence of incidents.

**SEC-P20 — Security decisions are recorded with their trade-off.** Where a decision costs
availability, usability or effort, the cost is written down beside it, so a later reader can re-open it
on evidence rather than guess why it was made.
---

## 4. The trust boundary model

**SD-1 · Where trust changes**

```
  UNTRUSTED                        │ BOUNDARY │              TRUSTED
─────────────────────────────────────────────────────────────────────────────
  browser · SPA state              │          │  Express request handler
  request body · query · headers   │  Zod +   │  resolved person
  cookies presented                │  session │  resolved active context
  x-forwarded-* headers            │  lookup  │  resolved authorities
                                   │          │  resolved capability answer
─────────────────────────────────────────────────────────────────────────────
  provider callback body           │  HMAC    │  a signed provider event
  provider callback headers        │  over    │  (still not a business fact
                                   │  RAW     │   until it is bound to a
                                   │  BYTES   │   tenant and de-duplicated)
─────────────────────────────────────────────────────────────────────────────
  application query text           │   RLS    │  rows this tenant may see
  application tenant argument      │ + SET    │  (the database does not trust
                                   │  LOCAL   │   the application's predicate)
─────────────────────────────────────────────────────────────────────────────
  uploaded bytes                   │  magic   │  a typed, size-bounded object
  declared content type            │  bytes + │  in the 'verified' trust state
  declared filename                │  scan    │
```

**SEC-D001 · There are four trust boundaries, and each is crossed by one mechanism**

| Boundary | Mechanism | Never |
|---|---|---|
| client → server | schema validation, then session lookup, then capability resolution | never a client-asserted role, tenant, identity or permission |
| provider → server | HMAC over the **raw received bytes**, then tenant binding, then de-duplication | never "signature verified, therefore act" |
| application → database | `SET LOCAL` inside a transaction, then RLS | never "the application filtered it, so the database need not" |
| upload → object store | declared type discarded, bytes typed, then scanned, then published | never trust a filename or a `Content-Type` |

**SEC-P3 in practice: the third boundary exists precisely because the first two can be got wrong.**
Stage 15's Option B+ is a security control, not a data-modelling preference.

**SECAR-001 · No request-supplied header influences an authority decision, a credential, or a URL that
becomes a credential.** `x-forwarded-for` is already handled correctly (`clientIp` prefers the
proxy-resolved value with a comment explaining that the leftmost entry is client-controlled).
`x-forwarded-host` is **not** — see §14 and **C-84**.

---

## 5. Identity — what a person is

Stage 15 decomposed the current `users` table into three: **DBT-007 `persons`** (one human, once),
**DBT-008 `credentials`** (how they prove it), **DBT-009 `school_memberships`** (where they belong).
Stage 16 owns the second of these entirely.

**SD-2 · The identity decomposition, as a security shape**

```
persons                  who this human is
   │                     name · email (citext, DBI-002) · status
   │                     NO password, NO secret, NO role, NO tenant
   │
   ├── credentials       1:1 · how they prove it          ◄── STAGE 16 OWNS
   │                     password_hash · algorithm · params · rotated_at
   │                     mfa_* · verification state · lockout state
   │
   ├── school_memberships  where they belong (per school)
   │
   └── authority_grants    what they may do (per school, Stage 7 AUTH-*)
```

**SEC-D002 · A credential row holds no authority and an authority row holds no credential**

The current `users` table holds `passwordHash`, `role`, `schoolId`, `mfaSecret` and `status` in one
row, which is why disabling an account, revoking a role, rotating a password and changing a tenant are
all the same write today. **After the split, each is a write to exactly one table, and a compromise of
one table does not yield the others.**

**SEC-D003 · Every field of `credentials` is listed here, and nothing else may be added to it**

| Field | Purpose | Notes |
|---|---|---|
| `person_id` | 1:1 with `persons` | |
| `password_hash` | the verifier | §6 |
| `password_algorithm` · `password_params` | what produced it | **required for rehash-on-login** |
| `password_changed_at` | drives §11's session invalidation | |
| `mfa_enrolled_at` · `mfa_disabled_at` | enrolment lifecycle | |
| `mfa_secret_ciphertext` · `mfa_key_id` | **encrypted**, never plaintext | §9 |
| `mfa_last_counter` | **replay defence** | §8 |
| `mfa_recovery_hashes` | SHA-256, single-use | §10 |
| `email_verified_at` | | |
| `failed_attempts` · `locked_until` | durable lockout | §7 |

**Never in `credentials`:** a role, a tenant, a capability, a session, an IP address, a plaintext
anything, or a "notes" column. **A column that is not on this list requires an amendment to Stage 16.**

**SECAR-002 · No API response, log line, error body, support projection or audit record ever contains a
field from `credentials`.** Stage 14's 11 typed support projections are already built on an explicit
allowlist, and the console's read views already exclude `password_hash`, `mfa_secret` and `token_hash` —
this requirement makes that exclusion a rule rather than a property of one implementation.

---

## 6. Credential storage

### 6.1 The current position

`bcryptjs` at cost 12 for passwords and cost 10 for invite and reset tokens, read at
`auth.middleware:543`, `auth.routes:236`, `auth.routes:506`, `console/operations:110` and elsewhere.

**`bcryptjs` is the pure-JavaScript implementation.** It is correct, and it is markedly slower than a
native binding at the same cost — which on a serverless platform means a login costs meaningful
function time, and a burst of logins costs a great deal of it. **The cost parameter that is protecting
the hash is also the one filling the concurrency budget.**

**Stage 11 locked the target: Argon2id.**

### 6.2 The decision

**SEC-D004 · Passwords are hashed with Argon2id, with parameters recorded beside the hash**

```
algorithm   argon2id
memory      64 MiB          m=65536
iterations  3               t=3
parallelism 1               p=1
salt        16 bytes, per credential, from a CSPRNG
output      32 bytes
```

`password_algorithm` and `password_params` are stored **beside** the hash. This is what makes the
parameters changeable later without a flag day, and what makes §6.4's migration possible at all.

**The trade-off, stated (SEC-P20):** 64 MiB per verification is real memory on a serverless invocation,
and it bounds how many logins one instance can verify at once. **That bound is the control working.**
Lowering the memory parameter to raise throughput is a security decision and requires an amendment, not
a configuration change.

**SEC-D005 · Invite, reset and link-code tokens are hashed with SHA-256, not with a password hash**

A password is low-entropy and needs a slow hash. **A 32-byte token from `crypto.randomBytes` is not**,
and running bcrypt over it buys nothing while adding ~100 ms to every verification of a credential that
is presented from an email link — including by an attacker probing. `SHA-256` over the raw token,
compared with `timingSafeEqual`, is the correct construction and is **faster to verify and no weaker**.

**This corrects a real inefficiency, not a vulnerability**, and it is recorded as such.

### 6.3 Password policy

**SEC-D006 · Length is the requirement; composition rules are not imposed**

| Rule | Value | Why |
|---|---|---|
| minimum length | **12 characters** | length dominates composition for offline resistance |
| maximum length | 128 characters | denial-of-service bound on the hash input |
| composition | **none required** | forced classes push people to predictable patterns |
| breach check | **required** — k-anonymity range query against a public breached-password corpus | catches the actual failure mode: a real password reused from a breach |
| similarity | rejected if it contains the username or the school code | |
| rotation | **not forced on a schedule** | scheduled rotation degrades password quality; rotation is forced on *evidence* (§11) |

**The breach check sends five hash characters, never the password and never the full hash.** If the
corpus service is unreachable, **the check is skipped and the password is accepted** — this is an
availability fail-open under SEC-P4, and it is stated here rather than left implicit, because a parent
must be able to set a password when a third-party service is down.

**SECAR-003 · The password policy is enforced server-side.** Client-side strength indication is
presentation (Stage 9 UX-P4) and never the check.

### 6.4 Migrating existing hashes

**SEC-D007 · Rehash on next successful login; never a bulk rewrite, never a forced reset**

```
login attempt
  ├── password_algorithm = 'bcrypt'  → verify with bcrypt
  │                                    if correct: rehash with argon2id,
  │                                    write hash + algorithm + params,
  │                                    IN THE SAME TRANSACTION as the login record
  └── password_algorithm = 'argon2id' → verify with argon2id
```

**Nobody is locked out and nobody is forced to reset.** A bcrypt hash cannot be converted without the
password, so the only alternatives are a forced reset for every user — which mails a bearer credential
to every account at once, the single riskiest thing this system could do — or wrapping the bcrypt hash
inside Argon2id, which permanently couples the two algorithms. **Rehash-on-login costs a long tail and
buys the clean state.**

**SECAR-004 · The long tail is bounded and visible.** A dormant account may keep a bcrypt hash
indefinitely. Stage 16 requires a report of remaining bcrypt credentials by age; **accounts still on
bcrypt after the window Stage 18 sets are disabled, not silently left**. Disabling is reversible
through the recovery flow; leaving is not a decision at all.

---

## 7. Login, lockout and enumeration

**SEC-D008 · The two-dimension limit is kept, and a third durable dimension is added**

The current design — per-account and generous per-IP, with the counter cleared on success — is **kept
as it is**, and its reasoning is preserved verbatim in this document because it is correct.

What is added:

| Dimension | Limit | Store |
|---|---|---|
| per account | 5 failures / 15 min → 429 | **durable** (DBT-076) |
| per IP | 50 / 15 min | durable |
| **per account, durable lockout** | **10 failures / 24 h → `locked_until`** | **`credentials`, not the limiter** |

**Why a lockout column and not only a limiter:** the limiter's rows are disposable and its window is
short, by design. A slow attack — five attempts every sixteen minutes — never trips it. The durable
counter on `credentials` survives, and its state is visible to support and to the account holder.

**SEC-D009 · Lockout unlocks by time, and by the recovery flow — never by a support person typing a
new password**

An unlock is `locked_until` passing, or the account holder completing the reset flow. **PA-2 stands:
account recovery requires support mode (§17), and support never sets a credential.**

**SECAR-005 · Every login response is indistinguishable across "no such user", "wrong password",
"disabled", "locked" and "invited".** The current code already does this — five distinct internal
reasons, one external message, each reason audited separately. **This is preserved as a requirement, not
re-derived.**

**SECAR-006 · Timing is levelled on the non-existent-user path.** Today, an unknown username returns
before any hash is computed, so response time distinguishes a real account from a fake one. The target
computes a hash against a fixed dummy verifier before returning. **The current code closes the message
channel and leaves the timing channel open; both are closed.**

---

## 8. Sessions

### 8.1 What a session is

**SEC-D010 · A session is an opaque server-side record, keyed by a cookie, holding continuity and
nothing that grants authority**

The cookie remains `httpOnly`, `secure` in production, `sameSite: strict`, and the store remains
PostgreSQL (`DBT-075`, whose shape Stage 15 fixed). **What changes is what is inside it.**

```
KEPT IN THE SESSION                        REMOVED FROM THE SESSION
person_id                                  role
authenticated_at                           activeContext as an AUTHORITY
last_seen_at                               schoolId as an AUTHORITY
active_context_request  (a REQUEST,        mfaEnabled
                         resolved per      testSuperuser
                         request — §10)    consoleElevation as a GRANT
mfa_completed_at                             (kept as a RECORD — §18)
session_id (rotated on privilege change)
```

**The distinction that matters:** `active_context_request` says *the person asked to act as a school
administrator*. It is not the finding that they may. **That finding is made per request, against
current stored state (§10).**

### 8.2 Lifetime

**SEC-D011 · Session lifetime is by authority held, and an idle timeout exists alongside the absolute
one**

The current model has an absolute lifetime only — 8 hours for privileged roles, 24 for teachers, 30
days for parents — and no idle timeout at all. A laptop left open in a school office keeps a
school-administrator session alive for its full eight hours.

| Authority | Absolute | Idle | Re-auth for sensitive actions |
|---|---|---|---|
| AUTH-PLATFORM · AUTH-BREAKGLASS | 8 h | **30 min** | always |
| AUTH-SCHOOL · AUTH-FINANCE | 8 h | **60 min** | for money and for authority changes |
| AUTH-TEACH | 24 h | 8 h | for a hand-over correction |
| **AUTH-FAMILY** | **7 days** | **7 days** | for changing a password or an email, for linking a child, and for full payment history |
| AUTH-CMS | 8 h | 60 min | for publication |

**SEC-D088 · AUTH-FAMILY holds a 7-day absolute and a 7-day idle lifetime — SECQ-1 = B, decided by the
owner**

The 30-day session is withdrawn. A guardian uses ScholarShelf a handful of times a term, so in practice
the idle timeout and the absolute lifetime will usually expire together and the guardian signs in on
most visits. **That is the accepted cost**, taken deliberately against the alternative: a live session
into a record naming a child, their class and their family's payment position, sitting on a phone or a
shared family tablet for a month.

**The consequence is a support one, and it is stated rather than discovered later.** More guardians will
reach the sign-in screen, and some of them will have forgotten their password, so **the reset flow
becomes a higher-traffic path than it is today** — which is the same flow §13 rebuilds and the same one
carrying **C-18**, **C-84**, **C-89** and **C-90**. **SECQ-1 = B raises the priority of those four,
and this document says so.**

**SEC-D012 · The session identifier is rotated on every privilege change**

Login already regenerates. The target adds rotation on: completing MFA (already done), **switching
active context**, **entering or leaving support mode**, **elevating or ending break-glass**, and
**changing a password**. Each of these changes what the session can reach; a session identifier that
survives the change is a token whose meaning changed under it.

---

## 9. Session is not authority

**SD-3 · The revocation gap, today and in the target**

```
TODAY
  login ──► session stamps role, schoolId, mfaEnabled, testSuperuser
                     │
                     ├── admin revokes the role  ──► session unaffected
                     ├── school is suspended     ──► checked (ensureSessionSchoolIsActive) ✔
                     ├── MFA is disabled         ──► stale until a context path runs
                     └── password is reset       ──► session unaffected            C-85

TARGET
  every request ──► person_id from session
                    ──► current memberships, authorities, conditions  (resolved now)
                    ──► capability answer                              (cached ≤ 30 s, keyed
                                                                        by an authority version)
```

**SEC-D013 · Authority is resolved per request, and any cache is invalidated by a version, not by
time alone**

Resolving seven tables on every request is a real cost, and pretending otherwise would be dishonest.
The target therefore permits a short cache — **but the cache key includes an `authority_version`
integer held on the person's row and incremented by every write that changes what they may do**: a
membership change, an authority grant or revocation, a status change, a password change, an MFA change.
**A revocation therefore takes effect on the next request, not after a timeout.**

**This is C-67's target.** C-67 stays OPEN and owned by Stages 16 and 22; Stage 16 states the design,
implementation is later.

**SEC-D014 · A password change or an MFA change destroys every other session for that person**

`credentials.password_changed_at` is compared against the session's `authenticated_at` on every
request. Older sessions are refused and deleted. **This is C-85's target, and it is the whole reason
someone resets a password.**

The session that performed the change survives, by comparing session identity rather than timestamp
alone — otherwise the act of securing an account signs you out of the browser you are securing it from,
which people then work around by not doing it.

**SEC-D015 · Explicit revocation exists and is reachable**

A person may sign out everywhere; an administrator may revoke a person's sessions within their school;
a platform owner may revoke any session. **Every one of these is a capability under Stage 7 and is
audited.** Today, no such capability exists at all.

---

## 10. Active context — the authorisation chain at runtime

Stage 7's chain is `PERSON → ACTIVE CONTEXT → ACTIVE AUTHORITIES → CAPABILITY → RESOURCE → SCOPE →
CONDITIONS`, with 95 capabilities, 12 scopes and 12 conditions. Stage 16 states how it is reached at
runtime and where it may not be short-circuited.

**SD-4 · One decision, one path, seven steps**

```
request
  1  PERSON              session → person_id            (never from the body)
  2  ACTIVE CONTEXT      requested context, VALIDATED against current memberships
  3  AUTHORITIES         authority_grants for (person, school, context)  — read now
  4  CAPABILITY          CAP-nnn required by this endpoint (Stage 14, one per route)
  5  RESOURCE            ClaimedId → Resolved<T>          (Stage 13 APP-022)
  6  SCOPE               SC-n satisfied by the resolved resource
  7  CONDITIONS          CD-n evaluated against resolved facts
                              │
                         allow │ deny → 403, one shape, no detail  (Stage 14)
```

**SEC-D016 · Steps 5, 6 and 7 operate on a RESOLVED resource, never on an identifier from the request**

Stage 12 SA-P7 as a security rule: an identifier is a locator. `ClaimedId → Resolved<T>` exists so that
"does this resource belong to this tenant" is answered by the same lookup that fetches it, not by a
separate check a caller may forget. **This closes C-66 structurally.**

**SEC-D017 · A condition that needs data outside the resolved resource states which data, and reads it
inside the same request**

**CD-5, the own-child block on CAP-063 `record_hand_over`, is the worked example.** Stage 15 recorded
honestly that it is not a database constraint and explained why (§22.4 of that document). Stage 16
states where it *is* enforced: **step 7, against the guardian–child relationship (DBT-021) read in the
same request**, with the relationship's own tenant scope applied. **A condition enforced in the client,
or by hiding a button, is not enforced.**

**SEC-D018 · The Universal Test Account is not permitted to exist in production, and this is enforced
by configuration validation rather than by a runtime string comparison**

The current ordering is correct and its comment is right. **The weakness is not the ordering — it is
that `ALLOW_TEST_SUPERUSER` is read from raw `process.env` and appears in no schema (C-82).** The
target puts it in the validated environment module with a rule that **rejects the value `true`
whenever `NODE_ENV === "production"`, at startup.** A production deployment carrying that variable
**fails to start** rather than starting with a universal superuser available.

**SECAR-007 · No capability check may be satisfied by a role string.** `requireRole(...)` is a role
check; Stage 7's model is capability-based. The target's guard takes a `CAP-nnn` and resolves it. **The
95 capabilities are the vocabulary; the eight role strings are a legacy summary of them.**

---

## 11. Tenant isolation as a security control

**SD-5 · Four independent layers, and what each one catches**

```
1  TRANSPORT      the route declares its scope (Stage 14, every endpoint)
                     catches: an endpoint written with no scope at all
2  APPLICATION    tenant scope is a REQUIRED value, never optional  (APP-026)
                     catches: a caller passing nothing and meaning "all"      C-64
3  RESOLUTION     ClaimedId → Resolved<T> re-checks ownership on fetch
                     catches: a valid identifier from another tenant          C-66
4  DATABASE       RLS + tenant-aware composite FKs  (Stage 15 DBD-005)
                     catches: EVERYTHING ABOVE BEING WRONG                    C-65
```

**Layer 4 is the only one that does not depend on application code being correct**, which is exactly
why Stage 15 chose Option B+ and why Stage 16 restates it as a security requirement rather than a
schema preference.

**SECAR-008 · The scoped connection carries `SET LOCAL` inside a transaction, on every scoped read and
write.** A scoped query issued on a connection with no tenant context is a defect of the highest
severity — it is the one path by which a correct RLS policy returns the wrong rows. **A13-001 (Stage
15 §7.7, recorded against Stage 13) exists for this reason.**

**SECAR-009 · The RLS policy text is reviewed as security code.** Policies are not schema decoration.
Every policy in Stage 15's five classes is reviewed against: does it use `USING` and `WITH CHECK` both,
is the tenant taken from the session setting rather than from a column comparison an application could
influence, and does the PUBLICATION class expose exactly the published revision and nothing else.

**SECAR-010 · Support mode does not disable RLS.** A support engagement sets the tenant context to the
engaged school; it never runs with RLS bypassed and never uses a role that owns the tables. **The
`console_ro` role's grants are what enforce this, not the application's intention.**

---

## 12. Multi-factor authentication

### 12.1 The algorithm

**SEC-D019 · TOTP moves from the hand-rolled implementation to a maintained library**

Stage 11 locked this. `server/mfa.ts` is 127 lines and, read line by line, **is correct**: RFC 4648
base32, RFC 6238 with HMAC-SHA1, a ±1 step window, and `crypto.timingSafeEqual` on the comparison. The
recovery-code handling is also correct — high-entropy, SHA-256, single-use.

**It is being replaced for maintenance reasons, not because it is wrong**, and that is stated plainly
so nobody reads this as a criticism of the code. A hand-rolled implementation of a specification is a
thing the team must keep correct forever, against a standard that is not theirs; a maintained library
is a thing the ecosystem keeps correct.

**The one behavioural defect is not in the algorithm at all — it is that nothing consumes the code.**

### 12.2 Replay

**SEC-D020 · A TOTP code is consumed on use**

```
verify(secret, token)
  → counter = the step that matched
  → IF counter <= credentials.mfa_last_counter   → REJECT   (already used, or older)
  → ELSE  set mfa_last_counter = counter
          IN THE SAME TRANSACTION as the session write
```

**A monotonic counter, not a used-code list.** It rejects the matched code and every earlier one at
once, needs one integer, and cannot grow. Today, a code observed once — over a shoulder, in a screen
share, from a support call — remains valid for up to ninety seconds and may be used more than once.

**This is part of C-21**, which already records it. **No new identifier is issued.**

### 12.3 The secret at rest

**SEC-D021 · MFA secrets are encrypted at rest with a key the database does not hold**

```
credentials.mfa_secret_ciphertext   AES-256-GCM
credentials.mfa_key_id              which key encrypted it
key material                        from the deployment secret store — NEVER a database column,
                                    NEVER an application constant, NEVER a migration file
```

**A database read must not yield a working second factor.** Today it does: `users.mfaSecret` is `text`,
in the clear. The console's read views exclude the column, which is a good control — but it is a
control on one reader, and the threat is a reader that is not the console: a backup, a replica, a
support projection written later, a compromised connection string.

**Also part of C-21. Not renumbered.**

**SEC-D022 · Key rotation is a design requirement, not a later problem.** `mfa_key_id` exists so a key
can be retired: new enrolments use the new key, existing secrets are re-encrypted on next successful
verification, and a report shows how many remain on the old key. **The same shape as the password
rehash (§6.4), for the same reason.**

### 12.4 Scope of the requirement — SECQ-2 = A, decided by the owner

MFA is mandatory today for `owner` and `platform_admin` only, enforced in `requireRole` with a careful
comment about not locking anyone out of the enrolment endpoints. **That enforcement is correct as far as
it goes, and it goes only as far as two role strings.**

**SEC-D087 · MFA is mandatory when AUTH-SCHOOL or AUTH-FINANCE is exercised, and the requirement is
evaluated against the AUTHORITY, never against a legacy role string**

**SD-20 · The second-factor gate, keyed to authority**

```
TODAY      if (isPlatformOwnerRole(currentContext) && !session.mfaEnabled) → 403
                      │
                      └── a ROLE STRING comparison, against a session-cached flag

TARGET     the request resolves the AUTHORITIES actually held for this context   (SD-4 step 3)
           if the resolved set intersects { AUTH-PLATFORM, AUTH-BREAKGLASS,
                                            AUTH-SCHOOL,   AUTH-FINANCE }
              and the credential is not MFA-enrolled  (read now, not cached)
           → refuse, and funnel to enrolment
```

**Why authority-based and not role-based is the whole point of the decision.** `school_admin` and
`finance` are two of eight strings the current code happens to use; **AUTH-SCHOOL and AUTH-FINANCE are
what Stage 7 actually models.** A person can hold AUTH-FINANCE without ever carrying the `finance`
string — **PA-1 established that `school_admin + AUTH-FINANCE` is ONE context** — so a role-string rule
would exempt exactly the person PA-1 exists to describe. Keying the rule to the authority makes it
correct for every grant shape Stage 7 permits, including ones nobody has created yet.

**SECAR-050 · The MFA requirement is read from the credential at request time, never from
`session.mfaEnabled`.** The session flag is the cached-authority defect (**C-67**) wearing a security
hat: MFA disabled on another device leaves a stale `true` in this session until a context path runs.
Under SEC-D013 the requirement is resolved with the rest of the authority set and invalidated by
`authority_version`.

**The adoption cost is real and is accepted with a grace period.** Every school must enrol its office
and finance staff before the requirement bites. The grace period is a dated deadline per school, visible
to that school's administrator with a list of who has not yet enrolled, after which the authority
cannot be exercised. **Enrolment endpoints stay behind `requireAuth`, never `requireRole`, so nobody can
be locked out of enrolling** — the current code is careful about this and the care is preserved.

**SECQ-2 = A does not close C-21.**

```
C-21   TARGET POLICY RESOLVED  ·  IMPLEMENTATION OPEN

resolved by SECQ-2 = A     the scope question C-21 assigned to Stage 16
NOT resolved               mfa_secret is still plaintext          (SEC-D021)
NOT resolved               a TOTP code is still never consumed    (SEC-D020)
NOT resolved               the requirement is still role-keyed    (SEC-D087)
```

**A policy decision remediates nothing.** C-21 closes when its three implementation defects are fixed in
code and verified by the tests SEC-D081 names — not when this document states what the answer should
be.

### 12.5 Enrolment and recovery codes

**SECAR-011 · Enrolment, disabling and recovery-code regeneration all require re-authentication.**

**A correction to this document's own earlier draft, reported rather than quietly amended.** The
proposed version stated that enrolment *"requires the current password, which the current code already
does"*. **Re-reading `mfa.routes.ts` in full shows that is wrong.** `POST /api/auth/mfa/setup` and
`POST /api/auth/mfa/enable` perform **no password check at all**; only `/mfa/disable` and
`/mfa/recovery-codes` call `bcrypt.compare`. The claim was inferred from two of the four endpoints and
generalised to all four, which is the exact failure this stage's evidence rule exists to prevent.

**SEC-D086 · Every MFA lifecycle transition re-authenticates**

| Endpoint | Today | Target |
|---|---|---|
| `/mfa/setup` | **no check** | password |
| `/mfa/enable` | **no check** | password |
| `/mfa/disable` | `bcrypt.compare` ✔ | password **+ a current TOTP code** |
| `/mfa/recovery-codes` | `bcrypt.compare` ✔ | password **+ a current TOTP code** |

**Why the absence matters more than it looks.** Anyone holding a hijacked session can enrol **their own**
authenticator on the victim's account without knowing the password. The victim's next login then
requires a code only the attacker has — and on a platform-owner account, `/mfa/disable` refuses
self-service disable, so **the legitimate owner is locked out of their own account by a control designed
to protect it.** → **C-90**.

**SEC-D082 · A recovery code is a ROW, and single-use is a database guarantee — not a filter in
JavaScript**

The current implementation is shown-once, SHA-256-hashed and regenerable, and **all three of those are
right and are preserved**. Its consumption is not. Reading `mfa.routes.ts`:

```
TODAY   hashes  = JSON.parse(user.mfaRecoveryCodes)          read
        matched = matchRecoveryCode(code, hashes)
        remaining = hashes.filter(h => h !== matched)         modify   // single-use
        update(users).set({ mfaRecoveryCodes: JSON.stringify(remaining) })   write
        └── no transaction · no predicate · no version · on the HTTP handle

TARGET  UPDATE credential_tokens                              DBT-077 · A15-001
           SET consumed_at = now(), consumed_by_session = $1
         WHERE person_id = $2 AND purpose = 'mfa_recovery'
           AND token_hash = $3 AND consumed_at IS NULL         ◄── the predicate IS the guarantee
        └── inside the login transaction · rowCount = 0 means ALREADY USED → reject
```

**The conditional `UPDATE` is what makes it single-use.** The second of two concurrent attempts finds
`consumed_at IS NULL` false, updates nothing, and is refused — the same technique Stage 15 uses at
DBI-014 for settlement confirmation, and for the same reason: **a guarantee that cannot be written
incorrectly beats one every future caller must remember.** A JSON array cannot express it at all, which
is why this requires **DBT-077** and therefore **A15-001** (§49).

**SECAR-012 · Every single-use credential in the system is enforced single-use by the database.**
Recovery codes, password-reset tokens, email-verification tokens and child link codes all live in
DBT-077's shape or carry an equivalent partial unique. **No single-use claim in this system rests on
application filtering.** → this is **C-87**'s target.

**Using a recovery code notifies the account holder**, because it means either that they lost their
device or that someone else has their codes, and both are worth a message.

**SEC-D083 · The enrolment secret is never written to the session store**

`req.session.pendingMfaSetupSecret = secret` puts a live TOTP secret into `user_sessions.sess` in
plaintext, in a row that outlives the enrolment attempt (**C-88**).

```
TARGET   the pending secret is a DBT-077 row
             purpose = 'mfa_enrolment'  ·  encrypted with the same key as mfa_secret_ciphertext
             expires_at = now() + 10 minutes        ◄── an ABANDONED enrolment expires by itself
             consumed on /mfa/enable, in the same transaction that writes the credential
         the session carries only the row's identifier — which grants nothing on its own
```

**Ten minutes, not the session's lifetime.** Enrolment is a single sitting: scan a QR code, type a
code. A secret that outlives that sitting by up to thirty days is a secret kept for no reason.

**SEC-D023 · Disabling MFA is a sensitive action requiring re-authentication and notification**, and it
increments `authority_version` (§9), so sessions holding a stale MFA fact are refused.
---

## 13. Password reset

### 13.1 What the current flow does

Read directly: a 32-byte random token, bcrypt-hashed at cost 10, stored as a row in the **`invites`**
table with `role: "__password_reset__"`, a one-hour expiry, single-use enforced by
`status !== "pending"` plus `markInviteAccepted`, uniform responses on every path, and a per-IP limit
of 3 per 15 minutes.

**The token generation and the one-hour expiry are correct.** Six things around them are not — and two of
those six (**C-89**, and C-71's credential instance) were found only on the second evidence pass.

### 13.2 The target

**SEC-D024 · A password reset is its own record, not an invitation with a magic role string**

`role: "__password_reset__"` in the `invites` table means the reset token lives in a table whose
purpose, retention, listing endpoints and future indexes belong to invitations. **A support projection
listing "pending invites" for a school lists live reset tokens.** Stage 15 kept `invites` as
**DBT-011**; Stage 16 requires reset tokens in their own structure, with their own retention.

| | Current | Target |
|---|---|---|
| storage | `invites` + magic role | **DBT-077 `credential_tokens`** — its own table, its own retention (**A15-001**, §49) |
| hash | bcrypt cost 10 | **SHA-256** (SEC-D005) |
| expiry | 1 hour | 1 hour — **kept** |
| single use | a `status` read-then-write | **a conditional `UPDATE … WHERE consumed_at IS NULL`** — SEC-D082, closing the race |
| per-IP limit | 3 / 15 min | **kept** |
| per-account limit | **none** | **3 / hour**, durable |
| on success | two auto-commits | **ONE transaction** (SEC-D084): token consumed, password written, **every other session destroyed** (SEC-D014), every other live reset token invalidated, audit written |
| notification | none | **the account holder is emailed that the password changed** |

**SECAR-013 · Two concurrent redemptions of the same token cannot both succeed.** The current check is
read-then-write: two requests can both read `pending`. The conditional `UPDATE … WHERE consumed_at IS
NULL` of SEC-D082 makes the second lose at the database, exactly as Stage 15's DBI-014 does for
settlement confirmation. **The same technique, for the same reason: a guarantee that cannot be written
incorrectly.**

### 13.3 The reset is one transaction, or it does not happen

**SEC-D084 · A credential change is a single transaction on a transaction-capable connection**

Read directly: `reset-password` performs two independent auto-committing writes on `getDb()` —
`storage.updateUser({ passwordHash })`, then `storage.markInviteAccepted(invite.id)`. There are four
`.transaction(` sites in `server/` and **none is a credential path** (**C-89**).

```
TODAY   updateUser(passwordHash)          auto-commit   ─┐  if the second write fails,
        markInviteAccepted(inviteId)      auto-commit   ─┘  the password changed and the
                                                            LINK IS STILL REDEEMABLE

TARGET  withTransaction(tx => {                          Stage 13 APP-048 · APP-028's Tx
          consume the DBT-077 token   WHERE consumed_at IS NULL   ← 0 rows ⇒ abort
          write credentials.password_hash + password_changed_at
          invalidate every other session for this person          SEC-D014
          invalidate every other live reset token for this person
          write the audit record                                  SEC-D067, security-critical class
        })                                                        ONE COMMIT
```

**The token is consumed first, not last.** Consuming first means the transaction aborts before the
password is touched if the link was already used; consuming last means a crash between the two leaves a
changed password and a live link — which is exactly today's failure. **Ordering inside the transaction
still matters, because the transaction can be aborted by its own predicate.**

**A13-001 applies.** This transaction requires the node-postgres connection; `getDb()`'s Neon HTTP handle
cannot hold it. **The current code is on the handle that could not do this even if `.transaction()` were
called** — which is C-74 with a credential-shaped consequence.

**SEC-D085 · A credential write is durable or it fails; it is never written to process memory**

`storage.updateUser` and `storage.markInviteAccepted` both catch `isDbUnavailableError(e)` and fall back
to an in-process `Map`. **A password reset during a database outage answers *"Password has been reset
successfully"* and durably changes nothing** — the user then cannot sign in with either password, and
nothing recorded that this happened.

**SECAR-052 · The memory-storage fallback is unreachable from every credential path.** A credential
mutation that cannot reach PostgreSQL returns an error the person can act on. **This is C-71's
credential-path instance**, and C-71 keeps its identifier — Stage 16 adds the consequence, not a new
number.

**The trade-off, stated:** in memory mode the product cannot change a password at all. That is correct.
**Memory mode is a development convenience, and a development convenience must not be able to issue a
credential.**

**SECAR-014 · A password-change notification is sent even when the change succeeded**, because the
message is what tells a victim that their account was taken.

### 13.4 The reset link is never written to a log

**SEC-D025 · A URL containing a credential is never logged, printed, echoed or stored outside the
delivery channel**

The current fallback — `console.log("[PASSWORD RESET] Link for ${email}: ${resetLink}")` when the send
fails, ungated — is **C-18**, already carried, and is the single highest-severity finding in this
document. On the deployment target the log is the platform's log store; **log access becomes account
access for any account whose reset email failed to send.**

**The target's behaviour when email delivery fails:**

```
send fails
  ├── record the FAILURE (person, time, failure class)   — never the link, never the token
  ├── surface it to support as "delivery failed"          — never with the link
  └── the person retries, or support initiates recovery under §14's rules
```

**A convenience for a developer running locally must not be a mechanism in production**, and a
`NODE_ENV` guard is not sufficient on its own — the target removes the line rather than gating it,
because a gate is one misconfigured environment away from being open. **In development the link is
returned in the response body of the local-only path, which cannot leak from a deployed environment
because the path does not exist there.**

**SEC-D026 · The same rule covers every bearer credential in a URL:** invite links, link codes,
email-verification links, signed object URLs and support-mode deep links. **The prohibition is on the
class, not on the one instance that was found.**

---

## 14. Where a link's host comes from

**SEC-D027 · The public base URL is configuration, and the application refuses to start without it**

`getPublicBaseUrl` currently falls back to `x-forwarded-host` when neither `APP_BASE_URL` nor
`PUBLIC_APP_URL` is set — and `APP_BASE_URL` is `.optional()` in the Zod schema, so **nothing requires
it in production.**

```
TODAY    APP_BASE_URL || PUBLIC_APP_URL || x-forwarded-host || req.get("host") || "localhost:5000"
                                           └──────────── attacker-influenceable ────────────┘

TARGET   APP_BASE_URL          — required in production, validated as a URL at startup
                               — no header fallback, ever
```

**Why this matters more than it looks:** the value is interpolated into the password-reset link that is
then emailed. A request whose `x-forwarded-host` names an attacker's domain produces a reset email,
sent by ScholarShelf to the real account holder, containing a link to the attacker. **The email is
genuine, the token is genuine, and the host is not.**

Vercel's edge does set `x-forwarded-host` itself, which reduces the exposure on the current deployment
target — **that is a property of one platform's behaviour, not a control the application holds**, and
the application must not depend on it. → **C-84**.

**SECAR-015 · `PUBLIC_APP_URL`, `APP_BASE_URL` and every other URL-shaped setting are in the validated
environment module, with exactly one of them authoritative.** Two variables meaning the same thing, one
in the schema and one not, is how a required setting stays unset.

---

## 15. Invitations and link codes

**SEC-D028 · An invitation token and a child link code are both credentials and both follow §6.5's
storage rule**

Stage 15 made the link code's uniqueness **global and unconditional** — `UNIQUE (code_hash)`, DBI-029 —
precisely because it is a credential and an expired code's hash must never be reissuable. Stage 16
states the rest of that credential's handling:

| | Rule |
|---|---|
| generation | CSPRNG; the alphabet excludes visually ambiguous characters, because a school reads these aloud |
| entropy | **≥ 60 bits**, whatever the presentation length implies |
| storage | SHA-256 of the normalised code; **the plaintext is never stored** |
| expiry | set at issue; expiry never relaxes the uniqueness (DBI-029) |
| attempts | **rate-limited per code and per IP**, and a code is burned after 10 failed redemptions |
| single use | redemption is transactional; a redeemed code cannot be redeemed again |
| revocation | a school administrator may revoke an unredeemed code |

**SECAR-016 · A link code is never emailed together with the information needed to use it against the
wrong child.** The code identifies the child; the message must not also disclose the child's full
record to an address that has not yet been verified as a guardian's.

**SEC-D029 · An invitation grants membership, never authority.** Accepting an invitation creates a
`school_membership` (DBT-009). **Authorities are granted separately (DBT-010) by someone who holds
CAP-* to grant them.** Today, `invites.role` carries a role string that becomes the account's role on
acceptance, which means the invitation *is* the authority grant — a single emailed token that creates
privilege. **In the target it cannot.**

---

## 16. Email as a channel

**SEC-D030 · Email is a delivery channel, never a store, and never an authority**

| Rule | |
|---|---|
| an email never contains a password, an MFA secret, a recovery code, or a session identifier | |
| an email contains a **single-use, short-lived, revocable** link, or it contains no credential at all | |
| a bounce or a failure is recorded as a **failure class**, never with the message contents (Stage 15 DBT-054) | |
| the provider (Resend, Stage 11) is a **sub-processor** and appears in §41's register | |
| **an email address alone never proves a person** — verification is a separate, recorded fact (`email_verified_at`) | |

**SECAR-017 · A failed send never changes a business outcome.** BR-124 already records four places
where the opposite happens — `auth.routes.ts:450`, `owner.routes.ts:641`, `console/operations.ts:127`,
`parent.routes.ts:350`, none dev-gated. **Stage 16 requires that a delivery failure is recorded and
surfaced, and that nothing about the account's state depends on whether the message arrived.**

---

## 17. Support mode

**SD-6 · A support engagement, start to finish**

```
platform person, holding AUTH-PLATFORM
        │
        │ CAP-* to begin support       reason REQUIRED, free text, recorded
        ▼
support_engagement  (DBT-067)        UNIQUE (actor_person_id) WHERE ended_at IS NULL   DBI-024
        │                            ── ONE engagement at a time, ACROSS ALL TENANTS
        │
        ├─ session identifier ROTATED           (SEC-D012)
        ├─ tenant context becomes the engaged school  — RLS still on   (SECAR-010)
        ├─ every action audited with the engagement id
        ├─ the ENGAGED SCHOOL is notified                              (SEC-P16)
        └─ time-bounded; ends by expiry or explicitly
```

**SEC-D031 · Support reads through typed projections and never through a general query**

Stage 14 fixed this: **11 typed projections, API-260…API-270, under CAP-088 `run_typed_support_operation`
— and the default is NOT EXPOSED THROUGH SUPPORT.** Stage 16 adds the security rationale: a general
support query is a capability whose blast radius cannot be reviewed, because its scope is whatever the
query says. **A typed projection's scope is reviewable before it ships and is the same every time it
runs.**

The word *typed* in CAP-088's name is the control. It is why a support wildcard was rejected.

**SEC-D032 · PA-2 stands: account recovery requires support mode, and support mode never sets a
credential**

A support person may **initiate** recovery — which sends the account holder a single-use link. They may
not set a password, read a hash, read an MFA secret, disable MFA silently, or see a recovery code.
**The distinction is between helping someone regain access and gaining it on their behalf.**

**SECAR-018 · A support engagement is visible to the school it engages**, at the time it happens and
afterwards in that school's own record. **Support that a tenant cannot see is indistinguishable from a
breach, from the tenant's point of view.**

---

## 18. Break-glass console access

The console's three tiers are the best-designed control in the current system, and the target keeps
them.

**SD-7 · The three tiers**

```
TIER 1  typed operations        ~90% of support work · no SQL is typed · CAP-088
TIER 2  read-only queries       console_ro role · SELECT on VIEWS only
                                default_transaction_read_only + BEGIN READ ONLY
                                every query parameterised (extended protocol)
                                views EXCLUDE password_hash / mfa_secret / token_hash
                                ALWAYS ROLLBACK, never COMMIT               CAP-089
TIER 3  break-glass writes      fresh TOTP + ≥20-char written reason
                                15-minute expiry · other owners notified    CAP-090/091
```

**SEC-D033 · Enforcement stays in PostgreSQL, never in a regular expression**

The file's own reasoning is correct and is preserved here because it is the right principle stated well:
a regex cannot police a query language — `WITH x AS (DELETE … RETURNING *) SELECT * FROM x` starts with
`WITH`, `SELECT 1; DELETE …` passes a first-word check, and a leading comment defeats an anchor.
**Five independent database-level controls each kill a whole class of bypass.**

**SECAR-019 · The console's controls must not depend on a migration that CI skips.** This is **C-73**,
already carried and owned by Stage 21, and it is the reason **C-78** (Stage 15) exists. The console is
correct in code and **its enforcement is only real if `001_console_hardening.sql` has actually been
applied to the database the console connects to** — which, on the evidence, cannot be established from
the repository. **Stage 16 does not claim the control is in force. It claims the design is right and
the application state is unverified.**

**SEC-D034 · Break-glass elevation is a session-scoped, time-boxed, notified grant — and it is
recorded in the console operation record, not only in the session**

The current elevation lives in `req.session.consoleElevation`. Stage 15 deferred
`console_operations` (DM-054) to Stage 16/19 for exactly this reason: **the durable record of what was
elevated, by whom, why, and what was done under it belongs in a table, not in a session that expires.**
Stage 16 states the fields; **Stage 19 owns the record mechanics** and may narrow them.

| Field | |
|---|---|
| `elevation_id` · `actor_person_id` · `reason` | who and why |
| `granted_at` · `expires_at` · `ended_at` · `ended_reason` | the window |
| `engagement_id` | which support engagement, if any |
| `operation` · `target` · `outcome` | what was actually done |

**SECAR-020 · An elevation nobody notices is not a control.** The current code notifies other owners
fire-and-forget so a mail failure never blocks emergency access — **which is right**, and the target
adds that the notification failure is itself recorded, so "nobody was told" is a fact someone can find.

---

## 19. Cross-site request forgery

**SEC-D035 · `SameSite=Strict` is kept, and a double-submit token is added for state-changing requests**

The current defence is `sameSite: "strict"` alone, and the comment explaining it is accurate: a strict
cookie is not sent on any cross-site request, and top-level navigation into the SPA still authenticates.

**It is a real control and it is one layer.** SEC-P3 asks whether a second layer is independent, and
here it is: a token defends against same-site attacks that SameSite by definition does not cover — a
subdomain takeover, an XSS-adjacent injection into a same-site page, a browser that mishandles the
attribute.

```
TARGET
  cookie          sameSite = Strict      (unchanged)
  plus            a per-session CSRF token, delivered in a readable cookie
                  and echoed in a header on every POST/PUT/PATCH/DELETE
  compared with   timingSafeEqual
  exempt          endpoints authenticated by something OTHER than the session
                  — provider callbacks (HMAC), cron (bearer secret)
```

**SECAR-021 · The exemption list is explicit and closed.** An endpoint is exempt because it does not use
the session cookie for authority, not because adding a token was inconvenient. **A cookie-authenticated
endpoint is never exempt.**

**The trade-off, stated:** the token adds a failure mode — a stale tab after a session rotation gets a
403 where it previously worked. **The client handles it by re-fetching the token on 403 and retrying
once**, and the residual cost is one extra round-trip in a rare case.

---

## 20. Cross-origin resource sharing

**SEC-D036 · There is no CORS middleware, and that is the target — stated as a decision, not left as an
absence**

Read directly: **no `cors` package, no `Access-Control-*` header set anywhere in `server/`.** The
browser therefore refuses cross-origin credentialed requests by default, which is the correct outcome
for a first-party SPA served from the same origin as its API.

**Stage 14's APIQ-1 = A settled the question this depends on:** `PublishedSite` is first-party only,
unversioned, **not a supported third-party developer API**. There is no external consumer, so there is
no origin to allow.

```
TARGET
  no CORS headers on any authenticated endpoint          — the browser's default is the control
  no wildcard, ever, on any endpoint that uses a cookie
  the public site's endpoints are same-origin too        (Stage 12 AQ-1 = B)
```

**SECAR-022 · If a future stage needs a cross-origin consumer, it requires an amendment to this
document**, an explicit origin allowlist, and a decision about whether that consumer uses cookies at
all — because a credentialed cross-origin API and `SameSite=Strict` cannot both hold.

---

## 21. Security headers and content security policy

`helmet()` is applied first, before body parsing and before routing, which is the correct position, and
it sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and HSTS
(`maxAge: 63072000, includeSubDomains`, production only).

**One directive value is wrong.**

**SEC-D037 · `'unsafe-inline'` is removed from `script-src` in production; scripts carry a per-response
nonce**

```
TODAY     scriptSrc: IS_PRODUCTION ? ["'self'", "'unsafe-inline'"]
                                   : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]

TARGET    scriptSrc: ["'self'", "'nonce-<per-response>'"]              production
          scriptSrc: ["'self'", "'nonce-…'", "'unsafe-eval'"]          development only, for Vite HMR
```

The adjacent comment states that `'unsafe-eval'` *"must NOT be present in production, where it
materially weakens XSS defence"* — and that reasoning applies to `'unsafe-inline'` unchanged. **A CSP
that allows arbitrary inline script does not stop the injection it exists to stop.** → **C-83**.

**SEC-D038 · The remaining directives are tightened to what the product actually loads**

| Directive | Today | Target | Why |
|---|---|---|---|
| `script-src` | `'unsafe-inline'` | **nonce** | C-83 |
| `style-src` | `'unsafe-inline'` | `'unsafe-inline'` **kept** | Tailwind v4 and the runtime theme tokens genuinely need it; **stated as an accepted residual, not hidden** |
| `img-src` | `'self' data: https:` | `'self' data:` + the object store's origin | `https:` is every host on the internet |
| `connect-src` | `'self' wss: ws:` | `'self'` | **Stage 11 locked: no realtime infrastructure.** The websocket schemes permit connections the product does not make |
| `font-src` | `'self' https: data:` | `'self' data:` + the font origin, if any | as `img-src` |
| `object-src` | `'none'` | `'none'` — **kept, correct** | |
| `frame-ancestors` | not set | **`'none'`** | explicit, rather than relying on `X-Frame-Options` alone |
| `base-uri` | not set | **`'self'`** | stops a `<base>` injection redirecting every relative URL |
| `form-action` | not set | **`'self'`** | stops an injected form posting credentials elsewhere |

**SECAR-023 · The public school website has its own, stricter policy.** Stage 12's AQ-1 = B gives the
public site a separate delivery path, and Stage 15's CMS model makes its content **structured sections,
not arbitrary HTML** (DBT-061). **The public site therefore needs no inline script at all**, and its
CSP says so. The safety of the public renderer is structural — a section has typed fields — with CSP as
the second layer, not the first.

**SEC-D039 · HSTS is kept as configured and `preload` is not added yet.** Two years with
`includeSubDomains` is correct. **`preload` is irreversible on a browser timescale**, and it is a
deployment decision (Stage 21) once the domain's subdomain inventory is settled — adding it here would
commit an operational choice this stage cannot verify.

---

## 22. Rate limiting and abuse

### 22.1 The current position, fairly stated

The design is better than it first looks: a per-account and a per-IP dimension with well-argued
asymmetry, a durable PostgreSQL store, an atomic upsert, opportunistic cleanup, and a memory fallback.
**The reasoning about a school behind one public IP is correct and is preserved.**

Three things need changing.

**SEC-D040 · The limiter's table is created by migration, never by application DDL**

`ensureRateLimitTable()` runs `CREATE TABLE IF NOT EXISTS rate_limits` on the request path.
`app.ts` documents at length why startup DDL was removed — sequential round-trips on every cold start,
`ACCESS EXCLUSIVE` locks contending on a busy morning, failures swallowed into a warning. **All three
apply here.** Stage 15 makes `rate_limits` **DBT-076**, created by **MIG-03**. → **C-86**.

**SEC-D041 · Read limits exist, and public endpoints are covered**

The global limiter applies only to `POST/PUT/PATCH/DELETE`. `GET /api/public/schools/:code` and
`GET /api/public/schools/:code/website` are unlimited, so **school codes can be enumerated at any
rate** — and the school code is half of the login credential pair for a tenant-scoped account.

| Dimension | Limit |
|---|---|
| authenticated reads, per person | generous; a cap that catches a runaway client, not a person working |
| **public reads, per IP** | **strict** — these serve one small page |
| **public reads, per school code** | **strict** — enumeration is the thing being stopped |
| writes, per identity | 240 / min — **kept** |
| auth, cron, link-code | their own stricter limits — **kept exempt from the global one** |

**SECAR-024 · A negative lookup on a public endpoint costs the same as a positive one**, in both timing
and shape, so enumeration gains nothing from either channel.

**SEC-D042 · The limiter's fail-open is kept for availability and made visible**

`try { … } catch { /* never block traffic on limiter failure */ }` is a deliberate choice, and on
balance the right one: a limiter outage must not take the product down. **But a limiter that fails open
silently is indistinguishable from a limiter that is working**, and on serverless the in-memory
fallback is empty on every cold start, so the degradation is close to total.

```
KEPT       the limiter fails open rather than refusing traffic
ADDED      a fail-open is COUNTED and ALERTED, not swallowed
ADDED      the AUTHENTICATION limiter does NOT fail open
```

**The split is the point.** Failing open on a general write limiter costs throughput control. **Failing
open on the login limiter costs the password.** SEC-P4 permits fail-open for availability and forbids
it for authority, and login limiting is an authority control.

**The trade-off, stated:** if the durable store is unreachable, logins are refused rather than
unlimited. That is an availability cost, taken deliberately.
---

## 23. Input validation and output encoding

**SEC-D043 · Every request is validated by a schema at the transport edge, and the handler receives a
typed value**

Stage 14 fixed the contract; Stage 16 states the security rule that follows from it: **a handler never
reads `req.body`, `req.query` or `req.params` directly.** It receives the parsed result of a schema.
The current code does this well in places (`signInSchema.safeParse`, the console's `z.object({...})`)
and not at all in others (`message.routes.ts` destructures the webhook body raw).

**SECAR-025 · Validation is allowlist-shaped: unknown keys are stripped, not passed through.** A
schema that permits extra properties lets a client set a field a later refactor starts reading. **The
`PATCH` endpoint the console removed — which interpolated JSON object keys into SQL as
`"${k}" = $n` — is what that looks like when it reaches the database.**

**SEC-D044 · Identifiers from a request are `ClaimedId`, never `Resolved`**

Stage 13's APP-022 type distinction is a security control (SEC-D016). Validation proves a value is
*shaped* like an identifier; it proves nothing about ownership. **The two are never conflated by a
schema that "validates" a UUID and hands it on as if it were authorised.**

**SEC-D045 · Output encoding is contextual and is React's by default**

The authenticated SPA escapes by construction. **The rule is that `dangerouslySetInnerHTML` does not
appear in the codebase**, and where rich content genuinely must render — a CMS section body — it is
rendered from **structured fields** (Stage 15 DBT-061), never from stored HTML.

**SECAR-026 · No user-supplied value reaches a SQL string, a shell command, a file path, a redirect
target or a template without a mechanism that makes injection structurally impossible.** Parameterised
queries for SQL; no shell invocation at all; no user value in a filesystem path (§25 removes the last
one); redirects only to a fixed allowlist of internal paths.

---

## 24. File uploads

### 24.1 What is already right

`branding.ts` detects the content type from **magic bytes**, permits only PNG, JPEG and WebP,
**excludes SVG deliberately** because it can carry `<script>`, and multer is configured with
`memoryStorage()`, a 5 MB limit and `files: 1`. **This is a good upload filter and it is preserved.**

### 24.2 The target

**SEC-D046 · An upload passes through four trust states, and nothing may reference it before
`published`**

Stage 15 fixed the states on **DBT-071 `object_uploads`**; Stage 16 fixes what each transition
requires.

**SD-8 · Upload trust states**

```
   received                the bytes arrived; nothing is trusted
      │  size within the declared bound
      │  magic-byte detection succeeds and matches the allowlist
      │  declared_content_type RECORDED but NOT USED
      ▼
   verified                the bytes are what the system says they are
      │  malware scan completes with a clean verdict
      │  (Stage 21 selects the scanner; Stage 16 requires the gate)
      ▼
   published               may be referenced by a page, an email, a PDF
      │
      ▼  a later scan, a report, or an administrator
   quarantined             referenced nowhere; retained as evidence; never deleted silently
```

**SEC-D047 · The declared content type and filename are recorded and never trusted for anything**

Stage 15 kept `declared_content_type` and `detected_content_type` as separate columns *"because the
uploader's claim and the system's finding are two different facts"*. Stage 16 adds the security half:
**the served `Content-Type` is the detected one, always**, and the stored object key is generated, never
derived from the filename.

**SECAR-027 · No uploaded filename ever appears in a filesystem path or a URL path.** The stored key is
opaque; the original filename is metadata shown to a person. This removes path traversal and every
extension-confusion trick from the design rather than filtering for them.

**SEC-D048 · Everything is served with `Content-Disposition: attachment` and
`X-Content-Type-Options: nosniff`, except images rendered in the product**

An HTML file that reached `published` and is served inline from the product's own origin is stored XSS
with a same-origin session cookie attached. **Images render; everything else downloads.**

### 24.3 The publicly mounted directory

**`app.use("/uploads", express.static(...))` is mounted before any authorisation** — **C-68**, already
carried. Stage 16's target removes the mount entirely: **there is no local filesystem serving path**,
because Stage 15's DBD-036 moved bytes out of the database and out of the application, and §25 governs
access.

---

## 25. Object access

**SEC-D049 · Objects are served through short-lived signed URLs issued after an authority check, never
by a public path**

```
request for an object
  → capability + scope check on the OWNING RESOURCE, not on the object   (SEC-D016)
  → issue a signed URL, expiry ≤ 5 minutes, single-purpose
  → the object store enforces the signature
```

**A signed URL is a bearer credential and follows SEC-D026: it is never logged**, never written to an
audit record, never placed in an email that is retained, and never used as a stable reference.

**SEC-D050 · Public site media is a separate, deliberately public class**

Stage 15's PUBLICATION policy class (§7.6 there) covers exactly the published revision's rows.
**DBT-064 `site_media_links` may only reference an object in the `published` state**, and those objects
are the only ones served without a signature. **A school's logo is public because a school chose to
publish it; a child's photograph is never in this class.**

**SECAR-028 · The email logo path proves the rule.** `toEmailSafeLogoUrl` today converts a `data:` URI
into `/api/public/schools/:code/email-logo` — a public, unauthenticated endpoint, which is **correct
for a school logo** and would be catastrophic for anything else. The target keeps the endpoint and
requires that its source is the published site's identity object and nothing else.

---

## 26. CMS rendering

**SEC-D051 · The public site renders structured sections; it never renders stored HTML**

Stage 15's DBT-061 `page_sections` holds a bounded `section_kind` plus typed fields, deliberately not a
free HTML blob, *"so the public renderer can be safe by construction rather than by sanitisation."*
Stage 16 states the security consequence: **there is no sanitiser in the target, because there is
nothing to sanitise.**

A sanitiser is a denylist against a parser someone else maintains. **A schema that cannot express a
script tag needs no denylist.**

**SEC-D052 · Publication is a capability, an entitlement and a state change — all three**

```
CAP-*  to publish            Stage 7
MA-2   CMS entitlement       school_entitlements (DBT-005) — a school without it cannot publish
        │
        ▼
publish = published_revision_id := current_revision_id      ONE UPDATE   (Stage 15 DBD-037)
        the revision becomes FROZEN
        the PUBLICATION RLS class then exposes exactly that revision
```

**Freezing is a security property, not only a content one.** A published revision that could still be
edited would mean the public site's contents could change without a publication event, with nothing
recorded and no capability exercised.

**SECAR-029 · The public renderer executes no tenant-supplied code, loads no tenant-supplied script
origin, and applies §21's stricter CSP.** A school controls content, structure within the section
vocabulary, and theme tokens (DBT-065). **It controls no code path.**

**SECAR-030 · `site_contact` (DBT-066) holds public contact information only.** Stage 15 stated this;
Stage 16 makes it a privacy control: **a guardian's or a staff member's personal email must never be
publishable**, and the field vocabulary is what prevents it, not an instruction to editors.

---

## 27. Provider callbacks

This is the weakest area found, and it is weak in three independent ways on one endpoint.

**SD-9 · The callback path, today and in the target**

```
TODAY
  POST /api/webhooks/payment-update
    rawBody = JSON.stringify(req.body)          ◄── NOT the bytes received        C-80
    HMAC-SHA256, timing-safe, fails closed      ◄── correct, over the wrong input
    no timestamp, no nonce, no event id         ◄── replayable indefinitely       C-81
    updatePaymentByReference(reference)         ◄── GLOBAL lookup, no tenant      C-41
    "Webhook is trusted — no schoolId filter needed"
    confirmPayment(...)                         ◄── MONEY CONFIRMED
    catch → res.status(500).json({ message: e.message })                          C-70

TARGET
  raw bytes from express.json's verify hook  ─► HMAC over EXACTLY those bytes
                                             ─► timestamp within ±5 minutes
                                             ─► provider_event_id recorded, UNIQUE   DBI-021
                                             ─► resolve the reference WITHIN a tenant
                                             ─► write a provider_event (DBT-041) — a SIGNAL
                                             ─► settlement remains a HUMAN act under CAP-049
```

### 27.1 The signature is computed over the wrong input

**SEC-D053 · A signature is verified over the exact bytes received**

`app.ts` already captures them: `express.json({ verify: (req, _res, buf) => { req.rawBody = buf } })`.
**The webhook does not use `req.rawBody`.** It re-serialises the parsed object, so key order,
whitespace, unicode escaping and number formatting must all coincidentally match the sender's — and
where they do not, a legitimate call is rejected; where they do, the endpoint has verified a
reconstruction rather than the message. **SEC-P9 exists for this.** → **C-80**.

### 27.2 There is no replay defence

**SEC-D054 · Every provider callback carries a timestamp and an event identifier, and both are
enforced**

| Control | Mechanism |
|---|---|
| freshness | the signed payload includes a timestamp; ±5 minutes; **the timestamp is inside the signed material**, not a separate header |
| uniqueness | `provider_events` **DBI-021 `UNIQUE (integration_id, external_event_id)`** — Stage 15 already provides it |
| ordering | events are recorded, not applied in arrival order; the business effect is derived |

**Stage 14 already decided the shape of this** — *"Do NOT require a provider to send a header it does
not support"* — so where a provider offers no event identifier, **the identifier is derived from a hash
of the signed payload**, which is stable for a genuine retry and different for a genuine second event.
→ **C-81**.

### 27.3 The callback confirms money with no tenant

**SEC-D055 · A provider signal is bound to a tenant before anything is written, and a signal never
confirms a settlement**

Two separate corrections:

**First, tenant binding.** The signature proves the sender. It says nothing about which school's payment
reference this is, and `updatePaymentByReference` resolves globally. Stage 15's **DBI-012
`UNIQUE (school_id, reference)`** makes the reference unique *within* a school — **so a global lookup is
not merely unscoped, it is ambiguous by construction.** The integration (DBT-040) identifies the tenant;
the reference is resolved within it. **This is the evidence C-41 was waiting for, and C-41 keeps its
identifier.**

**Second, and more important: a webhook must not confirm a settlement.** Stage 14 made I-2's
confirmation **API-120 under CAP-049**, a deliberate act by a finance person. The current webhook calls
`confirmPayment` directly — **an unauthenticated-by-session, externally triggered path into the atomic
invariant**, reached with no capability, no context and no tenant.

```
provider_event  (DBT-041)     a SIGNAL: money appears to have arrived
        │                     recorded, de-duplicated, tenant-bound
        │                     NO allocation · NO stock movement · NO notification of settlement
        ▼
finance person, CAP-049       API-120 · the human confirmation
        ▼
I-2                           one transaction, one commit          (Stage 15 DBD-030)
```

**SECAR-031 · No externally initiated request may enter the I-2 transaction.** The invariant's whole
value is that a person with the capability confirmed it. **A signal that confirms itself is not a
control that failed; it is a control that was never there.**

**SEC-D056 · The callback endpoint moves out of `message.routes.ts`** — **C-29**, already carried,
resolved structurally by Stage 13's module boundaries (MOD-015 owns integration).

---

## 28. Idempotency and replay, generally

**SEC-D057 · Replay defence is a property of every externally initiated state change, not a feature of
one endpoint**

Stage 15's DBD-031 gives the generic mechanism (`idempotency_keys`, DBT-070, DBI-016) plus
operation-specific uniqueness. Stage 16 states where replay defence is **required**:

| Path | Mechanism |
|---|---|
| provider callback | signed timestamp + `DBI-021` (§27) |
| TOTP verification | `mfa_last_counter` (§12.2) |
| reset-token redemption | partial unique on redemption (§13.2) |
| link-code redemption | transactional single-use (§15) |
| settlement confirmation | **DBI-014** — the index refuses the second |
| any client retry | `idempotency_keys` + `request_fingerprint` |

**SEC-D058 · `request_fingerprint` is a hash of a canonical form, and the canonicalisation is
specified**

Stage 15 left this to Stage 16. The canonical form is: **the raw request bytes**, the method, and the
resolved path — hashed with SHA-256. **Not a re-serialised object**, for exactly the reason §27.1
gives. The same rule produces both the idempotency fingerprint and the webhook signature input, and
**one rule with two uses is one thing to get right.**

---

## 29. Secrets

**SEC-D059 · A secret is never in the repository, never in a migration, never in a database column, and
never in a log**

`migrations/001_console_hardening.sql` contains two `REPLACE_ME` password placeholders and a header
saying *"Run ONCE against production, as the Neon project owner"*. **The placeholders are the correct
handling** — the file does not contain the secrets. **The problem is the file's position, not its
contents**, and that is C-19/C-73/C-78, already carried.

| Secret | Where it lives | Rotation |
|---|---|---|
| `SESSION_SECRET` | deployment secret store | rotation signs everyone out; **supported via a secret list, old secrets accepted for verification only** |
| `DATABASE_URL`, `CONSOLE_RO_*`, `CONSOLE_RW_*` | deployment secret store | Stage 21 |
| `PAYMENT_WEBHOOK_SECRET` | deployment secret store | dual-secret window during rotation |
| `CRON_SECRET` | deployment secret store | as above |
| **MFA encryption key** | deployment secret store | `mfa_key_id` makes rotation incremental (SEC-D022) |
| `RESEND_API_KEY` | deployment secret store | |

**SEC-D060 · Session-secret rotation accepts a list, in order**

`express-session` accepts an array of secrets: the first signs, all verify. **Rotation without signing
every user out is otherwise impossible**, which is why rotation does not happen.

**SECAR-032 · No secret is ever compared with `===`.** Every secret comparison uses a constant-time
function. `cron.routes.ts` already does (`timingSafeEquals`) and `paymentIntegration.ts` already does
(`crypto.timingSafeEqual` with a length pre-check, which is correct). **Preserved as a requirement so a
new comparison does not regress it.**

---

## 30. Environment validation

**SEC-D061 · Every variable the server reads is declared in the validated schema, and the schema is the
only reader**

`env.ts` states the rule — *"Import `env` instead of `process.env.*` throughout the server"* — and
**nine variables violate it**, read from raw `process.env` and absent from the schema:

```
STORAGE_DRIVER          PUBLIC_APP_URL         EMAIL_FROM        EMAIL_API_KEY
DATABASE_SSL_STRICT     CONTACT_INBOX_EMAIL    REPL_ID
CRON_SECRET             ◄── authenticates the scheduler
ALLOW_TEST_SUPERUSER    ◄── grants an account EVERY role the platform defines
```

**The two that matter most are the two with no validation at all.** → **C-82**.

**SEC-D062 · Three variables have production-refusing rules, enforced at startup**

| Variable | Rule |
|---|---|
| `ALLOW_TEST_SUPERUSER` | **the value `true` is rejected when `NODE_ENV === "production"` — the application does not start** |
| `CRON_SECRET` | required in production, minimum 32 characters |
| `APP_BASE_URL` | **required in production**, validated as a URL (§14, C-84) |

**A refusal to start is the right failure.** A production deployment carrying
`ALLOW_TEST_SUPERUSER=true` today starts normally and offers a universal superuser to any account
holding one database row — and `isTestModeEnabled()` additionally returns `true` for **any**
`NODE_ENV` that is not exactly `"production"`, so a preview or staging environment enables it by
default.

**SECAR-033 · `env.ts` is the only module in `server/` that reads `process.env`**, enforced by the same
mechanism Stage 13 uses for its other structural rules (APP-047's project scopes plus lint), not by
review.

---

## 31. Logging

**SEC-D063 · What may never be logged is a list, not a principle**

The current request logger is correct and its comment says why: *"Log only method, path, status, and
duration. Never log response bodies — they contain PII, tokens, and reset links."* **That is exactly
right, and one line elsewhere in the codebase does the thing it warns against.**

**The prohibited list — a reviewer checks a log line against this:**

| Never logged |
|---|
| a password, in any form |
| a password hash |
| an MFA secret, a TOTP code, or a recovery code |
| a session identifier or a session cookie |
| a reset link, an invite link, a link code, or any URL containing a token |
| a signed object URL |
| a provider secret, an API key, or a database URL |
| a full request or response body |
| a child's name, date of birth, or any identifying detail, in an operational log |
| a guardian's email or telephone number |
| a payment reference together with an amount and a name |
| a raw provider payload |

**SEC-D064 · A log line identifies a person by identifier, never by personal data**

The session already caches `username` for the console audit trail with a comment noting that *"a UUID
in an audit log is not an answer to 'who did this?'"* — **which is a fair point about audit
readability**, and it is resolved by the audit **view** joining the identifier to a name at read time,
under the reader's own authority, rather than by the log line carrying the name.

**SECAR-034 · Logs are a personal-data store and appear in §39's map, with a retention period Stage 18
sets.** A log that is kept forever is a personal-data archive nobody has assessed.

---

## 32. Errors

**SEC-D065 · The global error handler is the only path that formats an error, and no route formats its
own**

`app.ts`'s handler is correct: a correlation id returned, the detail logged against it, `err.message`
withheld on 5xx, 4xx messages surfaced because *"4xx messages are written by us"*.

**Individual routes bypass it.** `message.routes.ts` and `mfa.routes.ts` both `catch (e: any)` and reply
`res.status(500).json({ message: e.message })` — which returns exactly what the global handler exists to
withhold: PostgreSQL table, column and constraint names, and occasionally row values. **This is C-70**,
already carried.

```
TARGET
  a route handler THROWS.  It does not reply with an error.
  the global handler formats every error, once, in one shape (Stage 14's error contract).
```

**SECAR-035 · The correlation id is the only diagnostic a client receives, and it is enough for support
to find the detail.** This requires the id to be in the log line, which it is.

**SECAR-036 · An authorisation failure returns one shape regardless of cause.** Stage 14 fixed this:
"does not exist", "exists but is another tenant's" and "exists, yours, but you lack the capability"
are indistinguishable to the caller. **The distinction is in the audit record, not in the response.**

---

## 33. Audit as a security control

**SEC-D066 · Stage 16 states what must be auditable; Stage 19 owns the record's shape**

Stage 15 deferred `audit_events`, `console_operations` and `message_audit_logs` to Stage 19 without DBT
identifiers, and that boundary holds. Stage 16 contributes the **security requirement list** that Stage
19's schema must satisfy.

**Every one of these produces a record:**

```
AUTHENTICATION   sign-in success · failure with reason · lockout · MFA challenge · MFA success
                 MFA failure · recovery-code use · sign-out · session revocation
CREDENTIALS      password change · reset requested · reset completed · MFA enrolled · MFA disabled
AUTHORITY        authority granted · revoked · membership created · removed · context switch
                 (simulated switches distinguishable from real ones — BR-015)
TENANT           support engagement start/end · break-glass elevation/end · every typed operation
MONEY            settlement confirmation · rejection · charge decision · supersession
CUSTODY          hand-over · correction · exception raised/resolved
PRIVACY          DSAR received · export produced · erasure executed · retention deletion
PLATFORM         tenant created · suspended · purge requested · purge executed
```

**SEC-D067 · An audit write that fails is not swallowed**

`auditLog()` today ends in `catch (e) { console.error("Audit log failed:", e) }`. **An audit that can
fail silently is not an audit.**

| Class | Behaviour on audit failure |
|---|---|
| **security-critical** — authority change, break-glass, money, purge | **the operation fails.** The audit write is inside the operation's transaction |
| operational — a read, a navigation | recorded best-effort, **and the failure itself is counted and alerted** |

**The split is deliberate.** Making every audit write blocking would make the product fragile; making
none of them blocking means the highest-consequence actions are the ones with no guaranteed record.
**Stage 19 may narrow this list; it may not remove the guarantee for the first class.**

**SECAR-037 · An audit record is written in the same transaction as the act it records, for the
security-critical class.** Stage 13's APP-048 already puts the command in charge of the transaction, so
this is a placement rule, not a new mechanism.
---

## 34. Privacy — the personal data map

**No legal conclusion is drawn in this section.** It records what personal data the system holds, where
it is, who can reach it, and what mechanisms exist to act on it. **Whether the processing is lawful,
and on what basis, is BytHub Legal's determination.**

**SD-10 · Where personal data lives**

```
CHILDREN                 children · class_memberships · requirement_items · allocations
                         custody_events · handover_events · replacement_requests
                         import_rows  ◄── raw spreadsheet contents, the densest concentration
                         object_uploads  ◄── if a school uploads a photograph

GUARDIANS / FAMILIES     guardians · families · guardian_child_relationships
                         child_link_codes · notification_preferences · messages
                         money_events · payment_references

STAFF                    persons · credentials · school_memberships · authority_grants
                         class_staffing · every *_by_person_id column in every event table

EVERYONE                 notifications · delivery_attempts · user_sessions
                         audit_events (Stage 19) · application logs (§31)

PUBLIC BY CHOICE         site_contact · site_media_links → published objects
                         ◄── a school publishes these; a child is never in this class
```

**SEC-D068 · Every `*_by_person_id` column is personal data, and the event tables are the largest
holding**

The custody chain records who handed what to whom and when, for every child, for years. **That is its
purpose and it is why the chain is append-only.** It is also the most sensitive derived dataset in the
product, and §37's erasure design has to reckon with it rather than pretend it is metadata.

**SECAR-038 · A new column holding personal data requires an entry in this map.** A map that is not
maintained is worse than none, because it invites reliance.

---

## 35. Children's data

**SEC-D069 · Every default concerning a child is the protective one, and no setting makes it less so**

| Rule | |
|---|---|
| a child's record is never in a public class | §34's map; the PUBLICATION policy (Stage 15 §7.6) does not touch a child table |
| a child's record is never reachable by an identifier alone | SEC-D016 — `Resolved<T>` re-checks ownership |
| a guardian sees their own children — **SC-4**, from `guardian_child_relationships` (DBI-007), not from a claim | |
| a teacher sees their assigned classes — **SC-3**, from `class_staffing`, and **CD-5** blocks their own child | |
| a child's data is never used to train anything, never sent to an analytics service, never in a third-party client-side script | §41 |
| a child's photograph, if a school stores one, is an object requiring a signed URL — never a public path | §25 |
| a child has no account, no login and no credential | **the product's design already ensures this** |

**SEC-D070 · A child is a person the product knows about, not a user of it**

This matters for §37: **a child is a data subject with no way to exercise their own rights in the
product, so every right is exercised through the school or the guardian.** The mechanism is therefore
an administrative one, not a self-service screen, and it must be built as such.

**SECAR-039 · Import staging is the highest-risk personal-data store and has the shortest life.**
`import_rows` (DBT-073) holds raw spreadsheet contents — often more fields than the product uses, and
occasionally fields nobody intended to send. **Stage 18 sets the retention window; Stage 16 requires
that the window is short, that the uploaded source object is deleted on commit, and that an abandoned
session is purged rather than kept.**

---

## 36. Roles and lawful basis

**SEC-D071 · The role split is stated as the architecture implies it; the legal characterisation is
Legal's**

```
BytHub Technology Ltd      operates the platform
each school                decides what pupil data is collected and why
```

**The architecture is built as though the school is the controller for pupil, guardian and staff data,
and BytHub is the processor**, with BytHub as controller for its own account and billing data. **This
document records that as the shape the system is built to; it does not assert it as a legal
conclusion.** SECAR-040 requires the position to be settled before go-live, and it is one of the
14 domains the Legal & Compliance block covers.

**SECAR-040 · Every technical mechanism a data-processing agreement would require exists, and is named
here:** instruction-only processing (support mode, §17), confidentiality (§2, §31), security measures
(this document), sub-processor register (§41), assistance with data-subject rights (§37), breach
notification support (§42), deletion or return at end of contract (CAP-092 `purge_tenant`), and audit
support (§33).

**SEC-D072 · The product collects the minimum, and each field's presence is justifiable**

Stage 15 already removed several concentrations — the `users` decomposition, the branding split, the
allocation decomposition. **Stage 16 adds a standing requirement: a field is added because a locked
business rule needs it, not because a form had room.** `import_rows.raw` is the exception that proves
it — it holds whatever a school's spreadsheet contained, which is why §35 gives it the shortest life in
the system.

---

## 37. Data-subject rights

**SD-11 · A request, end to end**

```
request arrives (guardian · staff member · school on behalf of a child)
        │
   1  IDENTITY VERIFIED        an authenticated session, or an out-of-band check by the school
   2  SCOPE RESOLVED           which person, which school, which period
   3  CAPABILITY               a DSAR is a capability under Stage 7 — never an ad-hoc query
   4  ACT                      access · rectification · erasure · portability · restriction
   5  RECORD                   audited (§33); the record itself holds no exported content
   6  RESPOND                  within the statutory period BytHub Legal specifies
```

**SEC-D073 · Access and portability are produced by a typed export, not by a database dump**

The export is built from a named field list per data class — the same discipline as Stage 14's support
projections. **A dump would include other people's data**: a message thread has two participants, a
custody event names a staff member as well as a child, a money event has a payer and a beneficiary.
**The export contains the subject's data and the parts of shared records that are theirs.**

**SEC-D074 · Erasure is anonymise-in-place for a person and deletion for a tenant purge**

Stage 15 §38 fixed the map. Stage 16 states the reasoning as a privacy decision:

| | Person erasure | Tenant purge |
|---|---|---|
| the person's row | **anonymised, retained** | n/a — persons are global |
| credentials | **deleted** | n/a |
| messages | **body redacted, row retained** | deleted |
| custody and hand-over events | **retained**, person identifiers anonymised at the person row | deleted |
| money events and applications | **retained** — statutory financial record | deleted after Stage 18's window |
| import rows | **deleted** | deleted |
| logs | per §31 and Stage 18's window | deleted |

**Anonymise-in-place is chosen because deleting a person's row destroys other people's records.** A
custody event with no actor is not a preserved record with a gap; it is a broken evidence chain for a
child who has nothing to do with the erasure request.

**SEC-D075 · Erasure and financial retention conflict, and Stage 16 does not resolve it either**

Stage 15 raised this as **C-79** and escalated it. Stage 16 confirms the conflict is real and adds the
security-side detail — the same person appears in `guardians`, in `messages`, and in `money_events`,
and the three have incompatible obligations. **C-79 keeps its identifier and stays open.** Its owner is
BytHub Legal, with Stage 18 setting whatever window the resolution implies. **Presenting it as a
technical choice would misrepresent it, so it is escalated rather than put to the owner as a product
question.**

**SECAR-041 · Rectification reaches derived data.** Correcting a child's name must update everywhere it
is denormalised — and Stage 15's design deliberately minimises denormalisation, which is what makes
this feasible. **A price snapshot on a requirement line is not rectified**, because it records what was
true then; rectification applies to identity, not to history.

**SECAR-042 · A restriction request is expressible.** A person's data may be marked restricted —
retained, not processed, not exported to a provider, not included in a notification. Today no such
state exists.

---

## 38. Retention

**SEC-D076 · Stage 16 states which clock each class runs on; Stage 18 sets every number**

| Class | Clock |
|---|---|
| session records | absolute lifetime (§8.2) |
| rate-limit rows | the window, plus cleanup |
| idempotency records | a short operational window |
| import sessions and rows | **shortest in the system** (§35) |
| notifications and delivery attempts | operational |
| messages | the school's academic relationship |
| custody and hand-over events | the child's relationship with the school, plus a dispute window |
| money events and applications | **statutory financial retention** |
| audit events | **Stage 19 and the compliance requirement**, whichever is longer |
| application logs | operational, short |
| object uploads | the referencing record's clock |

**SECAR-043 · Retention deletion runs as a job (DBT-069), is audited, and is not a manual script.** A
retention rule executed by someone remembering is not a rule.

---

## 39. Logs and derived stores are in scope

**SEC-D077 · Every derived store holding personal data is named, retained and erasable**

The stores people forget: **application logs**, **the session store**, **email provider logs at the
sub-processor**, **object-store access logs**, **database backups**, and **error correlation records**.

| Store | In §34's map | Erasable |
|---|---|---|
| application logs | **yes** | by retention only — **so §31's prohibitions are the control** |
| session store (DBT-075) | yes | yes, immediately |
| provider logs | **register in §41**; the DPA governs | via the provider |
| object store | yes | yes |
| **backups** | **yes** | **not selectively** — see below |

**SEC-D078 · Backups are not selectively erasable, and the position is stated rather than fudged**

A backup is a point-in-time copy; a person erased today remains in yesterday's backup until it expires.
**The honest position is: erasure applies to live systems immediately and to backups by expiry**, the
backup window is documented, backups are encrypted and access-controlled, and **a restored backup
re-applies the erasure log before the system returns to service.**

**This last requirement is the one that is usually missing**, and without it a restore silently
resurrects erased people.

---

## 40. Third parties and sub-processors

**SEC-D079 · The register is short by design, and every entry is justified**

| Party | Purpose | Personal data | Notes |
|---|---|---|---|
| **Neon** | PostgreSQL | **all of it** | Stage 11; region is **C-63**, target resolved, implementation open |
| **Vercel** | hosting, logs | request metadata, **whatever §31 permits into logs** | Stage 11 |
| **Resend** | transactional email | recipient address, message contents | §16 |
| object store | files | uploads | **Stage 21 selects; Stage 16 requires the properties** |
| breached-password corpus | §6.3 | **none** — k-anonymity sends five hash characters | no account data leaves |
| malware scanner | §24 | file bytes | **Stage 21 selects**; an on-premise scanner avoids the transfer entirely |

**SECAR-044 · No third-party analytics, session-replay, advertising or tag-manager script runs in the
authenticated application or on the public school site.** Session replay in a product handling
children's records would record children's records. **The CSP in §21 enforces this**, so it is
structural rather than a policy nobody re-checks.

**SECAR-045 · Processing region is settled before go-live.** **C-63** already records that the region is
not configured. Data about UK schoolchildren processed outside the UK is a transfer question, and it is
Legal's, but **the technical configuration that makes the answer possible is Stage 21's and it is
currently absent.**

---

## 41. Breach detection and response

**SEC-D080 · Stage 16 states what must be detectable; the response process is BytHub's**

Detection is a design property: an event that leaves no trace cannot be detected later. **The audit
requirements in §33, the fail-open counters in §22, and the notification-failure records in §17 exist
partly for this.**

**Detectable by design:**

```
credential stuffing            failure counters per account and per IP  (§7)
a compromised staff account    login from a new context · authority change · bulk read volume
tenant boundary failure        an RLS denial is an ALERT, not a log line — it means a layer failed
support misuse                 every engagement and typed operation recorded  (§17)
break-glass misuse             elevation records + other owners notified      (§18)
provider callback abuse        signature failures counted; replay attempts counted (§27)
mass export                    DSAR exports and support projections are audited (§33, §37)
```

**SECAR-046 · An RLS policy denial is treated as a security event.** Under Stage 15's design, correct
application code never triggers one — the application's own scoping should already have excluded the
row. **A denial therefore means a layer above the database failed**, and that is exactly the event
worth alerting on. Today, with no RLS, this signal does not exist at all.

**SECAR-047 · A breach-notification obligation needs the personal-data map (§34) and the audit record
(§33) to answer "whose data, and what was reached".** Those two artefacts are the technical
prerequisites for the 72-hour obligation the audit cites; **whether and when to notify is Legal's.**

---

## 42. Verifying the controls

**SEC-P17 requires every control to name how it is tested.** Stage 11 recorded **C-60** — there is no
test framework behind the locked invariants — so this section is a requirement on Stage 22 and beyond,
not a claim about today.

**SEC-D081 · Each control class names its verification, and a control with none is not shipped**

| Control | Verified by |
|---|---|
| password hashing and rehash-on-login | unit test: a bcrypt credential verifies, is rehashed, and the algorithm column changes |
| durable lockout | integration test across simulated instances |
| session revocation on password change | integration test: session A resets, session B is refused on its next request |
| TOTP replay | **the regression test for C-21**: the same code twice, second rejected |
| MFA secret encryption | test that the stored column is not the secret |
| authority version invalidation | revoke, then assert the next request is refused |
| **tenant isolation** | **the highest-value test in the suite**: a scoped connection for school A asks for a known row of school B and gets nothing, at the database level, with the application bypassed |
| RLS context absence | a query on a connection with no `SET LOCAL` returns nothing, and raises the alert |
| CSRF | a cross-origin and a same-site forged request are both refused |
| CSP | an automated header assertion per environment |
| webhook signature | a byte-exact fixture; a re-serialised body must **fail** |
| webhook replay | the same signed request twice; second is a no-op |
| upload trust states | an HTML file renamed `.png` is rejected at magic-byte detection |
| log prohibitions | an automated scan of log output in CI against §31's list |
| error disclosure | a forced database error returns a correlation id and no detail |
| environment refusal | `ALLOW_TEST_SUPERUSER=true` with `NODE_ENV=production` **fails to start** |

**SECAR-048 · A penetration test is performed against the built system before go-live, by someone who
did not build it.** This document is a design; **a design review is not a penetration test**, and the
Legal & Compliance block requires a clean re-audit signed by both the Cybersecurity Director and the
Legal Department. **Stage 16 cannot substitute for either.**

**SECAR-049 · The baseline test runs remain outstanding.** `npm run check`, `test:smoke`, `build`,
`test:custody` and `npm test` have still not been run natively. **Everything in §2 is E2 evidence — read
directly, not executed** — and this document says so wherever it makes a claim about current behaviour.
---

## 43. Decision index — SEC-D001 … SEC-D088

**SD-12 · The whole control set, arranged by what it defends**

```
IDENTITY          D002 D003 D004 D005 D006 D007 D008 D009
SESSION           D010 D011 D012 D013 D014 D015
AUTHORITY         D016 D017 D018
MFA               D019 D020 D021 D022 D023
RECOVERY          D024 D025 D026 D027 D028 D029 D030
PLATFORM ACCESS   D031 D032 D033 D034
BROWSER           D035 D036 D037 D038 D039
ABUSE             D040 D041 D042
INPUT / OUTPUT    D043 D044 D045 D046 D047 D048
OBJECTS           D049 D050 D051 D052
INTEGRATION       D053 D054 D055 D056 D057 D058
CONFIGURATION     D059 D060 D061 D062
OBSERVABILITY     D063 D064 D065 D066 D067
PRIVACY           D068 … D080
VERIFICATION      D081
OWNER DECISIONS   D087 (SECQ-2 = A)   D088 (SECQ-1 = B)
SECOND PASS       D082 D083 D084 D085 D086
```

| SEC-D | Decision | § |
|---|---|---|
| SEC-D001 | four trust boundaries, one mechanism each | 4 |
| SEC-D002 … SEC-D003 | credentials hold no authority; the field list is closed | 5 |
| **SEC-D004** | **Argon2id, m=64 MiB t=3 p=1, parameters stored beside the hash** | 6 |
| **SEC-D005** | **high-entropy tokens use SHA-256, not a password hash** | 6 |
| SEC-D006 | length over composition; breach check; no scheduled rotation | 6 |
| **SEC-D007** | **rehash on next login — never a bulk rewrite, never a forced reset** | 6 |
| SEC-D008 … SEC-D009 | three limit dimensions; unlock by time or recovery, never by support | 7 |
| SEC-D010 | the session holds continuity, not authority | 8 |
| SEC-D011 | lifetime by authority held, plus an idle timeout | 8 |
| SEC-D012 | the session identifier rotates on every privilege change | 8 |
| **SEC-D013** | **authority resolved per request; any cache keyed by `authority_version`** | 9 |
| **SEC-D014** | **a password or MFA change destroys every other session** | 9 |
| SEC-D015 | explicit revocation exists and is a capability | 9 |
| **SEC-D016** | **scope and conditions operate on a RESOLVED resource, never a claimed id** | 10 |
| SEC-D017 | a condition names the data it reads and reads it in-request (CD-5) | 10 |
| **SEC-D018** | **the test account cannot exist in production — startup refuses** | 10 |
| **SEC-D019 … SEC-D020** | **maintained TOTP library; a code is CONSUMED on use** | 12 |
| **SEC-D021 … SEC-D022** | **MFA secrets encrypted at rest, with incremental key rotation** | 12 |
| SEC-D023 | disabling MFA is sensitive, notified, and version-bumping | 12 |
| SEC-D024 | a reset is its own record, not an invitation with a magic role | 13 |
| **SEC-D025 … SEC-D026** | **a URL containing a credential is never logged, for the whole class** | 13 |
| **SEC-D027** | **the public base URL is configuration; no header fallback** | 14 |
| SEC-D028 … SEC-D029 | link codes and invitations are credentials; an invite grants membership, never authority | 15 |
| SEC-D030 | email is a channel, never a store and never an authority | 16 |
| SEC-D031 … SEC-D032 | support reads typed projections only; PA-2 stands, support never sets a credential | 17 |
| SEC-D033 … SEC-D034 | console enforcement stays in PostgreSQL; elevation is durably recorded | 18 |
| SEC-D035 | `SameSite=Strict` kept, double-submit token added | 19 |
| SEC-D036 | no CORS — stated as a decision, not left as an absence | 20 |
| **SEC-D037** | **`'unsafe-inline'` removed from production `script-src`; nonces** | 21 |
| SEC-D038 … SEC-D039 | remaining directives tightened; HSTS kept, `preload` deferred to Stage 21 | 21 |
| **SEC-D040** | **the limiter's table is created by migration, never by application DDL** | 22 |
| SEC-D041 | read limits exist; public endpoints are covered | 22 |
| **SEC-D042** | **fail-open kept for throughput, counted and alerted; NOT for authentication** | 22 |
| SEC-D043 … SEC-D045 | schema at the edge; `ClaimedId` ≠ `Resolved`; no `dangerouslySetInnerHTML` | 23 |
| SEC-D046 … SEC-D048 | four upload trust states; declared type never trusted; attachment by default | 24 |
| SEC-D049 … SEC-D050 | signed URLs after an authority check; a separate public media class | 25 |
| SEC-D051 … SEC-D052 | structured sections, no sanitiser; publication is capability + entitlement + state | 26 |
| **SEC-D053** | **a signature is verified over the exact bytes received** | 27 |
| **SEC-D054** | **every provider callback carries an enforced timestamp and event id** | 27 |
| **SEC-D055** | **a provider signal is tenant-bound and NEVER confirms a settlement** | 27 |
| SEC-D056 | the callback leaves the messaging module | 27 |
| SEC-D057 … SEC-D058 | replay defence is a property of every external state change; canonicalisation specified | 28 |
| SEC-D059 … SEC-D060 | secrets never in repo, migration, column or log; session-secret rotation by list | 29 |
| **SEC-D061 … SEC-D062** | **every variable is in the validated schema; three refuse to start in production** | 30 |
| **SEC-D063 … SEC-D064** | **the prohibited-log list; a log line identifies by id, not by personal data** | 31 |
| SEC-D065 | one error formatter; a route throws, it does not reply | 32 |
| **SEC-D066 … SEC-D067** | **the auditable-event list; a security-critical audit failure fails the operation** | 33 |
| SEC-D068 … SEC-D070 | the personal-data map; every child default is protective; a child is not a user | 34–35 |
| SEC-D071 … SEC-D072 | the controller/processor shape, stated not concluded; minimisation | 36 |
| SEC-D073 … SEC-D075 | typed export; anonymise-in-place vs purge; **C-79 stays open** | 37 |
| SEC-D076 | Stage 16 names the clock, Stage 18 sets the number | 38 |
| SEC-D077 … SEC-D078 | derived stores are in scope; **a restore re-applies the erasure log** | 39 |
| SEC-D079 … SEC-D080 | a short sub-processor register; what must be detectable | 40–41 |
| SEC-D081 | every control names its verification | 42 |
| **SEC-D082** | **a recovery code is a ROW; single-use is a conditional `UPDATE`, not a JS filter** | 12.5 |
| **SEC-D083** | **the enrolment secret is never written to the session store** | 12.5 |
| **SEC-D084** | **a credential change is ONE transaction on a transaction-capable connection** | 13.3 |
| **SEC-D085** | **a credential write is durable or it fails — never process memory** | 13.3 |
| **SEC-D086** | **every MFA lifecycle transition re-authenticates** | 12.5 |
| **SEC-D087** | **MFA is required by AUTHORITY exercised, never by role string — SECQ-2 = A** | 12.4 |
| **SEC-D088** | **AUTH-FAMILY: 7 days absolute, 7 days idle — SECQ-1 = B** | 8.2 |

---

## 44. Requirement index — SECAR-001 … SECAR-053

Requirements are the things that must be **true of the built system**. A decision can be revisited with
an amendment; **a requirement failing is a defect.**

| Range | Subject |
|---|---|
| SECAR-001 … SECAR-002 | no header influences authority; no credential field ever leaves the server |
| SECAR-003 … SECAR-006 | server-side policy; bounded bcrypt tail; uniform login responses; **timing levelled** |
| SECAR-007 | **no capability check is satisfied by a role string** |
| SECAR-008 … SECAR-010 | `SET LOCAL` on every scoped query; policies reviewed as security code; support never bypasses RLS |
| SECAR-011 … SECAR-012 | enrolment requires the current password; recovery codes single-use and notified |
| SECAR-013 … SECAR-014 | concurrent redemption cannot both succeed; a password change is notified |
| SECAR-015 … SECAR-016 | one authoritative base URL; a link code never travels with the record it unlocks |
| SECAR-017 … SECAR-018 | a failed send never changes an outcome; a support engagement is visible to its tenant |
| SECAR-019 … SECAR-021 | console controls depend on an applied migration (**C-73**); elevation failures recorded; the CSRF exemption list is closed |
| SECAR-022 … SECAR-024 | a cross-origin consumer needs an amendment; negative lookups cost the same; public reads are limited |
| SECAR-025 … SECAR-030 | allowlist validation; no injection surface; opaque object keys; the email-logo rule; no tenant code path; public contact fields only |
| SECAR-031 | **no externally initiated request enters the I-2 transaction** |
| SECAR-032 … SECAR-034 | constant-time secret comparison; `env.ts` is the only `process.env` reader; logs are a personal-data store |
| SECAR-035 … SECAR-037 | the correlation id suffices; one shape for every authorisation failure; security audits share the operation's transaction |
| SECAR-038 … SECAR-039 | the data map is maintained; import staging is shortest-lived |
| SECAR-040 … SECAR-043 | every DPA mechanism exists; rectification reaches derived data; restriction is expressible; retention runs as a job |
| SECAR-044 … SECAR-045 | no analytics or session replay anywhere; the processing region is settled (**C-63**) |
| SECAR-046 … SECAR-047 | **an RLS denial is a security alert**; breach questions are answerable from the map plus the audit |
| SECAR-048 … SECAR-049 | an independent penetration test before go-live; **the baseline remains UNVERIFIED at E2** |
| **SECAR-050** | **the MFA requirement is read from the credential at request time, never from `session.mfaEnabled`** |
| **SECAR-051 … SECAR-053** | **every single-use credential is enforced single-use by the database; no credential secret is written to the session store; the memory fallback is unreachable from every credential path** |

---

## 45. Risks — SEC-R001 … SEC-R024

| SEC-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **SEC-R001** | A reset link in a log is an account-takeover primitive **available today** | **CRITICAL** | SEC-D025 removes the line; **C-18** |
| **SEC-R002** | Plaintext MFA secrets mean a database read yields every owner's second factor | **CRITICAL** | SEC-D021; **C-21** |
| **SEC-R003** | An externally triggered webhook can confirm money with no capability and no tenant | **CRITICAL** | SEC-D055, SECAR-031; **C-41 · C-80 · C-81** |
| **SEC-R004** | `ALLOW_TEST_SUPERUSER` is unvalidated, and test mode defaults on for any non-production `NODE_ENV` | **CRITICAL** | SEC-D018, SEC-D062; **C-82** |
| **SEC-R005** | Session-cached authority survives revocation | **HIGH** | SEC-D013; **C-67** |
| **SEC-R006** | A password reset leaves the attacker's session alive | **HIGH** | SEC-D014; **C-85** |
| **SEC-R007** | TOTP replay within a 90-second window | **HIGH** | SEC-D020; **C-21** |
| **SEC-R008** | Production CSP permits arbitrary inline script | **HIGH** | SEC-D037; **C-83** |
| **SEC-R009** | A reset link's host can come from a request header | **HIGH** | SEC-D027; **C-84** |
| **SEC-R010** | The console's controls depend on a migration that may not be applied | **HIGH** | SECAR-019; **C-73**, Stage 21 |
| **SEC-R011** | RLS depends on `SET LOCAL` on every scoped connection | **CRITICAL** | Stage 15 DBR-001/002; A13-001; SECAR-008 |
| **SEC-R012** | Rehash-on-login leaves a long bcrypt tail | **MEDIUM** | SECAR-004 — report, then disable, never leave |
| **SEC-R013** | Argon2id's 64 MiB bounds serverless login concurrency | **MEDIUM** | stated as the control working (SEC-D004); Stage 20 measures |
| **SEC-R014** | Per-request authority resolution costs seven table reads | **MEDIUM** | the versioned cache (SEC-D013); Stage 20 measures |
| **SEC-R015** | A public endpoint permits school-code enumeration | **MEDIUM** | SEC-D041, SECAR-024 |
| **SEC-R016** | Erasure and financial retention conflict | **HIGH** | **C-79** — open, owned by Legal and Stage 18 |
| **SEC-R017** | Backups resurrect erased people on restore | **HIGH** | SEC-D078 — the erasure log is re-applied before return to service |
| **SEC-R018** | No test framework stands behind any of this | **HIGH** | **C-60**; SEC-D081 names every verification so Stage 22 has a list |
| **SEC-R019** | A recovery code can authenticate twice, or be resurrected, under concurrency | **CRITICAL** | SEC-D082 · DBT-077 · **C-87** |
| **SEC-R020** | An abandoned enrolment leaves a live TOTP secret in the session store for the session's whole life | **HIGH** | SEC-D083 · **C-88** |
| **SEC-R021** | A partially applied reset changes the password and leaves the link redeemable | **HIGH** | SEC-D084 · **C-89** |
| **SEC-R022** | A credential write can report success and durably change nothing | **HIGH** | SEC-D085 · SECAR-052 · **C-71** |
| **SEC-R023** | SECQ-1 = B pushes more guardians through a reset flow that still carries C-18, C-84 and C-89 | **HIGH** | the four are prioritised, and §46 records the causal link rather than leaving it implicit |
| **SEC-R024** | SECQ-2 = A enlarges the population enrolling MFA while C-90 leaves enrolment unauthenticated | **HIGH** | SEC-D086 ships **before** the grace period ends; stated as a sequencing constraint, not an aspiration |

---

## 46. Owner decisions — RESOLVED

Both questions this stage raised have been decided by the owner. **They are recorded here as answers,
with what each one costs, and they are not reopened.**

---

### SECQ-1 · How long may a guardian stay signed in? — **DECIDED: B**

```
AUTH-FAMILY     7 days absolute
                7 days idle
                sensitive actions require re-authentication
```

**Applied at §8.2 and SEC-D088.** The 30-day session is withdrawn.

**What this costs, stated plainly.** A guardian uses the product a few times a term, so in practice most
visits will begin at the sign-in screen, and a share of those will begin at the *password reset* screen.
**SECQ-1 = B therefore makes the reset flow a higher-traffic path than it is today** — and that flow is
the one carrying **C-18** (the link in the log), **C-84** (the host from a header), **C-89** (the
non-atomic write) and C-71's credential instance. **The decision raises the priority of those four
rather than changing them**, and this document says so rather than presenting a security improvement
with no consequences.

**Sensitive actions re-authenticate under this option exactly as under the others:** changing a
password, changing an email, linking a child, and viewing full payment history.

---

### SECQ-2 · Is MFA mandatory for school administrators and finance staff? — **DECIDED: A**

```
MFA is mandatory when AUTH-SCHOOL or AUTH-FINANCE is exercised
     — in addition to AUTH-PLATFORM and AUTH-BREAKGLASS, which are already mandatory
     — evaluated against the AUTHORITY, never against a legacy role string
     — with a dated per-school grace period before the authority can no longer be exercised
```

**Applied at §12.4 and SEC-D087.**

**The authority-based framing is the substance of the decision, not its phrasing.** `school_admin` and
`finance` are two of the eight strings the current code compares; **AUTH-SCHOOL and AUTH-FINANCE are
what Stage 7 models.** PA-1 established that `school_admin + AUTH-FINANCE` is **one context** — so a
rule written against role strings would exempt precisely the arrangement PA-1 exists to describe.
Keying it to the authority makes it correct for every grant shape Stage 7 permits, including grants
nobody has created yet, and it is why **SECAR-007** (no capability check is satisfied by a role string)
and **SECAR-050** (the requirement is read from the credential, not from `session.mfaEnabled`) both
follow from this answer rather than merely sitting beside it.

**The adoption cost is accepted, not waved away.** Every school must enrol its office and finance staff
before the requirement bites; the grace period is dated per school and its administrator can see who has
not yet enrolled. Enrolment endpoints stay behind `requireAuth`, never `requireRole`, so **nobody can be
locked out of enrolling** — and under SEC-D086 those endpoints now re-authenticate, which they do not
today (**C-90**).

---

### What SECQ-2 = A does **not** do

**It does not close C-21.**

```
C-21    TARGET POLICY RESOLVED   ·   IMPLEMENTATION OPEN

RESOLVED by the owner        the scope question C-21 assigned to Stage 16
STILL OPEN                   mfa_secret is stored in plaintext              SEC-D021
STILL OPEN                   a TOTP code is never consumed                  SEC-D020
STILL OPEN                   the requirement is keyed to a role string      SEC-D087
STILL OPEN  (found later)    the enrolment secret sits in the session store SEC-D083 · C-88
STILL OPEN  (found later)    recovery-code single-use is not enforced       SEC-D082 · C-87
STILL OPEN  (found later)    enrolment requires no re-authentication        SEC-D086 · C-90
```

**A decision is not a remediation.** C-21 closes when those defects are fixed in code and verified by
the tests SEC-D081 names — not when this document records what the answer should be. **The second
evidence pass made C-21's implementation surface larger, not smaller**, and saying that plainly is more
useful than reporting a question answered.

**No further owner question is raised by this stage.** **C-79** (erasure against financial retention)
remains escalated to BytHub Legal and is deliberately not put as a product choice; every other point
where two designs were possible was resolved from locked evidence and recorded as a decision.

---

## 47. Conflicts

**Conflict identifiers are stable. They are never renumbered, never reused and never deleted.**

**SD-13 · The seven new conflicts, by what they let an attacker do**

```
                     ┌─ C-80  the signature verifies a reconstruction, not the message
  MONEY  ────────────┼─ C-81  a captured callback replays indefinitely
                     └─ (C-41 existing: the callback is not bound to a tenant)

  ACCOUNTS ──────────┬─ C-84  a reset link's host can come from a header
                     └─ C-85  a reset leaves the attacker's session alive

  PRIVILEGE ─────────── C-82  the switch that grants every role has no validation

  BROWSER ───────────── C-83  production CSP permits arbitrary inline script

  OPERATIONS ────────── C-86  the security layer creates its own table at request time

  ── found on the second evidence pass ──────────────────────────────────────
  SECOND FACTOR ─────┬─ C-87  recovery-code single-use is enforced by nothing
                     ├─ C-88  the enrolment secret is written to the session store
                     └─ C-90  enrolling a second factor needs no re-authentication

  ACCOUNTS ──────────── C-89  the reset write is two auto-commits, not one transaction
```

### 47.1 New conflicts raised by Stage 16

**C-80 · The payment webhook verifies its signature over a re-serialised body — ACTIVE**
*Evidence:* `message.routes.ts` — `const rawBody = JSON.stringify(req.body)`, while `app.ts`'s
`express.json` verify hook already captures the true bytes as `req.rawBody`, unused.
*Impact:* the endpoint verifies a reconstruction. Legitimate calls fail on any serialisation
difference; the control does not attest what was received.
*Resolution:* **SEC-D053.** No owner decision — there is no second valid behaviour.

**C-81 · The payment webhook has no replay defence — ACTIVE**
*Evidence:* the handler reads no timestamp, stores no nonce, and records no provider event identifier.
*Impact:* one captured valid request can be replayed to re-confirm a payment indefinitely.
*Resolution:* **SEC-D054**, using Stage 15's existing **DBI-021**.

**C-82 · Security-critical configuration bypasses the validated environment module — ACTIVE**
*Evidence:* nine variables read from raw `process.env` and absent from `env.ts`'s Zod schema, including
`ALLOW_TEST_SUPERUSER` and `CRON_SECRET`. `env.ts` states the opposite rule in its own header.
*Impact:* the switch that grants an account every role the platform defines has no validation, and
`isTestModeEnabled()` returns `true` for any `NODE_ENV` other than exactly `"production"`.
*Resolution:* **SEC-D061, SEC-D062, SECAR-033** — startup refusal.

**C-83 · The production Content-Security-Policy permits `'unsafe-inline'` in `script-src` — ACTIVE**
*Evidence:* `app.ts` — `scriptSrc: IS_PRODUCTION ? ["'self'", "'unsafe-inline'"] : [...]`, beside a
comment correctly rejecting `'unsafe-eval'` in production for the same reason.
*Impact:* the CSP does not stop the injected inline script it exists to stop.
*Resolution:* **SEC-D037** — nonces.

**C-84 · A password-reset link's host can be taken from a request header — ACTIVE**
*Evidence:* `getPublicBaseUrl` falls back to `x-forwarded-host`; `APP_BASE_URL` is `.optional()` in the
env schema, so nothing requires it in production.
*Impact:* a genuine ScholarShelf email carrying a genuine token to a host an attacker chose.
*Resolution:* **SEC-D027, SEC-D062, SECAR-015.**

**C-85 · A password reset does not invalidate the account's existing sessions — ACTIVE**
*Evidence:* `reset-password` updates the hash and marks the invite accepted; nothing touches
`user_sessions`.
*Impact:* the reason to reset a password is that someone else may have it, and afterwards they are
still signed in.
*Resolution:* **SEC-D014** via `password_changed_at`.

**C-86 · The security layer creates its own table by application DDL at request time — ACTIVE**
*Evidence:* `ensureRateLimitTable()` runs `CREATE TABLE IF NOT EXISTS rate_limits` on the request path,
after `app.ts` documents at length why startup DDL was removed.
*Impact:* the removed pattern survives in the security layer; `ACCESS EXCLUSIVE` locking and swallowed
failures both return.
*Resolution:* **SEC-D040** — Stage 15's **DBT-076**, created by **MIG-03**.

**C-87 · Recovery-code single-use is enforced by nothing — ACTIVE**
*Evidence:* `mfa.routes.ts` reads `user.mfaRecoveryCodes`, filters the matched hash in JavaScript, and
writes the array back on `getDb()` — no transaction, no predicate, no version. The line carries the
comment `// single-use`.
*Impact:* two concurrent verifications with different valid codes each write a nine-element array from
the same ten-element read, **resurrecting the loser's code**; the same code presented twice
concurrently **authenticates two sessions**.
*Resolution:* **SEC-D082** — DBT-077 rows and a conditional `UPDATE`, requiring **A15-001**.

**C-88 · The MFA enrolment secret is written to the session store — ACTIVE**
*Evidence:* `req.session.pendingMfaSetupSecret = secret`, with `connect-pg-simple` persisting
`user_sessions.sess`.
*Impact:* a live TOTP secret in plaintext in a **second** database location, outside every control built
for the first — the console's read views exclude `mfa_secret` and do not exclude `sess` — and **nothing
clears it when enrolment is abandoned**.
*Resolution:* **SEC-D083** — an encrypted DBT-077 row with a 10-minute expiry; the session carries only
an identifier.

**C-89 · The password-reset credential write is not atomic — ACTIVE**
*Evidence:* `storage.updateUser({ passwordHash })` then `storage.markInviteAccepted(...)`, two
auto-committing statements on `getDb()`. Four `.transaction(` sites exist in `server/`; none is a
credential path.
*Impact:* if the second write fails the password has changed and **the reset link is still redeemable**.
Compounded by the handle: `getDb()` is the Neon HTTP driver, which could not hold the transaction even
if one were opened (**C-74**, **A13-001**).
*Resolution:* **SEC-D084** — one transaction on a transaction-capable connection, token consumed first.

**C-90 · Enrolling a second factor requires no re-authentication — ACTIVE**
*Evidence:* `/api/auth/mfa/setup` and `/api/auth/mfa/enable` perform no password check;
`/mfa/disable` and `/mfa/recovery-codes` do.
*Impact:* a hijacked session can enrol the attacker's own authenticator without the password. On a
platform-owner account `/mfa/disable` then refuses self-service removal, so **the legitimate owner is
locked out by a control built to protect them.** **SECQ-2 = A widens the blast radius**, because
AUTH-SCHOOL and AUTH-FINANCE holders now enrol too.
*Resolution:* **SEC-D086** — password on setup and enable, password plus a current code on disable and
regenerate.

**A note on what was NOT raised.** The memory-storage fallback reached from every credential write is
**C-71**, already carried; Stage 16 records its credential-path consequence (SEC-F20, SEC-D085,
SECAR-052) and **issues no new identifier for it**.

### 47.2 Existing conflicts Stage 16 gives a target

**None of these is closed here.** Each keeps its identifier and its owner; Stage 16 supplies the design.

| Conflict | What it records | Stage 16's contribution |
|---|---|---|
| **C-18** | a live credential or link is recorded | **SEC-D025/D026** — the prohibition covers the whole class, and the line is removed rather than gated |
| **C-21** | MFA not enforced for `school_admin`/`finance`; plaintext `mfa_secret`; no TOTP replay protection | **TARGET POLICY RESOLVED · IMPLEMENTATION OPEN.** **SECQ-2 = A** answers the scope question C-21 assigned to this stage; **SEC-D020** (consume), **SEC-D021** (encrypt) and **SEC-D087** (authority-keyed) remain unimplemented, and C-87 · C-88 · C-90 enlarge its surface. **Not closed** |
| **C-41** | integration credential tenant scope **unverified** | **verified — the binding is absent.** SEC-D055 states the target. **The identifier is unchanged; only the evidence is new** |
| **C-67** | session-cached authority survives revocation | **SEC-D013** — per-request resolution with a versioned cache |
| **C-68** | a publicly mounted directory serves files without authorisation | **SEC-D049** — the mount is removed; objects are signed |
| **C-70** | internal error detail reaches clients | **SEC-D065** — a route throws; one formatter |
| **C-71** | two persistence semantics can run the same product | **SEC-D085 · SECAR-052** — the memory fallback is unreachable from every credential path; this is C-71's most severe instance |
| **C-29** | the payment webhook lives in the messaging module | resolved structurally by Stage 13's boundaries; **SEC-D056** |
| **C-60** | no test framework behind the locked invariants | **SEC-D081** names a verification per control |
| **C-63** | processing region not configured | **SECAR-045** — settled before go-live; Stage 21 |
| **C-73** | console controls depend on a migration CI skips | **SECAR-019** — the design is right; the applied state is **unverified**, and this document does not claim otherwise |
| **C-79** | erasure vs financial retention | **SEC-D075** — confirmed real, **stays open**, owned by Legal |

---

## 48. Cross-stage check and traceability

**SD-14 · What Stage 16 hands to which stage**

```
STAGE 18  every retention number named by SEC-D076 · log retention · import window
STAGE 19  audit record mechanics for SEC-D066's list · console_operations fields (SEC-D034)
          · may narrow, may not remove the security-critical guarantee (SEC-D067)
STAGE 20  measures SEC-R013 (Argon2id concurrency) and SEC-R014 (authority resolution)
STAGE 21  deployment: secret delivery · region (C-63) · scanner · object store
          · HSTS preload (SEC-D039) · applying 001_console_hardening.sql (C-73)
STAGE 22+ implementation, against SEC-D081's verification list
LEGAL     C-79 · controller/processor position (SEC-D071) · lawful basis · notification
STAGE 15  A15-001 · DBT-077 credential_tokens · DBI-031 · DBI-032
          · persons.authority_version    — recorded in DATABASE_SCHEMA.md §55
```

| Earlier locked statement | Stage 16 position | Conflict |
|---|---|---|
| Stage 7 — 95 capabilities, 12 scopes, 12 conditions, 7 authorities | **SD-4** resolves the chain per request | none |
| Stage 7 — CD-5 own-child block | **SEC-D017** — enforced at step 7, in-request | none — Stage 15 said where it is *not*, Stage 16 says where it *is* |
| Stage 7 — PA-2, recovery requires support mode | **SEC-D032** — support never sets a credential | none |
| Stage 11 — bcryptjs → Argon2id | **SEC-D004** | none — implements |
| Stage 11 — hand-rolled TOTP → maintained library | **SEC-D019**, with the current code assessed as correct | none |
| Stage 11 — no realtime infrastructure | **SEC-D038** removes `wss:`/`ws:` from `connect-src` | none |
| Stage 12 — SA-P2, the server is the authority boundary | **SEC-P1** | none |
| Stage 12 — SA-P3, a session proves continuity | **SEC-P2, SEC-D010** | none |
| Stage 12 — SA-P7, an identifier is a locator | **SEC-D016** | none |
| Stage 12 — AQ-1 = B, the public site is separate | **SECAR-023** — its own stricter CSP | none |
| Stage 13 — APP-022 `ClaimedId` → `Resolved<T>` | **SEC-D044** as a security control | none |
| Stage 13 — APP-026, tenant scope is required | **SD-5** layer 2 | none |
| Stage 13 — APP-048, the command owns the transaction | **SECAR-037** — security audits share it | none |
| Stage 14 — APIQ-1 = A, first-party only | **SEC-D036** — therefore no CORS | none |
| Stage 14 — 11 typed support projections, CAP-088 | **SEC-D031** supplies the security rationale | none |
| Stage 14 — API-120 / CAP-049 is I-2's confirmation | **SEC-D055, SECAR-031** — a webhook may not enter it | none — this is a **defect in the current code**, not a disagreement with Stage 14 |
| Stage 14 — one error shape for authorisation failure | **SECAR-036** | none |
| Stage 15 — DBD-005 Option B+ | **SD-5** layer 4; **SECAR-008/009/010** | none |
| Stage 15 — DBT-008 `credentials`, "Stage 16 owns every field's form" | **SEC-D003** fills it in | none |
| Stage 15 — DBT-075 `user_sessions`, "Stage 16 owns `sess`" | **SEC-D010** fills it in | none |
| Stage 15 — DBT-076 `rate_limits`, "Stage 16 owns the algorithm" | **SEC-D008, SEC-D040/041/042** | none |
| Stage 15 — DBI-021, DBI-014, DBI-029 | used directly by **SEC-D054, SEC-D057, SEC-D028** | none |
| Stage 15 — §38's erasure map | **SEC-D074** states its privacy reasoning; **C-79 unchanged** | none |
| Stage 15 — A13-001 | **SECAR-008** depends on it; **SEC-D084** shows a credential-path instance of the same handle problem | none |
| Stage 15 — §1.1's DBT counting rule, 76 tables | **A15-001** adds **DBT-077** and moves the count to **77** | **amended, traceably** — §49 |
| Stage 15 — DBI register, 30 entries | **A15-001** adds **DBI-031 · DBI-032**, moving it to **32** | **amended, traceably** — §49 |
| Stage 15 — DB-P19, no constraint predicate reads the wall clock | **DBI-032** compares two stored columns; `now()` appears only in the consumption statement | none — checked explicitly |
| Stage 7 — PA-1, `school_admin + AUTH-FINANCE` is ONE context | **SEC-D087** keys the MFA rule to the authority, so PA-1's arrangement is covered rather than exempted | none |

**One amendment is raised: A15-001**, recorded in full at §49 and written into `DATABASE_SCHEMA.md`
§55. **Every other position above either implements a locked decision or fills in a gap a locked stage
explicitly assigned here** — `credentials`' fields, `user_sessions.sess` contents and the rate-limit
algorithm were all assigned to Stage 16 by Stage 15's own text, so exercising those grants is not an
amendment and is not recorded as one.

**SD-15 · Traceability**

| Family | Range | Count |
|---|---|---|
| **SEC-P** principles | SEC-P1 … SEC-P20 | 20 |
| **SEC-D** decisions | SEC-D001 … SEC-D081 | 81 |
| **SECAR** requirements | SECAR-001 … SECAR-049 | 49 |
| **SEC-R** risks | SEC-R001 … SEC-R018 | 18 |
| **SECQ** owner questions | SECQ-1 = **B** · SECQ-2 = **A** | **0 open** |
| **New conflicts** | C-80 … C-90 | **11** |
| **Existing conflicts given a target** | C-18 · C-21 · C-29 · C-41 · C-60 · C-63 · C-67 · C-68 · C-70 · C-71 · C-73 · C-79 | 12 |
| **Conflicts closed** | — | **0** |
| **Diagrams** | SD-1 … SD-20 | 20 |
| **Sections** | 1 … 50 | 50 |
| **Amendments raised** | **A15-001** (Stage 15) | **1** |

**Zero conflicts are closed by this document, and that is the honest count.** A design that states a
target does not fix a defect; the code does, and the code has not been written.

---

## 49. Amendment raised against locked Stage 15 — A15-001

**SD-19 · The one table Stage 15 could not have known it needed**

```
Stage 15 shaped 76 tables and closed the count with a rule:
  "a table receives a DBT identifier IFF Stage 15 defines its physical shape"

Stage 16 then decided FOUR things that each need a single-use credential record:
  SEC-D024   a password reset is its own record, not an invitation with a magic role
  SEC-D082   a recovery code is a ROW, so single-use can be a database guarantee
  SEC-D083   a pending enrolment secret expires on its own, in 10 minutes
  SEC-D086   email verification is a separate recorded fact

  ONE SHAPE SERVES ALL FOUR  ─────────►  DBT-077  credential_tokens
```

**SEC-D089 · Four single-use credential records share one table, one uniqueness discipline and one
retention rule**

Four near-identical tables would be four places to get single-use wrong. One table with a bounded
`purpose` column is one place, and it is the same reasoning Stage 15 applied when it refused to create a
`settlements` table for API convenience: **the shape follows the invariant, not the caller.**

**DBT-077 `credential_tokens`** — `id`, `person_id`, **`purpose`** (`password_reset` ·
`email_verification` · `mfa_recovery` · `mfa_enrolment`), `token_hash`, `secret_ciphertext` (used only
by `mfa_enrolment`), `key_id`, `issued_at`, `expires_at`, **`consumed_at`**, `consumed_by_session_id`,
`issued_by_person_id`, `invalidated_at`, `invalidated_reason`.

**Tenancy: GLOBAL, no `school_id`** — the same class as **DBT-007 `persons`** and **DBT-008
`credentials`**. A credential belongs to a person, and a person is global (Stage 15 §8). Adding a tenant
column here would reintroduce the fusion Stage 15's identity decomposition removed.

**Two new uniqueness guarantees, extending Stage 15's register:**

| | |
|---|---|
| **DBI-031** | `UNIQUE (token_hash)` — **global and unconditional**, exactly as **DBI-029** is for link codes, and for the same reason: a token is a credential, and an expired token's hash must never be reissuable |
| **DBI-032** | `UNIQUE (person_id, purpose) WHERE consumed_at IS NULL AND invalidated_at IS NULL AND expires_at > issued_at` — at most one live token per person per purpose, so requesting a second reset invalidates the first rather than leaving two live links |

**DBI-032 satisfies DB-P19.** Its predicate compares two stored columns and **does not consult the wall
clock** — an expired-but-unconsumed row still occupies the slot until it is explicitly invalidated,
which is deliberate: a predicate that changes meaning as time passes, with no write occurring, is
exactly what DB-P19 forbids.

**Consumption is a conditional `UPDATE`, and that is the whole guarantee:**

```sql
UPDATE credential_tokens
   SET consumed_at = now(), consumed_by_session_id = $1
 WHERE token_hash = $2 AND purpose = $3
   AND consumed_at IS NULL AND invalidated_at IS NULL AND expires_at > now()
-- rowCount = 0  ⇒  already used, invalidated, or expired  ⇒  the transaction ABORTS
```

`now()` appears in the **statement**, never in a constraint. **Stage 15's DB-P19 governs constraint
predicates; a query may of course read the clock.**

### 49.1 The amendment, stated formally

```
A15-001                              raised by Stage 16, 30 August 2026
AFFECTS      DATABASE_SCHEMA.md — §41 catalogue · §33 uniqueness register · §1.1 counting rule
TYPE         ADDITION — one table and one column. Nothing is removed, renamed or renumbered.
STATUS       RECORDED in DATABASE_SCHEMA.md §55
```

| Change | Detail |
|---|---|
| **DBT-077 `credential_tokens`** | new table; MOD-002 owns it; **the count moves 76 → 77** |
| **DBI-031 · DBI-032** | new uniqueness guarantees; **the register moves 30 → 32** |
| **`persons.authority_version integer NOT NULL DEFAULT 0`** | a column on **DBT-007**, whose shape Stage 15 fixed — required by **SEC-D013** so a revocation invalidates a cached authority answer on the next request |
| **`credentials`' fields** | **no amendment needed.** Stage 15 wrote *"Stage 16 owns every field's form"* for DBT-008, so SEC-D003's field list is Stage 16 exercising a grant Stage 15 made |
| **`user_sessions.sess` contents** | **no amendment needed** — Stage 15 assigned it to Stage 16 |
| **`rate_limits` algorithm** | **no amendment needed** — Stage 15 assigned it to Stage 16 |

**Why this is an amendment and not a conflict.** Stage 15's counting rule is not wrong; it was applied
correctly to what was known then. **Stage 16 then made a decision that requires a table nobody had a
reason to design yet**, and the honest record of that is an addition with its cause traceable to the
stage that caused it — not a silent 77th row appearing in a locked catalogue, and not a conflict, since
nothing Stage 15 states is contradicted.

**Why it is Stage 15's register and not Stage 16's.** DBT, DBI and the table catalogue are Stage 15
families. **A later stage may not mint identifiers in another stage's namespace without recording the
amendment**, which is precisely what §54.2 of Stage 15 provides for in the form `A15-nnn`.

**SECAR-053 · DBT-077 carries the uniqueness Stage 15's register requires**, and it is created by
**MIG-03** with the other new tables — **not by application DDL** (SEC-D040, C-86) and not by
`db:push` (DBD-043, C-78).

---

## 50. Success criteria, locking discipline and summary

**SD-16 · Authentication, end to end, in the target**

```
  sign-in  ──► schema ──► limiter (account · IP · durable lockout)
                            │
                            ▼
                    Argon2id verify   (bcrypt verify + rehash, if legacy)
                            │
                            ├── MFA enrolled ──► pendingMfa marker · NO userId
                            │                     │
                            │                     ▼
                            │              TOTP verified AND CONSUMED  (mfa_last_counter)
                            │                     │
                            ▼                     ▼
                    session REGENERATED · person_id only · authenticated_at
                            │
                            ▼
  every request ──► person_id ──► memberships · authorities · conditions   RESOLVED NOW
                            └──► capability answer, cached ≤30s, keyed by authority_version
                            └──► SET LOCAL tenant, inside a transaction ──► RLS
```

**SD-17 · Where a privacy request goes**

```
ACCESS / PORTABILITY  ─► typed export, per data class, subject's data only        SEC-D073
RECTIFICATION         ─► identity fields; history is NOT rewritten                SECAR-041
ERASURE (person)      ─► anonymise in place · credentials deleted · messages redacted
                          custody + money RETAINED                                SEC-D074
ERASURE (tenant)      ─► CAP-092 purge_tenant · deliberate · capability-gated
RESTRICTION           ─► a state the schema must be able to express               SECAR-042
BACKUPS               ─► by expiry · a restore RE-APPLIES the erasure log         SEC-D078
CONFLICT              ─► C-79 · OPEN · BytHub Legal                               SEC-D075
```

**SD-18 · The claim this document makes, and the claim it does not**

```
CLAIMS      a target security model, traceable to locked stages 7 and 11–15
            21 findings against the current tree, each read directly
            one of which corrects a claim this document itself made
            a verification method for every control                          SEC-D081

DOES NOT    that the current system is secure
CLAIM       that the target, once built, is secure
            that any regulatory obligation is met
            that the go-live block is affected in any way
```

### 50.1 Success criteria

| # | Criterion | Met |
|---|---|---|
| 1 | every claim about current behaviour cites a file that was opened | ✔ §2 |
| 2 | controls that are correct are recorded as correct | ✔ §2.1 — fourteen |
| 3 | every finding names its consequence, not just its shape | ✔ §2.2 |
| 4 | no existing conflict is renumbered or duplicated | ✔ §47.2 — C-18, C-21, C-41, C-71 reused |
| 5 | credential storage, sessions, MFA and recovery are fully specified | ✔ §5–§15 |
| 6 | the Stage 7 chain has one runtime path | ✔ SD-4 |
| 7 | tenant isolation has an independent database layer | ✔ SD-5, SECAR-008/009/010 |
| 8 | no externally initiated request can enter I-2 | ✔ SECAR-031 |
| 9 | a prohibited-log list exists that a reviewer can check against | ✔ §31 |
| 10 | the personal-data map covers derived stores and backups | ✔ §34, §39 |
| 11 | children's data has explicit, protective defaults | ✔ §35 |
| 12 | every control names how it is verified | ✔ §42 |
| 13 | trade-offs are stated beside their decisions | ✔ SEC-P20, throughout |
| 14 | only genuine product questions are asked | ✔ 2 asked, **2 decided, 0 open** |
| 16 | the owner's decisions are applied, and what they cost is stated | ✔ §46 · SEC-D087 · SEC-D088 · SEC-R023 · SEC-R024 |
| 17 | a policy decision is not reported as a remediation | ✔ **C-21 = TARGET POLICY RESOLVED · IMPLEMENTATION OPEN** |
| 18 | identifiers minted in another stage's namespace are amended, not assumed | ✔ **A15-001**, §49 |
| 19 | a claim this document got wrong is corrected in place, not deleted | ✔ SEC-F21 · §12.5 |
| 15 | no legal conclusion is drawn | ✔ §34, §36, §41 |

### 50.2 Locking discipline

```
STAGE 16 — SECURITY, AUTHENTICATION, AUTHORISATION & PRIVACY
STATUS: LOCKED
Locked: 30 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions applied: SECQ-1 = B · SECQ-2 = A
Open owner questions: 0
New conflicts: C-80 … C-90    Conflicts closed: 0
Amendment raised against a locked stage: A15-001 (Stage 15)
```

Now that this stage is LOCKED:

1. **Later stages may implement it.** Stage 18 sets retention numbers, Stage 19 the audit and console
   record mechanics, Stage 20 the measurements behind SEC-R013/R014, Stage 21 deployment and the
   applied state of `001_console_hardening.sql`, Stage 22 onward the code.
2. **Later stages may record traceable owner amendments as A16-nnn**, stating the locked text, the
   narrowing, and the cause. **They may not silently rewrite.**
3. **Conflict identifiers are stable** — C-80 … C-86 keep their numbers permanently.
4. **`credentials`' field list (SEC-D003) is closed.** Adding a column requires an amendment.
5. **SECAR requirements are not negotiable by implementation convenience.** A requirement that cannot
   be met is a conflict to raise, not a line to soften.
6. **A later finding that contradicts this stage is FLAGGED, not absorbed.**
7. **SECQ-1 = B and SECQ-2 = A are decided.** They are not reopened by a later stage; changing either
   requires a traceable owner amendment, not a fresh question.
8. **C-21 is not closed by SECQ-2 = A**, and no later stage may record it as closed until its
   implementation defects — SEC-D020, SEC-D021, SEC-D082, SEC-D083, SEC-D086, SEC-D087 — are built and
   verified.
9. **A15-001 is the only amendment this stage raises.** Any further need to mint a DBT or DBI identifier
   requires a further `A15-nnn`, never a silent addition to Stage 15's registers.

**Stage 16 approval is not production security clearance and is not legal sign-off.** The BytHub Legal &
Compliance deployment halt and production go-live block of 23 August 2026 — **17 Critical, 52 High,
across 14 domains, 0% compliance clearance** — **stands in full.** Only a security re-audit and BytHub's
legal review can address it, and **nothing in this document has been implemented, deployed or
verified by execution.** The baseline remains **UNVERIFIED**, capped at **E2**.

---

## Summary

Stage 16 reads the current security layer honestly and finds a system with **fourteen controls that are
correct — several of them well argued, and the database console the strongest thing in the codebase —
sitting beside a small number of primitives that undo them**: a reset link written to the log, an MFA
secret stored in the clear, a code that is never consumed, a privilege switch with no validation, a CSP
that permits the script it exists to block, and a webhook that verifies a reconstruction of a message,
cannot tell a replay from a retry, belongs to no tenant, and reaches straight into the atomic
invariant.

The target states: **Argon2id with rehash-on-login and nobody locked out; sessions that carry continuity
and never authority; authority resolved per request and invalidated by version, not by timeout; a
second factor that is encrypted at rest and consumed on use; a reset that destroys the sessions it
exists to protect against; four independent tenant layers of which only the database's does not depend
on the application being right; signatures over the bytes actually received; a closed prohibited-log
list; a personal-data map that includes logs, backups and restores; and a verification method beside
every one of them.**

**The owner's two decisions are applied in full.** **SECQ-1 = B** puts AUTH-FAMILY on a 7-day absolute
and 7-day idle lifetime, and this document records the consequence rather than only the improvement:
more guardians will meet the reset flow, which is the flow still carrying C-18, C-84 and C-89.
**SECQ-2 = A** makes MFA mandatory when **AUTH-SCHOOL or AUTH-FINANCE is exercised**, keyed to the
authority rather than to a role string — because PA-1 establishes that `school_admin + AUTH-FINANCE` is
one context, and a role-keyed rule would exempt exactly that arrangement.

**SECQ-2 = A does not close C-21.** It resolves the scope question C-21 assigned to this stage, and
C-21 stands at **TARGET POLICY RESOLVED · IMPLEMENTATION OPEN** — with a *larger* implementation surface
than before, because the second evidence pass found three further defects in the same area.

**Eleven new conflicts are raised (C-80 … C-90), twelve existing ones are given a target, none is
closed, and one traceable amendment — A15-001, adding DBT-077 `credential_tokens`, DBI-031, DBI-032 and
`persons.authority_version` — is raised against locked Stage 15 rather than quietly minted inside it.**

```
STAGE 16 — SECURITY, AUTHENTICATION, AUTHORISATION & PRIVACY
STATUS: LOCKED — 30 August 2026
SECQ-1 = B · SECQ-2 = A · Open owner questions: 0
New conflicts C-80 … C-90 · Conflicts closed: 0 · C-21 NOT closed
Amendment raised: A15-001
Stage 17 is authorised. The go-live block of 23 August 2026 stands.
```

---

## 51. Amendment register — amendments recorded after this stage was locked

**This section is append-only.** Each entry states the locked text it corrects or narrows, what changed,
why, and which stage raised it. **No locked text above is edited and no identifier is renumbered.** An
amendment that cannot be expressed as a correction to, or a narrowing of, locked text is a conflict, not
an amendment, and is raised as a `C-` identifier instead.

### A16-001 — The security headers are set in two places, and `preload` is already live

```
RAISED BY:  Stage 17 (INTEGRATIONS_PROVIDERS.md §19)
DATE:       30 August 2026
AFFECTS:    §21 — SEC-D037 · SEC-D038 · SEC-D039
TYPE:       CORRECTION OF FACT, plus a narrowing of where the policy is defined
STATUS:     RECORDED
```

**What this stage stated.** §21 describes the security headers as those `helmet()` sets in
`server/app.ts`, gives a directive-by-directive target table, and concludes at **SEC-D039**: *"HSTS is
kept as configured and `preload` is not added yet… `preload` is irreversible on a browser timescale,
and it is a deployment decision (Stage 21)."*

**What Stage 17 found.** This stage's evidence list names files under `server/` and `shared/schema.ts`.
**It does not include `vercel.json`, and no stage before Stage 17 opened that file's `headers` block.**
It sets, on `/(.*)`, a **second and independent** `Content-Security-Policy`, together with
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, plus `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options` and `Referrer-Policy`.

| §21 stated | Corrected |
|---|---|
| HSTS carries no `preload` | **`preload` is set today**, on the Vercel edge |
| the CSP is the one `helmet()` sets | **two CSP headers are served**; a browser enforces both, so the effective policy is their intersection |
| §21's table describes the effective policy | it describes **one of two** contributing policies. The effective one is *stricter* in `connect-src` (`'self'`, without `wss:`/`ws:`), and adds `frame-ancestors`, `base-uri` and `form-action`, which §21 lists as absent |
| `preload` is a Stage 21 decision | **it is a Stage 21 decision that has already been taken** — and un-taking it is slow, which is exactly why this stage wanted it deferred |

**What does not change.**

- **SEC-D037 stands entirely.** `'unsafe-inline'` is present in `script-src` in **both** policies, so
  **C-83** is unaffected — and better evidenced than when it was raised.
- **SEC-D038's target directives stand.** They now describe one merged policy rather than `helmet()`'s
  alone; three of the directives §21 proposed adding turn out to be already present on the edge, which
  changes where the work is, not what the target is.
- **Every other decision in §21 is untouched**, including SEC-D039's reasoning about `preload`'s
  irreversibility, which is correct and is now a statement about a commitment already made.

**The duplication itself is a defect and has its own identifier: C-91**, raised by Stage 17, with
**INT-D022** as its target — one place, the application, with every directive `vercel.json` uniquely
contributes moved into `helmet()`. **The two are recorded separately because they are different kinds of
wrong:** a defect in the system, and an incorrect statement in this document.

**Why an amendment and not a conflict against this stage.** §21's reasoning is sound and its target is
right. **Its evidence was incomplete in a way it could not have detected from the files it read** — the
stage looked where security headers are normally configured, and this deployment configures some of them
somewhere else. Correcting locked text with its cause traceable to the stage that found it is what an
amendment is for.

**Operational consequence until Stage 17's consolidation ships (INTAR-014): a change to the effective
security headers must be checked in BOTH locations.** A change made in one place is not the policy.

```
STAGE 16 — SECURITY, AUTHENTICATION, AUTHORISATION & PRIVACY
STATUS: LOCKED — 30 August 2026
Amendments recorded: A16-001 (raised by Stage 17)
SECQ-1 = B · SECQ-2 = A · Open owner questions: 0
New conflicts C-80 … C-90 · Conflicts closed: 0 · C-21 NOT closed
Amendment raised by this stage: A15-001 (Stage 15)
```

### A16-002 — Owner-review consistency corrections

```
RAISED BY:  Stage 17 (INTEGRATIONS_PROVIDERS.md §38), on owner review
DATE:       31 August 2026
AFFECTS:    §2.1 and every count derived from it · §38 and SEC-D076 · SEC-D006
TYPE:       CONSISTENCY CORRECTION — no security control is redesigned, added or removed
STATUS:     RECORDED
```

**This amendment corrects three ownership and count statements found after lock. A16-001 is untouched
and remains in force.**

#### A16-002.1 · The baseline control count is fifteen, not fourteen

§2.1's table lists **fifteen** controls: session regeneration · cookie flags · `trust proxy` · the
session-secret assertion · two-dimension login limiting · counter reset on success · MFA as partial
auth · enumeration resistance on reset · upload content verification · cron authentication · the
webhook failing closed · 5xx disclosure · console tiering · console break-glass · test-account ordering.

**The prose beneath it, §2.3's summary, and §49.1's success criterion all say "fourteen."** Recounted
directly from the table: **fifteen.**

**The amended reading is: fifteen controls present and correct.** The original locked text is preserved
above and is not edited; this entry is the correction of record, and every count referencing fourteen is
read as fifteen. **No control is added, removed or changed** — only the arithmetic over them.

#### A16-002.2 · Retention ownership is narrower than this stage stated

**SEC-D076 says "Stage 16 states which clock each class runs on; Stage 18 sets every number", and §38
carries the same implication.** That gives Stage 18 authority it must not have.

```
STAGE 16                    privacy and security handling categories · minimisation
                            deletion and erasure MECHANISMS · records in scope
                            the TECHNICAL ABILITY to enforce a retention decision

QUALIFIED LEGAL /           legally and commercially significant retention:
CONTROLLER-APPROVED POLICY    child and family records · financial and statutory records
                              custody evidence · erasure exceptions · lawful justification

STAGE 18                    OPERATIONAL ENGINEERING WINDOWS ONLY:
                              import staging · job execution metadata
                              transient idempotency data · temporary operational traces
                            and the engineering behaviour that implements a legally
                            approved policy where one is required

STAGE 19                    final audit-record retention MECHANICS, subject to that policy
STAGE 21                    backup and provider lifecycle configuration
```

**Stage 18 must not invent a statement of the form "UK law requires N years."** Where a number is
legally or commercially significant, Stage 18 records **POLICY INPUT REQUIRED** or **INHERIT APPROVED
RETENTION POLICY** and stops there.

**§38's table of classes and clocks stands** — it correctly identifies *which* clock each record class
runs on. **What changes is who sets the number on the legally significant ones.**

#### A16-002.3 · The compromised-password requirement is provider-neutral

**SEC-D006 names an implementation — "k-anonymity range query against a public breached-password
corpus" — a stage before the stage that selects implementations.**

**The corrected Stage 16 requirement:**

> Password creation and reset must be checked against a **maintained compromised-password data source
> using a privacy-preserving mechanism**, subject to: never send the plaintext password; never send a
> full password hash together with an identity; never send the email address, the school or the
> username; log nothing sensitive; and state the availability and failure behaviour explicitly.

**Stage 17 selects the implementation.** It has done so — **PRV-006, the Have I Been Pwned Pwned
Passwords range API with `Add-Padding: true`**, verified against first-party documentation on
31 August 2026, with the downloadable corpus recorded as the self-hosted fallback
(`INTEGRATIONS_PROVIDERS.md` §34.4).

**The security requirement is unchanged in substance and unweakened.** SEC-D006's failure behaviour —
the check is skipped and the password accepted when the source is unavailable — **stands exactly as
locked.**

```
STAGE 16 — SECURITY, AUTHENTICATION, AUTHORISATION & PRIVACY
STATUS: LOCKED — 30 August 2026
Amendments recorded: A16-001 · A16-002 (both raised by Stage 17)
Baseline controls present and correct: 15  (amended from 14 by A16-002.1)
SECQ-1 = B · SECQ-2 = A · Open owner questions: 0
New conflicts C-80 … C-90 · Conflicts closed: 0 · C-21 NOT closed
Amendment raised by this stage: A15-001 (Stage 15)
```
