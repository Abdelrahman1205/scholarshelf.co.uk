# INTEGRATIONS_PROVIDERS.md — Stage 17: Integrations, Providers & External Boundaries

```
STAGE 17 — INTEGRATIONS, PROVIDERS & EXTERNAL BOUNDARIES
STATUS: LOCKED
Written: 30 August 2026
Locked: 31 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions: INTQ-1 = A · INTQ-2 = C
Amended: 31 August 2026 by A17-001 on owner review — see §42, which GOVERNS
Owner decisions: INTQ-1 = A · INTQ-2 = C · INTQ-3 = A
Open owner questions: 0
New conflicts: C-91 … C-97      Conflicts closed: 0
Amendments raised BY this stage: A16-001 · A16-002 · A15-002 · A11-001
Amendment raised AGAINST this stage: A17-001
```

**Owner decisions, applied in full:**

```
INTQ-1 = A    each school connects its OWN payment-provider account            §16
              BytHub is not the central collector or remitter
              V1 remains RECONCILIATION-ONLY — no live payments are added

INTQ-2 = C    school DISPLAY identity over ScholarShelf sending infrastructure  §16
              no per-school DNS, SPF, DKIM or DMARC work for V1
```

**Provider selections made in this stage, each against first-party evidence fetched 31 August 2026:**

```
KEEP     PRV-001 Neon (aws-eu-west-2 London)   PRV-002 Vercel
SELECT   PRV-004 AWS S3 eu-west-2              PRV-005 GuardDuty Malware Protection for S3
         PRV-006 HIBP Pwned Passwords range API (padded)
ADD      PRV-007 Sentry, EU region             PRV-008 Sentry Uptime
REJECT   PRV-009 Cloudflare R2                 DEFER   PRV-011 live payment provider
```

**Amended by A17-001 (§42) after owner review — the CURRENT reading:**

```
INTQ-3 = A    TQ-1's UK/EU processing policy INCLUDES transactional email
PRV-003       Resend  ->  CURRENT / LEGACY · REPLACE BEFORE PRODUCTION
PRV-012       Amazon SES, eu-west-2 (London)  ->  SELECT      the email target
PRV-005       GuardDuty  ->  SELECT-CONDITIONAL · Stage 21 feature-region gate
C-97          TARGET RESOLVED · IMPLEMENTATION OPEN — not closed
```

**Governed by** `PRODUCT.md` · `USERS.md` · `FEATURE_INVENTORY.md` · `BUSINESS_RULES.md` ·
`WORKFLOWS.md` · `DATA_MODEL.md` · `PERMISSIONS.md` · `MODULES.md` · `ROLE_EXPERIENCE.md` ·
`DESIGN_SYSTEM.md` · `TECH_STACK.md` · `SYSTEM_ARCHITECTURE.md` · `CODEBASE_ARCHITECTURE.md` ·
`API_CONTRACT.md` · `DATABASE_SCHEMA.md` · `SECURITY_AUTH_PRIVACY.md` — **Stages 1–16, all LOCKED.**

**Integration evidence, read directly on 30 August 2026** — `server/email.ts`,
`server/paymentIntegration.ts` in full (147 lines), `server/storageProvider.ts` in full (62 lines),
`server/routes/cron.routes.ts`, `server/routes/message.routes.ts`'s callback handler,
`server/services/payment-verification/` (five files, 1,519 lines), `server/services/enrollment-import/`,
`server/middleware/auth.ts`'s `getEmailBrandingForSchool` and `toEmailSafeLogoUrl`, **`vercel.json` in
full**, and **every entry in `package.json`'s `dependencies`, cross-checked against every `import` in
`server/`, `client/`, `shared/` and `api/`.**

**Two things this document does that the previous stages could not.** It reads `vercel.json` — which no
earlier stage opened — and finds a **second set of security headers** disagreeing with the ones
`app.ts` sets. And it checks declared dependencies against actual imports, and finds **four integration
packages that nothing imports.** Both are recorded below with their consequences.

---

## 1. Purpose and boundary

Stage 17 states the **target model for everything ScholarShelf talks to that is not ScholarShelf**:
which external systems exist, what each one is trusted for, how credentials for them are held and
scoped, how a call out is made, how a call in is verified, what happens when a provider is slow, wrong
or gone, and what personal data crosses each boundary.

Stage 16 established the security rules that govern a boundary. **Stage 17 enumerates the boundaries
and states how each provider is actually wired**, including the ones that do not exist yet and the one
that is a placeholder waiting for another company's API.

### 1.1 What Stage 17 decides

| Decides | Does not decide |
|---|---|
| the integration taxonomy and what each class may do | **which vendor is bought** — commercial, and the owner's |
| per-tenant versus platform-wide credential scope | retention of provider records — **Stage 18** |
| outbound call discipline — timeouts, retries, budgets | audit record mechanics — **Stage 19** |
| inbound callback verification, replay and tenant binding | throughput tuning — **Stage 20** |
| the object-storage, scanning and email seams | secret **delivery** and environment wiring — **Stage 21** |
| degradation behaviour when a provider fails | the implementation — **Stage 22 onward** |
| what personal data crosses each boundary | the lawful basis for any transfer — **BytHub Legal** |

### 1.2 Nothing was executed

Per the standing instruction, **no code was written, no repository file was modified, no dependency was
installed, removed or upgraded, no provider was contacted, no API key was created, read, rotated or
revoked, no webhook was registered or replayed, no email was sent, no cron schedule was changed, no
header configuration was altered, no bucket was created, no scanner was enabled, no provider contract
was signed or terminated, no production data was edited and nothing was deployed.**

Every file named above was **opened and read.** That is the whole of the interaction with the
repository.

### 1.3 The release boundary is unchanged

**The BytHub Legal & Compliance deployment halt and production go-live block of 23 August 2026 —
17 Critical, 52 High, across 14 domains, 0% compliance clearance — stands in full.** Stage 17 designs
a target. It selects no vendor, signs no contract, asserts no compliance, and clears no part of the
block. Where it describes a data-protection obligation attaching to a transfer, it records that the
obligation is asserted; **it does not adopt a finding of law.**

**The baseline remains UNVERIFIED**, capped at **E2 — read directly, not executed.** The owner's native
test runs are still outstanding.

---

## 2. The current integration baseline

**ID-1 · Everything ScholarShelf talks to today**

```
                          ┌──────────────────────────────────────┐
  OUTBOUND                │            ScholarShelf              │            INBOUND
                          └──────────────────────────────────────┘
  Resend  ◄── email ──────┤                                      ├────── provider callback ──►
   resend@6.12.4          │                                      │   POST /api/webhooks/
   ONE global API key     │                                      │        payment-update
   ONE global sender      │                                      │   HMAC-SHA256 · fails closed
                          │                                      │   C-80 · C-81 · C-41
  Neon  ◄── SQL ──────────┤                                      │
   @neondatabase/         │                                      ├────── Vercel Cron ────────►
   serverless@0.10.4      │                                      │   GET /api/cron/run
   + pg@8.21.0            │                                      │   0 7 * * *  · bearer secret
                          │                                      │
  External payment API ◄──┤   createExternalPayment()            ├────── spreadsheet upload ──►
   NOT IMPLEMENTED        │   "For AntiGravity Integration Team"  │   Stripe CSV/XLSX importer
   awaiting another       │                                      │   xlsx@0.18.5   ◄── C-58
   company's credentials  │                                      │
                          └──────────────────────────────────────┘
  Object storage          seam exists · driver = "data-uri" · NOTHING WIRED   (storageProvider.ts)
  Malware scanning        does not exist
  Breached-password check does not exist                         (Stage 16 SEC-D006 requires it)

  DECLARED BUT IMPORTED NOWHERE:  @supabase/supabase-js · @supabase/ssr · passport · passport-local
```

### 2.1 What is present and correct

| Control | Evidence | Assessment |
|---|---|---|
| the webhook secret is asserted at startup | `paymentIntegration.ts` throws in production when `PAYMENT_WEBHOOK_SECRET` is absent, with the reason spelled out | **correct**, and the reasoning — *"any unauthenticated request can confirm or cancel payments"* — is exactly right |
| the webhook fails closed | no secret ⇒ reject, never accept | **correct** |
| HMAC comparison is constant-time | `crypto.timingSafeEqual` with an equal-length pre-check | **correct** |
| the integration is behind one seam | `paymentIntegration.ts` is *"the single plug-in point"*, and it is | **correct** — replacing the provider touches one file |
| the integration is off unless configured | `isExternalIntegrationEnabled()` requires both URL and key | **correct** |
| the object-storage seam exists before it is needed | `storageProvider.ts` defines the interface and ships a default that changes nothing | **well judged.** The seam is the hard part and it is already done |
| cron authentication | bearer or header, `timingSafeEquals`, fails closed | **correct** |
| cron idempotency | the unique index on `(job, school_id, run_date)` makes a partial drain safe to resume | **correct**, and the comment explaining why the old one-school-per-tick behaviour silently starved every school after the first is a good piece of reasoning |
| email is behind one helper | every message goes through one `sendEmail` | **correct** |

**Nine integration controls are present and correct.** The seams in particular are better than the
implementations behind them, which is the right way round: **a seam is expensive to add later and a
provider is cheap to swap.**

### 2.2 Findings

**INT-F01 · Two different security-header policies are served from two places.**
`app.ts` configures `helmet()` with a CSP; **`vercel.json` independently sets a `Content-Security-Policy`
header on `/(.*)`**, plus its own `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`. **No earlier
stage opened `vercel.json`'s `headers` block.** The two policies do not agree:

| Directive | `helmet()` in `app.ts` | `vercel.json` |
|---|---|---|
| `connect-src` | `'self' wss: ws:` | **`'self'`** |
| `frame-ancestors` | not set | **`'self'`** |
| `base-uri` · `form-action` | not set | **`'self'`** |
| `script-src` | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline'` — **agree, and both wrong** (C-83) |
| HSTS | `max-age=63072000; includeSubDomains` | **`…; includeSubDomains; preload`** |

A browser receiving two CSP headers enforces **both**, so the effective policy is their intersection —
which happens to be stricter than either stage documented. **That is luck, not design.** The real defect
is two sources of truth: a change to one is invisible in the other, and `vercel.json`'s headers apply
only on the Vercel edge, so **local and self-hosted runs get a materially different policy from
production.** → **C-91**, and → **A16-001**, because Stage 16 states as fact that `preload` *"is not
added yet"* when `vercel.json` adds it.

**INT-F02 · Four integration packages are declared and imported nowhere.**
`@supabase/supabase-js`, `@supabase/ssr`, `passport` and `passport-local` appear in `dependencies`.
A search of every `.ts` and `.tsx` under `server/`, `client/`, `shared/` and `api/` finds **no import of
any of them**. Supabase is a database-and-auth platform that competes with the locked Neon + Drizzle +
hand-rolled-session stack; passport is an authentication framework the product does not use.
**Two of the four are credential-handling packages carrying an implication about how this product
authenticates that is not true.** → **C-92**.

**INT-F03 · The payment provider is one process-wide credential, not a per-tenant integration.**
`EXTERNAL_API_BASE_URL` and `EXTERNAL_API_KEY` are read from `process.env` **once at module load**.
Stage 15 created **DBT-040 `integrations`** as a per-school record; the code has no concept of one.
Every school shares one provider identity, a credential change needs a redeploy, and **no school can
have a different provider from any other.** → **C-93**.

**INT-F04 · The email sender identity is process-wide, with a hard-coded fallback and four names for
two settings.**
`RESEND_API_KEY || EMAIL_API_KEY`, `RESEND_FROM_EMAIL || EMAIL_FROM`, then a literal
`"noreply@scholarshelf.co.uk"`. **`EMAIL_API_KEY` and `EMAIL_FROM` appear in no Zod schema** — they are
two of the nine raw `process.env` reads Stage 16 raised as **C-82**. Every school's mail leaves from one
address, on one API key, with no per-tenant sending identity and no per-tenant deliverability. → **C-94**.

**INT-F05 · An unvalidated brand colour is interpolated into email HTML without escaping.**
`wrapEmail()` builds `style="background:${brandPrimary}"`-shaped attributes from
`branding.primaryColour`. `getEmailBrandingForSchool` reads the stored column **raw**.
`normalizeHexColour` exists in `branding.ts` and has exactly **two calling files** —
`setup.routes.ts`, on two write paths. **The read path does not normalise and the template does not
escape**, so any value that reached the column by another write lands inside an HTML attribute in an
email. This is **C-53** — *brand colours are unvalidated* — surfacing in the email channel, and the
email channel is the one place the product's output leaves its own CSP behind. → **C-95**.

**INT-F06 · The daily drain can end early, and nothing comes back for the rest.**
`/api/cron/run` processes schools until `DRAIN_BUDGET_MS` is exhausted against `maxDuration: 30`, then
returns `remaining: N` and logs a warning. **`vercel.json` schedules exactly one run a day**
(`0 7 * * *`). The code's own comment correctly explains that the *previous* design starved every school
after the first because it assumed *"successive ticks that a once-a-day schedule never produces"* —
**and the replacement still depends on something re-invoking it, which nothing does.** A school beyond
the budget waits until tomorrow. The endpoint also **mutates and sends email on `GET`**, because Vercel
Cron issues `GET`, and accepts a `?school=` tenant selector. → **C-96**.

### 2.3 The honest summary

```
Nine integration controls correct — the SEAMS especially
Six defects newly found and verified          C-91 … C-96
One locked-stage statement contradicted       A16-001  (Stage 16 SEC-D039)
Two conflicts inherited unchanged             C-58 (xlsx) · C-63 (region)
Three callback defects already carried        C-80 · C-81 · C-41
One provider not selected at all              the payment API — a placeholder for another company
Three providers that do not exist yet         object storage · scanning · breached-password corpus
```

**The pattern is consistent and worth naming.** Where this codebase has built a **seam**, the seam is
good — `paymentIntegration.ts`, `storageProvider.ts`, the single `sendEmail`. Where it has built the
**thing behind the seam**, it has assumed a single tenant: one payment key, one sender address, one
policy file. **Stage 17's work is mostly not new seams. It is making what sits behind them
tenant-aware.**
---

## 3. Integration principles

**INT-P1 — An integration is a boundary, not a library.** Something on the other side is owned by
someone else, can change without notice, and can be unavailable. Code that treats a provider like a
local function will fail the first time that is untrue.

**INT-P2 — A provider is trusted for exactly one thing, named in advance.** Resend is trusted to
deliver a message. It is not trusted to say who a person is. A payment provider is trusted to report
that money moved. It is not trusted to decide that a requirement is settled.

**INT-P3 — Every credential has a scope, and the scope is stated.** Platform-wide or per-tenant is a
decision with consequences, never a default that emerges from where the value happened to be read.

**INT-P4 — An outbound call has a deadline.** No call to another company's system runs without a
timeout, and no timeout is longer than the budget of the request that started it.

**INT-P5 — An inbound message proves its sender and nothing else.** Authenticity is not authority, not
freshness, not tenancy, and not a business fact.

**INT-P6 — An external system never reaches into an invariant.** Stage 15's I-2 and Stage 16's
SECAR-031 restated for this stage: a signal is recorded; a person with a capability decides.

**INT-P7 — Every integration degrades in a stated way.** "What happens when this is down" is part of
the design, written down, and not discovered in production.

**INT-P8 — A provider's failure is recorded as a classification, never as its raw message.** Provider
error text carries endpoints, identifiers and occasionally payload fragments.

**INT-P9 — Data crossing a boundary is minimised at the call site.** A provider receives what it needs
to do its job, and no field is included because it happened to be in the object.

**INT-P10 — There is one place a provider is configured and one place it is called.** The seam.

**INT-P11 — A declared dependency is a claim about what the product connects to.** An unused
integration package is a false claim, an unreviewed supply-chain surface, and a misleading signal to
anyone auditing the system.

**INT-P12 — Configuration that affects security is defined once.** Two files setting the same header is
two chances to disagree and one guarantee that they eventually will.

**INT-P13 — A seam is not a provider.** A candidate becomes part of the target architecture only when
**Stage 17 deliberately classifies it KEEP · SELECT · ADD · DEFER · REJECT**, against verified official
evidence. A seam with no selected implementation is recorded as absent, never described as if it works.
**Selection is this stage's job; provisioning is Stage 21's.**

**INT-P14 — Leaving a provider is part of choosing one.** What the data looks like on the way out is a
selection criterion, not an afterthought.

---

## 4. The integration taxonomy

**ID-2 · Four classes, and what each may do**

```
CLASS A · INFRASTRUCTURE        Neon · Vercel
   the product cannot run without it · PLATFORM credential — configuration, NOT DBT-040
   may hold ALL tenant data · governed by the DPA, not by a per-school setting

CLASS B · DELIVERY              Resend · object storage · malware scanning
   the product runs degraded without it · PLATFORM credential — configuration, NOT DBT-040
   (INTQ-2 = C: email is platform-wide; school identity is presentation data)
   receives a MINIMISED slice · never authoritative for a business fact

CLASS C · FINANCIAL             the payment provider · reconciliation file sources
   per-tenant by nature (INTQ-1 = A) · DBT-040 row · may SIGNAL, may never DECIDE
   every inbound message is de-duplicated, tenant-bound and non-authoritative

CLASS D · REFERENCE             breached-password corpus
   stateless lookup · receives NO account data · fails open by design (SEC-D006)
```

**INT-D001 · An integration's class fixes its credential scope, its failure behaviour and its
authority — and those three are decided together, never separately**

| | Class A | Class B | Class C | Class D |
|---|---|---|---|---|
| credential scope | platform config | **platform config** (INTQ-2 = C) | **tenant — DBT-040** | platform config |
| may hold tenant data | all | a minimised slice | the slice it settles | **none** |
| failure behaviour | **the product is down** | degraded, queued, visible | **queued and visible; never assumed** | **fail open** |
| may assert a business fact | n/a | **no** | **no — signal only** | no |
| appears in the sub-processor register | yes | yes | yes | **no — no personal data crosses** |

**INTAR-001 · Every integration is classified before it is built.** A Class C integration records its
class in **DBT-040**; a platform integration records it in the **PRV-\* register (§33)** and in validated
configuration. **An integration with no class is not configured.**

---

## 5. The integration record

Stage 15 created **DBT-040 `integrations`** (per-school) and **DBT-041 `provider_events`** (with
**DBI-021 `UNIQUE (integration_id, external_event_id)`**). **Neither is used by the current code**,
which reads its provider configuration from `process.env` at module load.

**INT-D002 · A configured integration is a row, not an environment variable**

**DBT-040 `integrations`** — `id`, `school_id`, `class` (A · B · C · D), `provider_kind`,
`display_name`, `state` (`configured` · `enabled` · `suspended` · `revoked`), `credential_ref`,
`external_account_id`, `configured_by_person_id`, `configured_at`, `last_success_at`,
`last_failure_at`, `last_failure_class`.

**`credential_ref` is a reference, never a secret.** It names an entry in the deployment secret store
(Stage 21); **the secret itself is never a database column** — Stage 16 SEC-D059, restated because this
is the table where someone would most naturally put one.

**INT-D003 · A PLATFORM provider is NOT a DBT-040 row — it is validated deployment configuration**

**This corrects an error in this document's own proposed draft.** That draft claimed Stage 15's
`scope_kind` discriminator applies to `integrations`, and that Neon and Vercel would be platform-scope
rows in it. **Both claims are wrong.** Stage 15 defines **DBT-040 with `school_id NOT NULL`** and places
it under MOD-007 Settlement & Funding. It is a **school-owned, provider-neutral** table, and nothing in
Stage 15 gives it a discriminator.

```
SCHOOL-SCOPED PROVIDER          DBT-040 integrations
   the future per-school           school_id NOT NULL · MOD-007
   payment account (INTQ-1 = A)    the row a school's own provider account lives in

PLATFORM INFRASTRUCTURE         validated environment configuration (Stage 16 SEC-D061)
   Neon · Vercel · Resend          + the deployment secret store (Stage 21)
   object storage · scanner        NEVER a fabricated school row
   breach corpus · error tracker   NEVER a NULL school_id
```

**Making DBT-040 an infrastructure registry would require amending Stage 15 to relax `school_id NOT
NULL`, and there is no reason to.** A platform provider has no tenant, so representing it as a
tenant-owned row means either a fake `school_id` or a nullable column that reintroduces exactly the
NULL-means-everything defect Stage 15 corrected in `cron_job_runs`. **The simpler design is the correct
one, and it needs no amendment.**

**The PRV-* register in §33 is documentation, not a table.** It records what the platform uses; it
creates no schema.

**INTAR-002 · Provider configuration is read from the row at call time, never captured at module
load.** The current `const EXTERNAL_API_KEY = process.env.…` at import time is why a credential change
needs a redeploy and why every tenant necessarily shares one.

---

## 6. Credential scope — the decision that shapes everything else

**ID-3 · Where a credential lives determines what a tenant can be**

```
TODAY                              TARGET

process.env.EXTERNAL_API_KEY       integrations row per school       DBT-040
        │                                   │
        └──► one identity                   ├──► school A · provider X · account A
             for every school               ├──► school B · provider X · account B
             one merchant                   └──► school C · provider Y   (if permitted)
             one deliverability reputation
             one blast radius
```

**INT-D004 · Class C credentials are per-tenant. Class A are platform-wide. Class B is INTQ-2.**

Class C is not a preference. A school's fee income is the school's, and a single shared merchant
identity makes BytHub the party through which every school's money moves — **which is a commercial and
regulatory posture, not a wiring detail.** That is **INTQ-1**, and it is asked (§16).

**INTAR-003 · A credential's blast radius is stated wherever it is granted.** A platform-wide key that
can act on any tenant's data is recorded as such, in the sub-processor register and in the risk table,
so nobody has to derive it from where a variable is read.

---

## 7. Outbound calls

**INT-D005 · Every outbound call has a timeout, a budget, a bounded retry and a recorded outcome**

**Stage 17 locks the SEMANTICS. Stage 18 sets every number.**

```
SEMANTICS — Stage 17                        NUMBERS — Stage 18
every outbound call has a deadline          the attempt timeout
retries are bounded                         the retry count
retry ONLY where the call is idempotent     the backoff curve
a permanent error is NEVER blindly retried  the overall outbound budget
   (4xx: the provider said no; asking
    again says no again)
the whole outbound budget fits inside
   the request's own budget
```

**The one number Stage 17 does keep is the one the provider's protocol dictates**, not one we chose: a
signed callback's timestamp tolerance (§8, Stage 16 SEC-D054). **A tolerance is part of a security
contract with another party; a timeout is an operational choice about our own patience.**

**The current `createExternalPayment` has no timeout at all**, so a slow provider consumes the
function's 30 seconds and the caller gets nothing. Node's `fetch` does not time out by default; an
`AbortSignal` is required and is absent.

**INT-D006 · A retry is only safe if the call is idempotent, and idempotency is asserted, not assumed**

Every outbound call that can create or move something carries an idempotency key derived from the
business fact — the requirement item and the attempt, not a random value — so a retry after a timeout
reaches the same operation rather than making a second one. **Where a provider does not support an
idempotency key, the call is not retried**, and that limitation is recorded against the integration
rather than papered over. **Stage 14's rule holds: do not require a provider to send, or accept, a
header it does not support.**

**INT-D007 · A repeatedly failing integration is suspended, and its tenant is told**

Repeated failure moves the integration to `suspended`, stops further attempts, and surfaces the state
to that school's administrator. **A queue that retries forever against a revoked credential is a way to
not notice a revoked credential.**

**The threshold, the cooldown and the resume behaviour are Stage 18's numbers.** Stage 17 fixes only
that suspension exists, that it is visible to the tenant, and that resuming is deliberate.

**INTAR-004 · No outbound call happens inside the I-2 transaction.** Stage 15's DBD-030 is one
transaction on one connection; a network call inside it holds database locks for the length of somebody
else's outage. **Provider calls happen before or after, never within.**

---

## 8. Inbound callbacks

Stage 16 raised three defects on the one inbound callback that exists. Stage 17 states the full
contract that any callback must satisfy, so the next one does not repeat them.

**ID-4 · The five gates an inbound message passes**

```
POST /api/webhooks/…
  1  RAW BYTES           req.rawBody — captured by express.json's verify hook, ALREADY AVAILABLE
                         never JSON.stringify(req.body)                            C-80
  2  SIGNATURE           HMAC over exactly those bytes · timingSafeEqual · fail closed
  3  FRESHNESS           a timestamp INSIDE the signed material · ±5 minutes       C-81
  4  UNIQUENESS          provider_events · DBI-021 UNIQUE(integration_id, external_event_id)
                         a second delivery is a NO-OP that returns 200             C-81
  5  TENANT              resolved from the INTEGRATION, not from the reference     C-41
                         the reference is then resolved WITHIN that school   DBI-012
  ───────────────────────────────────────────────────────────────────────────────
  ⇒ a provider_event row.  A SIGNAL.  Nothing is settled.                          SECAR-031
```

**INT-D008 · A callback returns 200 for anything it has already seen**

A provider that receives a non-200 retries, so an endpoint that errors on a duplicate teaches the
provider to send more duplicates. **The de-duplicated case is a success, not a conflict** — the work is
already done.

**INT-D009 · A callback endpoint is idempotent, side-effect-bounded and reachable only by signature**

It creates a `provider_event` row and, at most, a notification that finance has something to look at.
**It never writes an allocation, a stock movement, a settlement or a custody event.** The current
handler calls `storage.confirmPayment` directly — an unauthenticated, externally triggered path into
the atomic invariant, which is what Stage 16's SECAR-031 forbids.

**INTAR-005 · An unrecognised event kind is recorded and ignored, never rejected.** Providers add event
types; a 4xx on an unknown kind turns a provider's product change into an outage.

**INTAR-006 · Every callback endpoint is registered in the module that owns the integration.**
**C-29** already records that the payment callback lives in `message.routes.ts`; Stage 13's boundaries
resolve it and Stage 16's SEC-D056 states it. Repeated here because it is an integration rule, not only
a file-layout one.

---

## 9. The payment provider

**INT-D010 · There is no payment provider, and this document says so plainly**

`paymentIntegration.ts` is a **seam with an unimplemented body**, addressed to *"AntiGravity Integration
Team"* and waiting for another company's endpoint and credentials. `isExternalIntegrationEnabled()`
returns false without both values, so **in the current deployment the push flow does nothing** and only
the callback exists.

**This is recorded as absence, not described as an integration** (INT-P13). Everything below is the
contract the provider must meet when one is chosen — it is not a description of behaviour.

| Requirement | Why |
|---|---|
| signs its callbacks over the raw body | C-80 |
| includes a timestamp in the signed material | C-81 |
| supplies a stable event identifier, or a payload stable enough to hash | DBI-021 |
| supports an idempotency key on creation | INT-D006 |
| supports **per-account credentials** | INTQ-1 |
| reports currency explicitly | every amount in this system is `numeric(10,2)` GBP |
| can be reconciled from an exported file | §10 — the fallback that already works |

**INT-D011 · The reconciliation import is the fallback, and it is not a lesser path**

`stripe-spreadsheet-importer.ts` (344 lines) plus `payment-matcher.ts` (264) and
`payment-verification-service.ts` (554) already implement provider reconciliation **from an uploaded
file**, under `CAP-*` and a finance person's judgement. **That is a complete, working, tenant-scoped,
human-confirmed path that needs no provider API at all.**

It should be treated as the primary reconciliation mechanism rather than a stopgap: it produces the
same `provider_event` rows, it is bounded by a file a person chose to upload, and **it cannot be
triggered by anyone outside the school.** A live API adds timeliness, not correctness.

**The one thing it inherits: `xlsx@0.18.5` — C-58**, already carried, a terminal release with no fix
available on that line. It parses a file an authenticated finance user uploads, which bounds who can
reach it, and **it does not bound what a malicious spreadsheet can do once reached.** Stage 17 keeps
C-58 open and states its target at §12.

---

## 10. Email

**INT-D012 · Email is Class B: delivery only, never identity, never authority**

An address proves nothing until a verification fact exists (Stage 16 SEC-D030). Stage 17 adds the
provider-side rules.

**INT-D013 · The sender identity is configured, singular per tenant-or-platform, and never
hard-coded**

```
TODAY   RESEND_API_KEY || EMAIL_API_KEY          ◄── two names, one absent from the schema   C-82
        RESEND_FROM_EMAIL || EMAIL_FROM          ◄── two names, one absent from the schema
        || "noreply@scholarshelf.co.uk"          ◄── a hard-coded fallback
        new Resend(key) at MODULE LOAD           ◄── one key for every tenant, fixed at boot

TARGET  one name per setting, in the validated schema                       Stage 16 SEC-D061
        no literal fallback — absent configuration means email is DISABLED, and says so
        the client is built per call from the resolved integration row      INT-D002
```

**A hard-coded sender is worse than none.** With no key configured, `sendEmail` correctly warns and
returns false; with a key configured but no sender, the product silently sends every school's mail from
an address nobody chose. → **C-94**.

**INTQ-2 asks whether the sender is per-school or platform-wide** (§16). Both are defensible and the
answer changes what schools must do at onboarding.

**INT-D014 · Email content is escaped, and brand values are validated on read as well as on write**

`wrapEmail()` interpolates `branding.primaryColour` into a `style` attribute. `normalizeHexColour`
exists and is called in **one file, on write paths only**; `getEmailBrandingForSchool` returns the
stored value raw. **The email template is outside the CSP that protects every other surface**, so it is
the one place where an unvalidated brand value has no second line of defence. → **C-95**.

```
TARGET   normalise on write   — keep, and extend to EVERY write path that touches a colour column
         normalise on read    — getEmailBrandingForSchool re-validates before returning
         escape at render     — the template escapes every interpolated value regardless
```

**Three layers for one field, and that is proportionate**: the value is attacker-influenceable by a
school's own IT user, it is rendered in a client the product does not control, and it is sent to
guardians. **Stage 15 DBT-065 `site_presentation` and DBT-003 `school_identity` are where these values
land after the branding split; the validation rule attaches to the column, not to the route.**

**INTAR-007 · A delivery failure never changes a business outcome**, and never carries the message
contents into a log (Stage 16 SECAR-017, SEC-D025). `sendEmail` already returns a boolean rather than
throwing, which is the right shape; **what callers do with the `false` is the defect BR-124 records.**

**INT-D015 · A bounce is a DELIVERABILITY fact, and it never rewrites an IDENTITY fact**

**This corrects the proposed draft, which said a hard bounce "marks the address unverified".** That
conflates two different facts:

```
EMAIL OWNERSHIP VERIFICATION   credentials.email_verified_at
   a historical fact: this person PROVED control of this address, on that date
   a mailbox that bounces today does not un-prove what happened last term

EMAIL DELIVERABILITY           delivery_attempts (DBT-054) + suppression state
   an operational fact: messages to this address are currently failing
```

**A provider's bounce report must never mutate `email_verified_at`.** Doing so would let an external
system revoke a person's verified identity — which is Stage 16's SECAR-017 (a failed send never changes
a business outcome) and INT-P5 (a provider proves its sender, nothing else) in one line.

```
TARGET   hard bounce / complaint
           → recorded as the outcome on DBT-054 delivery_attempts, with a bounded failure_class
           → future delivery to that address may be SUPPRESSED per Stage 18's operational policy
           → the school and the person see a delivery problem they can act on
           → email_verified_at is UNTOUCHED
```

**Where the durable suppression fact lives — checked against locked Stage 15 before proposing anything
new.** **DBT-057 `notification_preferences`** already carries `(school_id, person_id,
notification_kind, channel, enabled)`. A provider-driven suppression is **not** a preference: writing it
there would let a bounce masquerade as a choice the person made, and a person who later fixes their
mailbox would find their own preferences silently rewritten. **DBT-054 records each attempt but holds no
current-state fact**, so neither structure represents "this address is currently undeliverable" without
abusing its meaning.

**Stage 17 therefore raises a traceable Stage 15 amendment rather than adding a column silently:
A15-002 (§36).**

**A school chasing a family that never received anything is a support cost this record removes**, which
is the reason to build it at all.
---

## 11. Object storage

**INT-D016 · The seam exists and is kept; the driver is SELECTED here (§34) and provisioned by Stage 21**

`storageProvider.ts` defines `put` / `delete` / `getUrl`, ships a `DataUriStorageProvider` that
preserves today's behaviour exactly, and switches on `STORAGE_DRIVER`. **This is a good piece of work
and it is preserved unchanged in shape.** Stage 15's DBD-036 (no file bytes in PostgreSQL) and Stage
16's SEC-D049 (signed URLs after an authority check) are what it will carry.

Two corrections attach to it, neither about the seam:

| | |
|---|---|
| `STORAGE_DRIVER` is read from raw `process.env` | **C-82** — it belongs in the validated schema |
| `getUrl(key)` returns the key for the data-URI driver | correct for that driver; **the S3 driver must return a SIGNED, short-lived URL, never a public one** — Stage 16 SEC-D049 |

**INTAR-008 · The object-store driver never returns a durable public URL for anything but published
site media.** Stage 16's SEC-D050 makes published site media the only public class; everything else is
signed and expires.

**INT-D017 · Migration off data-URIs is MIG-11, and the bytes are copied before the column is dropped**

Stage 15 already sequenced this: **MIG-11 copies out, MIG-14 drops** — the only irreversible step, after
a soak and owner approval. **Stage 17 adds no new migration and changes none.**

---

## 12. Malware scanning and file parsing

**INT-D018 · A scanner is required by Stage 16's `verified` state, and no scanner exists**

Stage 16's SEC-D046 makes `verified` a gate before `published`. **Nothing implements it.** Stage 17
states the requirement here and **makes the selection at §34.3**, against verified official evidence.

| Requirement | |
|---|---|
| scans bytes, not extensions | the magic-byte check in `branding.ts` is already correct and stays |
| a clean verdict is required to reach `published` | a timeout or an error is **not** a clean verdict |
| an unavailable scanner **queues**, it does not pass | Class B degradation: the upload is accepted and held at `verified`-pending |
| the verdict vocabulary is CLEAN · INFECTED · ERROR/UNAVAILABLE | **ERROR is never treated as CLEAN** |
| an object-store-native scanner avoids standing compute | the locked topology is serverless and **cannot host a scanning daemon** |

**INT-D019 · The spreadsheet parser is a trust boundary, and it is treated as one**

`xlsx@0.18.5` is on a terminal release (**C-58**). It is reached from three files — enrolment import,
the template generator, and the Stripe importer — and it parses a file a person uploaded.

```
TARGET   parse in a bounded context: size cap, cell-count cap, no formula evaluation,
         no external-reference resolution, a hard wall-clock limit
         treat every parsed cell as untrusted input (Stage 16 SEC-D043)
         MIGRATE off the terminal release, or accept the residual EXPLICITLY with the
         bounding above recorded as the compensating control
```

**C-58 is not closed here.** Stage 17 states what bounding is required either way, because a
replacement parser that is fed unbounded input is the same defect with a newer version number.

---

## 13. Infrastructure providers

**INT-D020 · Neon is Class A and holds everything, and that is the whole of its trust statement**

`@neondatabase/serverless@0.10.4` (HTTP) plus `pg@8.21.0` (pooled), both locked by Stage 11 and narrowed
by **A13-001**: unscoped reads may use HTTP; scoped reads and every transaction use node-postgres.
Stage 16's SEC-D084 showed the credential path is currently on the wrong one.

**INTAR-009 · The processing region is settled before go-live** — **C-63**, already carried, target
resolved and implementation open. Data about UK schoolchildren is the reason it matters; the technical
configuration is Stage 21's and is currently absent.

**INT-D021 · Vercel is Class A and holds request metadata and logs**

Which makes Stage 16's §31 prohibited-log list an **integration** control as well as a security one:
**everything permitted into a log line is data handed to a Class A sub-processor.**

---

## 14. Security headers are configuration, and configuration has one home

**ID-5 · Two policies, one response**

```
              ┌────────────── helmet() in app.ts ──────────────┐
  response ───┤  CSP: script-src 'self' 'unsafe-inline'         │
              │       connect-src 'self' wss: ws:               │
              │  HSTS: max-age=63072000; includeSubDomains      │
              └────────────────────────────────────────────────┘
              ┌────────────── vercel.json headers ─────────────┐
              │  CSP: script-src 'self' 'unsafe-inline'         │
              │       connect-src 'self'                        │
              │       frame-ancestors · base-uri · form-action   │
              │  HSTS: …; includeSubDomains; preload   ◄── DIFFERENT
              │  + Permissions-Policy · COOP · CORP              │
              └────────────────────────────────────────────────┘

  the browser enforces BOTH CSPs — the intersection
  the two HSTS headers do NOT intersect; one of them wins, and which one is a
  property of the edge, not of a decision anyone made
```

**INT-D022 · Security headers are defined in exactly one place, and that place is the application**

```
TARGET   helmet() in app.ts is the single source of truth
         vercel.json's `headers` block is REMOVED
         every directive vercel.json currently adds and helmet does not
           — frame-ancestors · base-uri · form-action · Permissions-Policy · COOP · CORP —
           MOVES INTO helmet(), so nothing is lost
         Stage 16 SEC-D037/D038's target policy then applies everywhere, including
           local and self-hosted runs, which today get a materially weaker policy
```

**The application, not the platform, because the platform's headers only exist on the platform.**
A developer running locally, a security test running in CI, and a self-hosted deployment all currently
receive a different policy from production — **so the thing that gets tested is not the thing that
ships.** → **C-91**.

**A16-001 is raised**, because Stage 16 §21 states as fact that HSTS `preload` *"is not added yet"* and
defers it to Stage 21. **`vercel.json` adds it today.** The full amendment is at §18.

**INTAR-010 · `upgrade-insecure-requests` and `preload` are deployment-affecting and are decided with
Stage 21**, but they are *configured* in one place with everything else.

---

## 15. Scheduled execution

**INT-D023 · Vercel Cron is the trigger; it is not the scheduler**

```
vercel.json   crons: [ { path: "/api/cron/run", schedule: "0 7 * * *" } ]     ONE job, ONCE a day
```

Stage 15 made **DBT-069 `jobs`** (DM-055) the durable record, with **DBI-020**'s two scope-explicit
partial uniques correcting the NULL-distinctness defect in `cron_job_runs`. Stage 13's **APP-049** makes
`application/jobs/` the only gateway caller. Stage 7's **CAP-093** is the capability, **SC-10** the
scope.

**Stage 17 adds the trigger's own rules:**

| Rule | |
|---|---|
| the trigger authenticates by a shared secret, constant-time, fails closed | **already correct** |
| `CRON_SECRET` is in the validated schema, ≥32 chars, required in production | Stage 16 SEC-D062 — **C-82** |
| **the TARGET endpoint is Stage 14's API-278 `POST /api/internal/jobs/run` (CAP-093, SC-10)** | see INT-D025 |
| a run is bounded by the function budget and **resumable** | already correct |
| **a partial run is re-invoked, not left until tomorrow** | **C-96** |

**INT-D024 · A partial drain schedules its own continuation**

The current code stops before a school it cannot finish, returns `remaining: N`, logs a warning — and
**nothing comes back.** Its own comment correctly diagnoses the previous version's identical failure:
the design assumed *"successive ticks that a once-a-day schedule never produces."*

```
TARGET   ENQUEUE  and  DRAIN are separate concerns
         a trigger makes eligible work eligible; it does not have to finish it
         remaining work stays IMMEDIATELY ELIGIBLE, never parked until tomorrow
         the response never reports success while work remains          INTAR-011
```

**Splitting enqueue from drain is the fix**, and it is what makes the number of schools independent of
one function's wall clock. A trigger that must also finish all the work inside one invocation is a
design with a school count baked into it.

**Stage 18 owns the numbers** — claim size, drain budget, concurrency, lease, backoff and continuation
timing. **Stage 21 owns the schedule.** Stage 17 owns only the requirement that continuation exists.

**INTAR-011 · A run that did not complete is visible as an incident, not a warning in a log.** Today
`remaining > 0` produces `console.warn` and a `200`. **A response that says `ok: true` while schools
went unprocessed is the shape BR-125 forbids** — a failed operation reported as a settled fact.

**INT-D025 · The TARGET scheduler endpoint is Stage 14's API-278; the current route is legacy evidence**

**This corrects the proposed draft, which described the target as narrowing what a `GET` may reach.**
That framing quietly promoted a legacy route to a target and would have overridden locked Stage 14.

```
LOCKED TARGET     API-278   POST /api/internal/jobs/run    CAP-093 · SC-10      Stage 14
LEGACY EVIDENCE   GET/POST  /api/cron/run                  shared secret        current tree
```

**Stage 17 records only what the platform's trigger transport does today** — Vercel Cron issues `GET`,
which is why the legacy route accepts one — **and does not redefine Stage 14's target.** How a `GET`-only
trigger transport reaches a `POST` target endpoint is a **Stage 21 platform-configuration question**, not
a reason to change the contract.

Two current-tree observations, recorded because they widen what the shared secret buys: the global write
limiter covers only `POST/PUT/PATCH/DELETE` **and exempts `/api/cron/` anyway**, so neither verb is
limited; and `?school=` lets the secret-holder scope a run to one tenant. **Neither is exploitable
without the secret.** Under API-278 the tenant selector is a request field under CAP-093, audited by
name.

**Stage 17 does not set a cadence.** The proposed draft's "a short-interval trigger drains the queue"
is withdrawn: **claim size, drain budget, concurrency, lease and continuation timing are Stage 18's;
the actual cron schedule is Stage 21's.** Stage 17 fixes only that **a partial run must leave its
remaining work immediately eligible, and must not report success** (INTAR-011).

---

## 16. Owner decisions — RESOLVED

Both questions this stage raised have been decided by the owner. **They are recorded here as answers,
with what each one costs. Neither is reopened.**

---

### INTQ-1 · Payment-provider topology — **DECIDED: A · each school owns its own account**

```
EACH SCHOOL      connects its own payment provider account
FUNDS            flow to that school's own provider/bank arrangement
BYTHUB           supplies the software and the integration
                 does NOT centrally collect school funds
                 does NOT remit them onward as the normal product model
```

**This does not add live online payments to V1.** The near-term product is unchanged and remains:

```
PROVIDER STATEMENT → IMPORT / RECONCILIATION → MATCH / FINANCE INVESTIGATION
                   → ELIGIBLE SETTLEMENT → SCHOLARSHELF CONFIRMATION → I-2
```

**INTQ-1 = A fixes the future account topology, not a V1 feature.** When a live provider is eventually
introduced it plugs into the same seam, and school A's account is school A's — never one BytHub merchant
account receiving every school's money. Changing that requires a traceable owner amendment supported by
qualified legal and commercial review.

**Why it fits the locked schema exactly.** Stage 15's **DBT-040 `integrations`** is `school_id NOT NULL`,
school-owned and provider-neutral, under MOD-007. **Option A is the shape that table was already built
for**, which is why it needs no amendment (§5, INT-D003).

**What it costs:** every school must complete its own provider onboarding before it can take a live
payment. Under the V1 reconciliation model that cost is not yet incurred, which is the right order —
**the topology is decided before it is depended on.**

---

### INTQ-2 · Email sender identity — **DECIDED: C · school display identity, ScholarShelf sending infrastructure**

```
From:                "Manchester Sudanese School via ScholarShelf"
Envelope / sending:  a verified ScholarShelf-controlled sending domain
Reply-To:            OPTIONAL — the school's deliberately configured public contact address
DNS work per school: NONE
```

**No school needs to understand SPF, DKIM, DMARC or its own DNS provider in order to start using
ScholarShelf.** For a primary school with no IT department, that is the difference between adopting the
product and not.

**What this does NOT license.** The platform sending identity is **explicit validated configuration**
(Stage 16 SEC-D061), never `RESEND_FROM_EMAIL || "some literal address"`. **Missing sender configuration
in production disables the email subsystem loudly** — startup or readiness failure per the operational
contract Stage 18 fixes — **it never silently sends from a hard-coded address.** This is the target for
**C-94**.

**School display identity may use** the school name, its permitted logo and its identity fields, subject
to Stage 16 escaping, branding validation (**C-95**, INT-D014) and data minimisation.
**Reply-To must be a deliberately configured public contact field.** A private admin address, a finance
address, a guardian address or a staff account address is never used as Reply-To merely because one
exists in the record.

**Per-school verified sending domains are NOT built for V1.** No SPF wizard, no DKIM wizard, no
sender-domain verification UI, no domain subscription. A future owner amendment may add it as an
optional capability; **designing that flow now would be building for a decision nobody has made.**

---

**Open owner questions arising from these two: 0.**

**One genuinely new question emerged from provider verification and is recorded at §39 as INTQ-3.** It is
not a restatement of either question above, and it is not an engineering choice between two vendors — it
is a data-residency posture question that provider evidence forced into the open. **§16 of the owner's
instruction requires it not be hidden merely to reach zero.**

---

## 17. The dependency register — declared against used

Every entry in `package.json`'s `dependencies` was cross-checked against every `import` in `server/`,
`client/`, `shared/` and `api/`. **Four integration packages are declared and imported nowhere.**

**ID-6 · What the manifest claims, and what the code does**

```
DECLARED AND USED                          DECLARED AND IMPORTED NOWHERE
  resend@6.12.4          email               @supabase/supabase-js@2.106.2
  @neondatabase/         database            @supabase/ssr@0.10.3
    serverless@0.10.4                        passport@0.7.0
  pg@8.21.0              database            passport-local@1.0.0
  connect-pg-simple@10   sessions
  xlsx@0.18.5            parsing   C-58    ── a database-and-auth PLATFORM that competes with
  multer@2.1.1           uploads              the locked Neon + Drizzle stack, and an
  file-type@22.0.1       type detect          AUTHENTICATION FRAMEWORK this product does not use
  helmet@8.2.0           headers
  bcryptjs@2.4.3         hashing   → Argon2id
```

**INT-D026 · A dependency that nothing imports is removed, and its removal is a reviewed change**

Four packages, and the two that matter are the two about credentials:

| Package | What its presence implies | What is true |
|---|---|---|
| `@supabase/supabase-js` · `@supabase/ssr` | the product uses Supabase for data or auth | **it does not.** Stage 11 locked Neon + Drizzle; nothing imports Supabase |
| `passport` · `passport-local` | authentication runs through Passport strategies | **it does not.** Stage 16 read the whole auth path: `express-session` plus `bcrypt.compare`, hand-rolled |

**Why this is a conflict and not tidying.** Three separate costs, all real:

1. **A security auditor reading `package.json` reaches a wrong conclusion about how this product
   authenticates** — and `package.json` is the first file most audits open.
2. **Unimported code is still installed, still resolved, still in the lockfile and still in the
   deployment bundle**, so it is supply-chain surface with no compensating benefit and nobody watching
   its advisories.
3. **A future contributor finding `@supabase/ssr` present will reasonably assume it is sanctioned**, and
   the locked stack acquires a second data platform by inference rather than by decision.

→ **C-92**.

**INTAR-012 · Removal is verified by a build and a test run, not by inspection.** These four are
believed unused on the evidence of a full-tree import search; **the baseline remains UNVERIFIED (E2)**,
so removal is proposed as a change Stage 22 makes and CI proves — **not asserted here as safe.**

---

## 18. Supply-chain discipline

**INT-D027 · Every dependency that reaches a trust boundary is pinned, reviewed and has a named owner**

| Class | Examples | Rule |
|---|---|---|
| parses untrusted input | `xlsx` · `multer` · `file-type` | **exact version**, advisory-watched, bounded at the call site (§12) |
| handles credentials | `bcryptjs` → argon2 · `connect-pg-simple` · the TOTP library | **exact version**, change requires a security review |
| sets security headers | `helmet` | exact version; **and only one place configures it** (§14) |
| everything else | UI, formatting | caret ranges acceptable |

**`^` ranges are currently used throughout, including on `xlsx`, `multer` and `bcryptjs`.** A caret
range on a parser of untrusted input means the version that ships is decided by whenever the lockfile
was last regenerated. **The lockfile does pin it; the manifest does not say so**, and the two express
different intentions.

**INTAR-013 · A dependency with a known unfixable advisory is either replaced or its residual is
recorded with the compensating control.** `xlsx@0.18.5` is the live instance (**C-58**), and §12 states
the bounding required either way.

**INT-D028 · Adding an integration dependency is a decision recorded in this document.** The four
unused packages are the argument: they entered without a decision and stayed without one.

---

## 19. Amendment raised against locked Stage 16 — A16-001

Stage 16 was locked on 30 August 2026. Its §54-equivalent locking discipline provides for traceable
amendments in the form `A16-nnn` and forbids silent rewriting. **Stage 17 read a file no earlier stage
opened, and one locked statement is contradicted by it.**

```
A16-001                              raised by Stage 17, 30 August 2026
AFFECTS      SECURITY_AUTH_PRIVACY.md §21 — SEC-D037 · SEC-D038 · SEC-D039
TYPE         CORRECTION OF FACT, plus a narrowing of where the policy is defined
STATUS       RECORDED — to be written into SECURITY_AUTH_PRIVACY.md's amendment register
```

**What Stage 16 states.** §21 describes the security headers as those `helmet()` sets in `app.ts`, gives
a directive-by-directive target table, and concludes: **"HSTS is kept as configured and `preload` is not
added yet… it is a deployment decision (Stage 21)."**

**What is actually true.** `vercel.json` sets a **second, independent** `Content-Security-Policy` on
every response, **and** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
**`preload` is already present in production.** Stage 16 did not open `vercel.json`; its evidence list
names `server/` files and `shared/schema.ts` and does not include it.

| Stage 16 said | Corrected |
|---|---|
| HSTS has no `preload` | **`preload` is set today, on the edge** |
| the CSP is what `helmet()` sets | **two CSPs are served; the browser enforces the intersection** |
| §21's table is the effective policy | **it is one of two contributing policies**, and the effective one is stricter in `connect-src`, `frame-ancestors`, `base-uri` and `form-action` |
| `preload` is a Stage 21 decision | **it is a Stage 21 decision that was already taken**, and un-taking it is slow: `preload` is irreversible on a browser timescale, which is precisely why Stage 16 wanted to defer it |

**What does not change.** SEC-D037 stands entirely — **`'unsafe-inline'` is in `script-src` in *both*
policies**, so C-83 is unaffected and if anything better evidenced. SEC-D038's target directives stand;
they now apply to one merged policy rather than to `helmet()` alone.

**Why an amendment and not a conflict.** Stage 16's reasoning is sound; **its evidence was incomplete in
a way it could not have known from the files it read.** The header *duplication* is a defect and gets
its own identifier (**C-91**); the *statement* about `preload` is a fact that needs correcting, and
correcting locked text is what an amendment is for. **Both are recorded, separately, because they are
different kinds of wrong.**

**INTAR-014 · Any later stage that changes the effective security headers checks BOTH locations until
§14's consolidation ships.** Until then, a change made in one place is not the policy.

---

## 20. What crosses each boundary

**ID-7 · Personal data leaving the system, by provider**

```
Neon              EVERYTHING            Class A · the database · DPA governs
Vercel            request metadata      Class A · plus whatever §31's log list permits
                  + application logs             ── the prohibited-log list is an INTEGRATION control

Resend            recipient address     Class B · the message body, which contains:
                  + message contents             a child's first name, a school name, an amount,
                                                 a single-use link  ── never a credential at rest

object store      file bytes            Class B · logos, uploaded documents, and whatever a
                                                 school chooses to upload
malware scanner   file bytes            Class B · the same bytes ── an on-premise scanner
                                                 avoids this transfer entirely

payment provider  reference · amount    Class C · and, in the current placeholder interface,
                  · payer email                  studentName and studentClass  ◄── see below

breached-password five hash characters  Class D · k-anonymity ── NO account data leaves
   corpus
```

**INT-D029 · The payment request is minimised, and today's placeholder interface is not minimal**

`ExternalPaymentRequest` currently declares `studentName`, `studentClass`, `parentEmail`, `amountGBP` and
an itemised list with book titles. **A payment provider needs an amount, a currency, a reference and a
contactable payer. It does not need a child's name, their class, or the titles of the books they were
issued.**

```
TARGET   reference · amount · currency · payer email · a description that names NO CHILD
         line items ONLY where the provider requires them for its own compliance,
           and then by catalogue identifier, never by book title
```

**A book title is a small disclosure and a real one** — a reading-support title or a faith-specific text
tells a third party something about a child. **INT-P9 is not abstract here.**

**INTAR-015 · Every field in an outbound payload is justified at the call site**, and the justification
is a comment naming the provider requirement it satisfies. A field with no justification is removed.

---

## 21. The sub-processor register

Extends Stage 16 §40 with the classification, the credential scope and the exit position.

| Provider | Class | Credential scope | Personal data | Exit |
|---|---|---|---|---|
| **Neon** | A | platform | **all of it** | `pg_dump` — standard PostgreSQL, **no proprietary format**; region open (**C-63**) |
| **Vercel** | A | platform | request metadata, logs | the application is a standard Node build; `vercel.json` is the only lock-in, and §14 shrinks it |
| **Resend** | B | platform, or per school (**INTQ-2**) | recipient address, message contents | messages are generated from templates the product owns; **only the sending reputation is lost** |
| object store | B | platform | file bytes | S3-compatible required (§25) — a bucket copy is the exit |
| malware scanner | B | platform | file bytes | stateless; no data to retrieve |
| payment provider | C | **per school (INTQ-1)** | reference, amount, payer email | **reconciliation by file export must be possible** — §9, and it is the fallback that already works |
| breached-password corpus | D | none | **none** | trivial |

**INTAR-016 · A provider that cannot be exited is not selected.** Every row above states its exit
position, and §24 makes it a selection criterion rather than a discovery.

**INTAR-017 · The register is maintained, and a new provider is added to it before it is called once.**
Stage 16's SECAR-038 makes the same requirement of the personal-data map, for the same reason: a
register nobody updates is worse than none, because people rely on it.

---

## 22. Degradation — what happens when each provider is down

**ID-8 · Failure behaviour, by class**

```
Neon down            ─► the product is DOWN. Honest 503, no memory fallback for credentials
                        (Stage 16 SEC-D085), no silent dual-persistence  (C-71)

Vercel down          ─► the product is down. Nothing to design.

Resend down          ─► notifications are WRITTEN (they are I-2's required consequence,
                        Stage 15 DBD-030) and DELIVERY is retried.
                        A failed send NEVER changes a business outcome        SECAR-007
                        and NEVER logs the link                               SEC-D025

object store down    ─► uploads are refused with an honest error.
                        EXISTING objects still serve. Nothing is half-written.

scanner down         ─► uploads are ACCEPTED and HELD before `verified`.
                        Never passed through un-scanned.                      INT-D018

payment provider     ─► the push flow is unavailable and SAYS SO.
   down                 Reconciliation by file import still works entirely.   INT-D011
                        Settlement is UNAFFECTED — it was never the provider's decision.

corpus down          ─► the breach check is SKIPPED and the password is accepted.
                        FAIL OPEN, deliberately.                              SEC-D006
```

**INT-D030 · The payment provider being down cannot stop a school operating**

This is the most important line in the section. Because a provider signal was never authoritative
(SECAR-031), and because reconciliation by file import is a complete path, **a school whose payment
provider is unavailable can still record money, confirm settlements, allocate books and hand them to
children.** The invariant that looked like a purity argument in Stage 15 is what buys this.

**INTAR-018 · Every degraded state is visible to the person it affects**, in their own language, at the
point they meet it — never only in a log. **A queued upload and a lost upload look identical to the
person who uploaded it unless the product says which one happened.**

---

## 23. Observability of integrations

**INT-D031 · Every integration call records an outcome row, and no raw provider text is stored**

`integrations.last_success_at`, `last_failure_at` and `last_failure_class` (§5) plus
`provider_events` for inbound and `delivery_attempts` for email. **`last_failure_class` is a bounded
vocabulary** — `timeout` · `auth_rejected` · `rate_limited` · `bad_request` · `provider_error` ·
`unreachable` — never the provider's message (INT-P8, Stage 16 SEC-D063).

**INTAR-019 · A school administrator can see the state of their school's integrations** without
contacting support: configured or not, last success, last failure class, and whether it is suspended.
**An integration that only BytHub can see the health of is an integration schools cannot trust.**

**INTAR-020 · Integration failure rates are alertable**, and the three that matter are named: a rise in
callback signature failures (someone is probing, or a secret rotated on one side only), a rise in email
hard bounces (a domain or reputation problem), and any Class C suspension.

---

## 24. Exit and portability

**INT-D032 · Portability is designed at selection, and the format is stated before the contract**

| Asset | Portable form |
|---|---|
| the database | `pg_dump` — **no provider-proprietary types are used anywhere in Stage 15's schema** |
| objects | S3-compatible API, so a bucket-to-bucket copy is the migration |
| email templates | owned by the product, in the repository, not in the provider |
| provider payment records | **`provider_events` holds the tenant's own copy** of every signal received |
| audit and console records | Stage 19's, in PostgreSQL |

**INT-D033 · The product never depends on a provider's storage as the only copy of a business fact**

`provider_events` exists so a school's reconciliation history survives leaving the provider.
**A reconciliation that can only be reconstructed by logging into a third party's dashboard is not the
school's record.**

---

## 25. Selection criteria — not selection

**This section states the criteria; §33–§34 make the selections against them.**

**The proposed draft said "Stage 17 selects nothing" and "Stage 21 selects providers." Both were
wrong, and they contradicted locked text.** Stage 11's technology table assigns the object-storage
provider, the error-monitoring platform and the payment provider to **Stage 17** — *"provider chosen at
Stage 17"* is its own wording. The corrected division:

```
STAGE 17   SELECTS / KEEPS / ADDS / DEFERS / REJECTS the provider
           defines the provider-specific contract        INT-C\* · §35
           verifies eligibility against official evidence
           records the data flows

STAGE 21   creates and provisions the account
           supplies the secrets
           configures the region FROM THE OPTION LOCKED HERE
           configures DNS and environment
           verifies the production setup
```

**Stage 21 never decides which vendor the architecture uses.**

**Every provider, whatever the class:**

```
□  a written DPA, and a sub-processor list of its own
□  UK or EU processing available and configurable        ── C-63
□  credentials that can be rotated WITHOUT downtime, and scoped down
□  an exit path in a standard format                     ── §24
□  a documented incident-notification commitment
□  no requirement to embed a third-party script in our pages   ── Stage 16 SECAR-044
```

| Class | Additional |
|---|---|
| **C — payment** | per-account credentials (**INTQ-1**) · signs over the raw body · timestamp inside the signed material · stable event identifier · idempotency key on creation · **file export for reconciliation** |
| **B — email** | per-domain sending if **INTQ-2 = B** · bounce and complaint webhooks · no tracking pixels by default |
| **B — object store** | S3-compatible · server-side encryption · short-lived signed URLs · no public-by-default buckets |
| **B — scanner** | bytes not extensions · a clean verdict is explicit · an on-premise option preferred, because it removes the transfer |

**INTAR-021 · A provider that requires a client-side script is rejected**, because Stage 16's SECAR-044
forbids third-party script in a product handling children's records, and the CSP in §14 enforces it.

---

## 26. Verifying integrations

**INT-D034 · Every integration control names its test, and an integration with no test is not
enabled**

| Control | Verified by |
|---|---|
| callback signature over raw bytes | a **byte-exact fixture**; the same body re-serialised must **FAIL** |
| callback replay | the same signed request twice; the second is a no-op returning 200 |
| callback freshness | a fixture signed 10 minutes ago is rejected |
| callback tenant binding | a reference belonging to school B, delivered on school A's integration, resolves to **nothing** |
| **no callback path reaches I-2** | an assertion that the handler writes only `provider_events` |
| outbound timeout | a stub provider that never responds; the request still answers within budget |
| outbound retry safety | a stub that times out then succeeds; **exactly one** business effect |
| suspension | three stubbed failures suspend the integration and surface the banner |
| email content escaping | a brand colour of `"; onload=…` renders inert |
| header consolidation | **one** CSP header and **one** HSTS header on a production-shaped response |
| cron continuation | more schools than the budget allows; **all** are processed without waiting a day |
| dependency removal | build and full test suite pass with the four packages removed |

**INTAR-022 · Integration tests run against stubs, never against a live provider**, and never against a
tenant's real credentials. A test suite that spends a school's money is not a test suite.

**INTAR-023 · The baseline remains UNVERIFIED.** Every claim in §2 is **E2 — read directly, not
executed** — and none of the tests above exists yet (**C-60**).
---

## 27. Decision index — INT-D001 … INT-D034

| INT-D | Decision | § |
|---|---|---|
| **INT-D001** | **class fixes credential scope, failure behaviour and authority — decided together** | 4 |
| **INT-D002 … INT-D003** | **a Class C integration is a DBT-040 row; a PLATFORM provider is validated configuration, NOT a DBT-040 row** | 5 |
| **INT-D004** | **Class C credentials are per-tenant; Class A platform-wide; Class B is INTQ-2** | 6 |
| **INT-D005** | **every outbound call has a timeout, a budget and a bounded retry** | 7 |
| INT-D006 … INT-D007 | retry only where idempotent; three failures suspend and tell the tenant | 7 |
| **INT-D008 … INT-D009** | **a duplicate callback returns 200; a callback writes a signal and nothing else** | 8 |
| INT-D010 | **there is no payment provider** — recorded as absence, not described as working | 9 |
| **INT-D011** | **reconciliation by file import is the primary path, not a stopgap** | 9 |
| INT-D012 … INT-D013 | email is delivery only; the sender is configured, never hard-coded | 10 |
| **INT-D014** | **brand values are validated on write AND on read, and escaped at render** | 10 |
| INT-D015 | bounces are recorded against the person | 10 |
| INT-D016 … INT-D017 | the object-storage seam is kept; migration is Stage 15's MIG-11/MIG-14, unchanged | 11 |
| **INT-D018 … INT-D019** | **an unavailable scanner queues and never passes; the parser is a trust boundary** | 12 |
| INT-D020 … INT-D021 | Neon holds everything; Vercel holds logs, so the log list is an integration control | 13 |
| **INT-D022** | **security headers are defined in ONE place, and that place is the application** | 14 |
| INT-D023 | Vercel Cron is the trigger, not the scheduler | 15 |
| **INT-D024** | **a partial drain schedules its own continuation — enqueue and drain are split** | 15 |
| INT-D025 | `POST` is the mutating verb; the `GET` alias is a platform exception, recorded as one | 15 |
| **INT-D026** | **a dependency nothing imports is removed, and the removal is proved by CI** | 17 |
| INT-D027 … INT-D028 | trust-boundary dependencies are pinned and owned; adding one is a recorded decision | 18 |
| **INT-D029** | **the payment payload carries no child's name, class or book titles** | 20 |
| INT-D030 | **a payment provider being down cannot stop a school operating** | 22 |
| INT-D031 | every call records an outcome; failures are classified, never quoted | 23 |
| INT-D032 … INT-D033 | portability is designed at selection; no provider holds the only copy of a fact | 24 |
| **INT-D034** | **every integration control names its test; untested means not enabled** | 26 |

---

## 28. Requirement index — INTAR-001 … INTAR-023

| Range | Subject |
|---|---|
| INTAR-001 … INTAR-003 | every integration is classified before it is built; configuration is read at call time, not module load; blast radius is stated where granted |
| INTAR-004 … INTAR-006 | **no outbound call inside the I-2 transaction**; unknown event kinds are ignored, not rejected; callbacks live in the owning module |
| INTAR-007 … INTAR-008 | a delivery failure never changes an outcome; the object driver returns signed URLs, never durable public ones |
| INTAR-009 … INTAR-011 | the processing region is settled (**C-63**); dependency removal is proved by CI; **a partial run is an incident, not a warning** |
| INTAR-012 … INTAR-014 | removal verified by build and tests; an unfixable advisory is replaced or its residual recorded; **both header locations are checked until consolidation ships** |
| INTAR-015 … INTAR-017 | every outbound field is justified at the call site; a provider that cannot be exited is not selected; the register is updated before first call |
| INTAR-018 … INTAR-020 | every degraded state is visible to the person it affects; schools can see their own integration health; failure rates are alertable |
| INTAR-021 … INTAR-023 | a provider requiring client-side script is rejected; tests run against stubs, never live providers; **the baseline remains UNVERIFIED at E2** |

---

## 29. Risks — INT-R001 … INT-R014

| INT-R | Risk | Severity | Mitigation |
|---|---|---|---|
| **INT-R001** | Two header policies disagree, and local/CI/self-hosted get a weaker one than production | **HIGH** | INT-D022 · **C-91** · **A16-001** |
| **INT-R002** | `preload` is already live and is irreversible on a browser timescale | **MEDIUM** | **A16-001** records it as taken, not pending; Stage 21 owns the consequence |
| **INT-R003** | Four unused packages, two of them credential-handling, in the bundle and the lockfile | **MEDIUM** | INT-D026 · **C-92** |
| **INT-R004** | One payment credential shared by every school | **HIGH** | INT-D004 · **INTQ-1** · **C-93** |
| **INT-R005** | One sender identity with a hard-coded fallback; two env names absent from the schema | **MEDIUM** | INT-D013 · **INTQ-2** · **C-94** · **C-82** |
| **INT-R006** | An unvalidated brand colour reaches an email HTML attribute, outside any CSP | **HIGH** | INT-D014 · **C-95** · **C-53** |
| **INT-R007** | Schools beyond the daily budget are not processed until the next day, reported as `ok: true` | **HIGH** | INT-D024 · INTAR-011 · **C-96** · **BR-125** |
| **INT-R008** | `xlsx@0.18.5` is terminal and parses uploaded files | **HIGH** | **C-58** · INT-D019's bounding is required either way |
| **INT-R009** | The callback still reaches `confirmPayment` directly | **CRITICAL** | INT-D009 · SECAR-031 · **C-80 · C-81 · C-41** |
| **INT-R010** | No outbound timeout exists; a slow provider consumes the whole function budget | **MEDIUM** | INT-D005 |
| **INT-R011** | The payment provider is unselected, so its contract requirements are untested against reality | **MEDIUM** | §25's list is written before selection, deliberately |
| **INT-R012** | No scanner exists, while Stage 16's `verified` state requires one | **HIGH** | INT-D018 — uploads queue rather than pass |
| **INT-R013** | Processing region unconfigured | **HIGH** | **C-63** · INTAR-009 |
| **INT-R014** | No integration test exists for any of the above | **HIGH** | **C-60** · INT-D034 names each one |

---

## 30. Conflicts

**Conflict identifiers are stable. They are never renumbered, never reused and never deleted.**

**ID-9 · The six new conflicts, by what they let happen**

```
POLICY DRIFT ───── C-91  two security-header sources; tested ≠ shipped
SUPPLY CHAIN ───── C-92  four unused integration packages, two about credentials
TENANCY ────────┬─ C-93  one payment credential for every school
                └─ C-94  one sender identity, hard-coded fallback
OUTPUT ─────────── C-95  unvalidated brand colour reaches email HTML
DELIVERY ───────── C-96  schools silently unprocessed, reported as success
```

**C-91 · Two Content-Security-Policies and two HSTS values are served from two places — ACTIVE**
*Evidence:* `helmet()` in `app.ts` and the `headers` block in `vercel.json`, both setting CSP on every
response; HSTS differs (`preload` present only in `vercel.json`); `connect-src`, `frame-ancestors`,
`base-uri` and `form-action` differ.
*Impact:* the browser enforces the intersection, so the effective policy is what neither document
describes; a change in one place is invisible in the other; and `vercel.json` applies only on the Vercel
edge, so **local, CI and self-hosted runs receive a materially different policy from production —
what is tested is not what ships.**
*Resolution:* **INT-D022** — one place, the application; `vercel.json`'s headers block removed and every
directive it uniquely contributes moved into `helmet()`. Also **A16-001** (§19).

**C-92 · Four integration packages are declared and imported nowhere — ACTIVE**
*Evidence:* `@supabase/supabase-js`, `@supabase/ssr`, `passport`, `passport-local` in `dependencies`;
no import of any of them in `server/`, `client/`, `shared/` or `api/`.
*Impact:* `package.json` misrepresents how the product authenticates and where its data lives — to
auditors, to new contributors, and to anyone assessing the locked stack; and four packages sit in the
lockfile and the bundle as unwatched supply-chain surface.
*Resolution:* **INT-D026**, with removal proved by CI (**INTAR-012**), not asserted here.

**C-93 · One payment credential is shared by every school — ACTIVE**
*Evidence:* `EXTERNAL_API_BASE_URL` and `EXTERNAL_API_KEY` read from `process.env` at module load;
Stage 15's per-school `integrations` table unused.
*Impact:* every school transacts under one identity; a credential change needs a redeploy; no school can
use a different provider; **one compromised key reaches every tenant's payment flow.**
*Resolution:* **INT-D002/D004**, and **INTQ-1** decides the commercial shape.

**C-94 · One email sender identity, with a hard-coded fallback — ACTIVE**
*Evidence:* `RESEND_API_KEY || EMAIL_API_KEY`, `RESEND_FROM_EMAIL || EMAIL_FROM ||
"noreply@scholarshelf.co.uk"`, client constructed at module load. `EMAIL_API_KEY` and `EMAIL_FROM` are
in no Zod schema (**C-82**).
*Impact:* every school's mail shares one address and one deliverability reputation, so **one school's
bounce rate degrades every school's delivery**; and a configured key with an unconfigured sender sends
silently from a default nobody chose.
*Resolution:* **INT-D013**, and **INTQ-2** decides per-school versus platform sending.

**C-95 · An unvalidated brand colour is interpolated into email HTML without escaping — ACTIVE**
*Evidence:* `wrapEmail()` interpolates `branding.primaryColour` into a `style` attribute;
`getEmailBrandingForSchool` returns the stored column raw; `normalizeHexColour` has exactly two calling
files, both write paths in `setup.routes.ts`.
*Impact:* a value reaching the column by any other write path lands inside an HTML attribute in an email
— **the one output channel that leaves the product's CSP behind**, rendered in a client the product does
not control, sent to guardians. This is **C-53** surfacing in a new place.
*Resolution:* **INT-D014** — validate on write, re-validate on read, escape at render.

**C-96 · A partial cron drain is never resumed, and reports success — ACTIVE**
*Evidence:* `/api/cron/run` stops at `DRAIN_BUDGET_MS`, returns `remaining: N` with `ok: true`, and
`console.warn`s; `vercel.json` schedules one run daily.
*Impact:* schools beyond the budget receive no digest and no unpaid reminder **until the next day**, and
the response says the run succeeded. The code's own comment diagnoses the identical failure in the
previous design — it assumed *"successive ticks that a once-a-day schedule never produces"* — and **the
replacement still depends on something re-invoking it, which nothing does.** Reporting `ok: true` while
schools went unprocessed is what **BR-125** forbids.
*Resolution:* **INT-D024** — split enqueue from drain; **INTAR-011** — a partial run is an incident.

### 30.1 Existing conflicts Stage 17 gives a target

**None is closed here.**

| Conflict | Stage 17's contribution |
|---|---|
| **C-41 · C-80 · C-81** | §8's five gates are the full inbound contract; **INT-D009** keeps the callback out of I-2 |
| **C-29** | **INTAR-006** — a callback lives in the module owning the integration |
| **C-53** | **C-95** is its email-channel instance; **INT-D014** validates on read as well as write |
| **C-58** | **INT-D019** — bounding is required whether or not the parser is replaced |
| **C-60** | **INT-D034** names a test per integration control |
| **C-63** | **INTAR-009** — region settled before go-live |
| **C-71** | **INT-D030** — no memory fallback anywhere in an integration path |
| **C-82** | five more raw `process.env` reads named: `EMAIL_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`, `STORAGE_DRIVER`, `CRON_SECRET` |
| **C-83** | **strengthened** — `'unsafe-inline'` is in `script-src` in **both** policies |
| **C-86** | **INT-D002** — `DBT-040` and `DBT-041` are created by **MIG-03**, never by application DDL and never by `db:push` |

---

## 31. Cross-stage check and traceability

| Earlier locked statement | Stage 17 position | Conflict |
|---|---|---|
| Stage 7 — CAP-093 scheduler, SC-10 | §15's trigger rules sit under it | none |
| Stage 7 — CAP-094 integration, SC-11 | §5's integration record is what it acts on | none |
| Stage 11 — Neon + Drizzle + Resend, no realtime | §13; **C-92** removes a competing data platform from the manifest | none |
| Stage 11 — `xlsx` terminal release | **C-58** carried; §12 bounds it either way | none |
| Stage 12 — I-2 is one transaction | **INTAR-004** — no outbound call inside it | none |
| Stage 13 — APP-049, `application/jobs/` is the only gateway caller | §15's enqueue/drain split sits behind it | none |
| Stage 14 — do not require a provider to send a header it does not support | **INT-D006** applies it to idempotency keys | none |
| Stage 14 — API-120 / CAP-049 confirms settlement | **INT-D009 · INT-D030** | none — the current callback is a **defect**, not a disagreement |
| Stage 15 — DBT-040 `integrations`, DBT-041 `provider_events`, DBI-021 | used directly by §5 and §8 | none |
| Stage 15 — **DBT-040 `school_id NOT NULL`**, MOD-007 | **INT-D003** keeps it school-only; platform providers are configuration | none — the proposed draft's `scope_kind` claim is **withdrawn**, see §5 |
| Stage 15 — DBD-036, no bytes in PostgreSQL; MIG-11/MIG-14 | §11 — **unchanged, no new migration** | none |
| Stage 15 — A15-001, DBT-077 | untouched by this stage | none |
| Stage 16 — SECAR-031, nothing external enters I-2 | **INT-D009 · INT-D030** restate it as the integration rule | none |
| Stage 16 — SEC-D053/D054/D055 callback contract | §8's five gates are its operational form | none |
| Stage 16 — SEC-D046, the `verified` upload state | **INT-D018** — no scanner exists; uploads queue | none |
| Stage 16 — SEC-D049/D050, signed URLs | **INTAR-008** binds the storage driver to it | none |
| Stage 16 — SEC-D063, the prohibited-log list | **INT-D021** — it is also a sub-processor control | none |
| Stage 16 — **SEC-D039, `preload` "is not added yet"** | **`vercel.json` adds it today** | **AMENDED — A16-001** |
| Stage 16 — **SEC-D037/D038, the CSP is what `helmet()` sets** | **two CSPs are served; the effective policy is their intersection** | **AMENDED — A16-001**; the duplication itself is **C-91** |
| Stage 16 — SEC-D083, no credential secret in the session store | no integration path writes one | none |

**One amendment (A16-001) and no unresolved cross-stage conflicts.**

**ID-10 · Traceability**

| Family | Range | Count |
|---|---|---|
| **INT-P** principles | INT-P1 … INT-P14 | 14 |
| **INT-D** decisions | INT-D001 … INT-D034 | 34 |
| **INTAR** requirements | INTAR-001 … INTAR-023 | 23 |
| **INT-R** risks | INT-R001 … INT-R014 | 14 |
| **INT-F** findings | INT-F01 … INT-F06 | 6 |
| **INTQ** owner questions | INTQ-1 · INTQ-2 | **2 — OPEN** |
| **Diagrams** | ID-1 … ID-10 | 10 |
| **Sections** | 1 … 32 | 32 |
| **New conflicts** | C-91 … C-96 | **6** |
| **Existing conflicts given a target** | C-29 · C-41 · C-53 · C-58 · C-60 · C-63 · C-71 · C-80 · C-81 · C-82 · C-83 · C-86 | 12 |
| **Conflicts closed** | — | **0** |
| **Amendments raised** | **A16-001** (Stage 16) | 1 |

---

## 32. Success criteria, locking discipline and summary

**ID-11 · What Stage 17 hands to which stage**

```
STAGE 18   retention for provider_events · delivery_attempts · integration failure records
STAGE 19   audit records for: integration configured · suspended · callback rejected
           · support-initiated provider action
STAGE 20   outbound budgets measured, not assumed  (INT-R010)
STAGE 21   SELECTION and wiring: object store · scanner · region (C-63) · secret delivery
           · header consolidation (C-91) · the `preload` consequence (A16-001)
STAGE 22+  implementation, against INT-D034's test list
OWNER      INTQ-1 (merchant of record) · INTQ-2 (sender identity)
LEGAL      INTQ-1 option B's obligations · transfers implied by every Class A and B provider
```

**ID-12 · The claim this document makes, and the claim it does not**

```
CLAIMS      a target integration model, traceable to locked stages 11-16
            six findings against the current tree, each read directly
            one locked statement corrected with its evidence               A16-001
            a test for every integration control                            INT-D034

DOES NOT    that any provider has been selected, contacted or assessed
CLAIM       that any contract, DPA or transfer is in place or lawful
            that the current integrations are secure
            that the go-live block is affected in any way
```

### 32.1 Success criteria

| # | Criterion | Met |
|---|---|---|
| 1 | every claim about current behaviour cites a file that was opened | ✔ §2 |
| 2 | controls that are correct are recorded as correct | ✔ §2.1 — nine |
| 3 | a file no earlier stage read was opened, and what it changed is stated | ✔ `vercel.json` — **C-91 · A16-001** |
| 4 | declared dependencies are checked against actual imports | ✔ §17 — **C-92** |
| 5 | every integration has a class, a credential scope and a failure behaviour | ✔ §4 · §22 |
| 6 | no external system can reach a business invariant | ✔ INT-D009 · INT-D030 · SECAR-031 |
| 7 | no provider is selected, and absence is recorded as absence | ✔ INT-P13 · INT-D010 |
| 8 | data crossing each boundary is enumerated and minimised | ✔ §20 — including the child's name removed from the payment payload |
| 9 | every provider has a stated exit | ✔ §21 · §24 |
| 10 | a locked stage contradicted by new evidence is amended, not rewritten | ✔ **A16-001** |
| 11 | conflicts are raised, and none is claimed closed | ✔ §30 — **0 closed** |
| 12 | only genuine product questions are asked | ✔ **2** |
| 13 | every control names its verification | ✔ §26 |
| 14 | no vendor, legal or compliance conclusion is drawn | ✔ §1.3 · §21 · §25 |

### 32.2 Locking discipline — proposed

```
STAGE 17 — INTEGRATIONS, PROVIDERS & EXTERNAL BOUNDARIES
STATUS: PROPOSED
Open owner questions: 2   (INTQ-1 · INTQ-2)
New conflicts: C-91 … C-96      Conflicts closed: 0
Amendment raised against a locked stage: A16-001 (Stage 16)
```

Should the owner lock this stage:

1. **Later stages may implement it.** Stage 21 provisions the providers this stage selected and consolidates headers; Stage 18 sets
   retention; Stage 19 owns the audit records; Stage 22 onward builds against INT-D034's test list.
2. **Later stages may record traceable owner amendments as A17-nnn**, stating the locked text, the
   narrowing or correction, and the cause. **They may not silently rewrite.**
3. **Conflict identifiers are stable** — C-91 … C-96 keep their numbers permanently.
4. **The integration taxonomy (§4) is closed.** A provider that fits no class requires an amendment,
   because a class fixes its credential scope, its failure behaviour and its authority together.
5. **INT-P6 and INTAR-004 are not negotiable by convenience.** No external system reaches an invariant,
   and no outbound call happens inside the I-2 transaction.
6. **A later finding that contradicts this stage is FLAGGED, not absorbed.**

**Stage 17 approval is not production security clearance, not vendor approval, and not legal sign-off.**
The BytHub Legal & Compliance deployment halt and production go-live block of 23 August 2026 —
**17 Critical, 52 High, across 14 domains, 0% compliance clearance** — **stands in full.** No provider
has been selected, contacted or assessed here. The baseline remains **UNVERIFIED**, capped at **E2**.

---

## Summary

Stage 17 finds a system whose **integration seams are better than what sits behind them**.
`paymentIntegration.ts` is a genuine single plug-in point, `storageProvider.ts` defines the interface
before it is needed and ships a default that changes nothing, one helper sends every email, and the
webhook fails closed with a constant-time comparison and a startup assertion whose reasoning is exactly
right. **Nine controls are correct, and the seams are the valuable part, because a seam is expensive to
add later and a provider is cheap to swap.**

Behind those seams, the product assumes a single tenant. **One payment credential for every school. One
sender address, with a hard-coded fallback. One policy file that turns out to be two, disagreeing.**
And a daily job that stops when it runs out of seconds, reports `ok: true`, and leaves the remaining
schools until tomorrow — repeating, in a different shape, the exact failure its own comment describes
having fixed.

**Six new conflicts are raised (C-91 … C-96), twelve existing ones are given a target, none is closed,
and one traceable amendment — A16-001 — corrects a locked Stage 16 statement that HSTS `preload` was
still pending, because `vercel.json`, which no earlier stage had opened, sets it today.**

**Two owner questions are asked and neither is mine to answer:** whether each school connects its own
payment provider or BytHub collects and remits — which decides who the merchant of record is, and whose
regulatory obligation follows — and whether school email leaves from ScholarShelf's domain or each
school's own, which trades deliverability and trust against DNS work a primary school may not be able to
do.

```
STAGE 17 — INTEGRATIONS, PROVIDERS & EXTERNAL BOUNDARIES
STATUS: PROPOSED — 30 August 2026
Awaiting owner review. Stage 18 is NOT begun.
The go-live block of 23 August 2026 stands.
```
---

## 33. Provider register — PRV-001 … PRV-011

**This register is documentation. It is not a database table**, and it is not DBT-040 (§5, INT-D003).

Every entry was verified against **first-party official documentation, fetched on 31 August 2026**.
Sources and dates are recorded per entry at §34. **No entry is classified from memory** — the owner's
§5 rule, applied without exception.

**Classification vocabulary:** `KEEP` (locked earlier, re-verified) · `SELECT` (chosen here) ·
`ADD` (new capability chosen here) · `DEFER` (not for V1) · `REJECT` (evaluated and declined) ·
`LOCAL` (a library; no transfer, not a sub-processor).

| PRV | Provider / tool | Class | Decision | Purpose | Scope | Business authority | Region capability |
|---|---|---|---|---|---|---|---|
| **PRV-001** | **Neon** | A | **KEEP** | PostgreSQL | platform config | **NO** | **`aws-eu-west-2` London — verified** |
| **PRV-002** | **Vercel** | A | **KEEP** | hosting, edge, cron transport | platform config | **NO** | UK/EU region required [TQ-1]; configured at Stage 21 |
| **PRV-003** | **Resend** | B | **KEEP — CONDITIONAL, see INTQ-3** | transactional email | platform config (INTQ-2 = C) | **NO** | **sending region EU (Ireland) — but ALL data stored in the US. Verified. → C-97** |
| **PRV-004** | **AWS S3** | B | **SELECT** | object storage | platform config | **NO** | **`eu-west-2` London** |
| **PRV-005** | **AWS GuardDuty Malware Protection for S3** | B | **SELECT** | upload scanning | platform config | **NO** | GuardDuty available in `eu-west-2` — verified |
| **PRV-006** | **Have I Been Pwned — Pwned Passwords range API** | D | **SELECT** | compromised-password screening | platform config | **NO** | n/a — **no account data transferred** |
| **PRV-007** | **Sentry** | B | **ADD** | error tracking, front and back | platform config | **NO** | **EU region, Frankfurt — verified; immutable after org creation** |
| **PRV-008** | **Sentry Uptime Monitoring** | B | **ADD** | external availability check | platform config | **NO** | part of PRV-007 |
| **PRV-009** | **Cloudflare R2** | B | **REJECT** | object storage — evaluated alternative | — | — | EU jurisdiction guarantee, **no UK**; no native scanning |
| **PRV-010** | **SheetJS / `xlsx`** | — | **LOCAL LIBRARY** | workbook parsing | in-process | **NO** | **no external transfer · NOT a sub-processor** |
| **PRV-011** | **Live payment provider** | C | **DEFER — future capability** | online payment | **per school — DBT-040** (INTQ-1 = A) | **NO — signal only** | decided when selected |

### 33.1 Data categories per provider

| PRV | Child data | Guardian data | Financial data | Message bytes | Credentials permitted |
|---|---|---|---|---|---|
| PRV-001 Neon | **YES** | **YES** | **YES** | **YES** | its own connection credential only |
| PRV-002 Vercel | only via logs — Stage 16 §31 forbids it | as above | as above | **NO** | its own platform credential only |
| PRV-003 Resend | **YES** — first name in message body | **YES** — recipient address | amounts | **YES** | **NO** |
| PRV-004 S3 | possible — a school may upload | possible | **NO** | **NO** | **NO** |
| PRV-005 GuardDuty | the same bytes as PRV-004 | as PRV-004 | **NO** | **NO** | **NO** |
| PRV-006 HIBP | **NO** | **NO** | **NO** | **NO** | **NO** — 5 hex characters of a hash |
| PRV-007 Sentry | **NO — scrubbing is a precondition of enabling it** | **NO** | **NO** | **NO** | **NO** |
| PRV-008 Uptime | **NO** — a URL and a status code | **NO** | **NO** | **NO** | **NO** |
| PRV-010 SheetJS | in-process only | in-process only | in-process only | — | — |

**INTAR-024 · No provider ever receives a credential except the one credential that authenticates
ScholarShelf to that provider.** Stage 16 SECAR-002 restated at the integration boundary.

**INT-D035 · Sentry is not enabled until scrubbing is configured and proven**

Stage 11 named error tracking *"highest leak risk"*, and it is right: a stack trace carries request
context. **Scrubbing precedes enablement**, and the deny list is Stage 16's §31 prohibited-log list
verbatim — child record content, guardian content, message bodies, payment references, uploaded data,
passwords, tokens, cookies and session identifiers, MFA and recovery material. **A tracker enabled
before its scrubbing is a personal-data export nobody reviewed.**

---

## 34. Provider verification — official evidence

**Verified 31 August 2026.** Each entry states the source, what it proves, and **what remains
unverified** — the last column is the one that matters, because an unrecorded gap is how an unverified
claim becomes a locked assumption.

### 34.1 PRV-001 Neon — KEEP

| | |
|---|---|
| Source | `neon.com/docs/introduction/regions` |
| Proves | **AWS Europe (London) `aws-eu-west-2` is an available region.** UK residency is achievable |
| Also proves | *"You cannot change the region for an existing project."* A region change means a new project and a data migration |
| Unverified | **the region of the CURRENT production project.** It is not recorded in the repository and cannot be read from it |

**INT-D036 · The current Neon project's region is unknown, and finding out is a Stage 21 action with a
possible migration behind it**

This sharpens **C-63** materially. C-63 recorded that the region *"has not been decided — it has been
defaulted."* The new fact is that **a defaulted region cannot be corrected in place.** If the production
project was created outside the UK/EU, satisfying TQ-1 requires creating a new project and migrating —
which is a data-movement exercise on live school data, not a configuration change.

**C-63 is not closed and its cost is now known.**

### 34.2 PRV-004 AWS S3 — SELECT · and PRV-009 Cloudflare R2 — REJECT

| Criterion (locked) | **AWS S3** | Cloudflare R2 |
|---|---|---|
| S3-compatible | **it is the reference implementation** | S3-compatible API |
| UK residency | **`eu-west-2` London** | **EU jurisdiction only — no UK option** (verified) |
| residency guarantee | region is chosen per bucket | **jurisdictional restriction "guarantee objects in a bucket are stored within a specific jurisdiction"** — strong, but EU-wide |
| signed direct browser upload | yes | yes |
| private by default | yes | yes |
| public published-media path | yes | yes, via custom domain |
| **native malware scanning** | **YES — PRV-005, no standing compute** | **none** |
| portability | reference implementation | S3-compatible |

**Source (R2):** `developers.cloudflare.com/r2/reference/data-location/` — jurisdictions are **EU,
FedRAMP, US**; location hints are *"a best effort and not a guarantee"* while jurisdictional
restrictions *"guarantee objects in a bucket are stored within a specific jurisdiction"*. **No UK
jurisdiction exists.**

**Two reasons decide it, and the second is the stronger:**

1. **UK residency.** D-01 locks ScholarShelf to the UK market and the data is UK children's. `eu-west-2`
   answers a school DPO's question with *London*; R2 answers it with *somewhere in the EU*. Both are
   defensible; one is better, and Neon's London region makes it consistent.
2. **Scanning without standing compute.** Stage 16 SEC-D046 requires a `verified` gate before
   `published`. The locked topology is **serverless with a 30-second function ceiling** and cannot host a
   ClamAV daemon — the owner's §6.5 warns against adding one. **S3 has an object-store-native scanner
   (PRV-005); R2 has none**, so choosing R2 means choosing to solve scanning separately, with
   infrastructure the locked topology does not have.

**R2's zero-egress pricing is a real advantage and it is recorded as the cost of this decision.** Public
site media served from S3 incurs egress that R2 would not. At V1 volumes — school logos and a few page
images — that is small, and **it is the right thing to pay for UK residency and native scanning.**
**Stage 18 owns the cost trigger that would reopen this.**

**Unverified:** exact `eu-west-2` pricing and any S3 feature-level constraint at provisioning. **Stage
21 confirms both before creating the bucket.**

### 34.3 PRV-005 GuardDuty Malware Protection for S3 — SELECT

| | |
|---|---|
| Sources | `docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html` · `.../monitoring-malware-protection-s3-scans-gdu.html` · `docs.aws.amazon.com/general/latest/gr/guardduty.html` |
| Proves | *"When an S3 object or a new version of an existing S3 object gets uploaded to your selected bucket, GuardDuty automatically starts a malware scan."* |
| Proves | results reach the object as a **tag** and reach **EventBridge**; metrics to CloudWatch |
| Proves | **GuardDuty endpoints exist for `eu-west-2` (Europe London)** — `guardduty.eu-west-2.amazonaws.com` |
| **Unverified** | **feature-level availability of Malware Protection for S3 specifically in `eu-west-2`.** The service is available there; the per-feature region table was not obtainable |

**INT-D037 · The scanner's verdict vocabulary is the provider's, and three of its five values mean NOT
CLEAN**

Verified status values, exactly as documented:

```
NO_THREATS_FOUND   → CLEAN      may proceed to `verified`, then `published`
THREATS_FOUND      → INFECTED   the object is quarantined  (Stage 16 SEC-D046)
UNSUPPORTED        → ERROR ─┐
ACCESS_DENIED      → ERROR ─┼── NEVER CLEAN. The object stays unavailable.
FAILED             → ERROR ─┘
```

**`UNSUPPORTED` is the one that would be got wrong.** It is returned for *"unsupported file types,
archives with high compression ratios, quotas, or unsupported S3 features"* — a set that includes
password-protected archives and objects over a size limit. **A naive implementation reads "not
infected" and publishes.** Stage 16's rule is that a clean verdict is required, not that an infected
verdict is absent, and this is exactly the case it was written for.

**INTAR-025 · An object with no `NO_THREATS_FOUND` verdict is never served, never published and never
referenced.** Absence of a verdict and absence of a threat are different facts.

**Contingency, stated rather than assumed:** if Stage 21 finds Malware Protection for S3 unavailable in
`eu-west-2`, the fallback is **not** a self-hosted daemon. It is a scan-on-demand serverless invocation
against the object, preserving the same three-way vocabulary and the same fail-closed gate. **The gate
is the locked requirement; the scanner is the implementation.**

### 34.4 PRV-006 Have I Been Pwned, Pwned Passwords range API — SELECT

| | |
|---|---|
| Source | `haveibeenpwned.com/API/v3#PwnedPasswords` |
| Proves | the request carries **the first 5 characters of a SHA-1 hash** and nothing else |
| Proves | *"The Pwned Passwords API is freely accessible without the need for a subscription and API key"* — **no account, no key, no identifier** |
| Proves | `Add-Padding: true` *"Pads out responses to ensure all results contain a random number of records between 800 and 1,000"* |
| Proves | **the full corpus is downloadable** for offline self-hosting |

**INT-D038 · The range API is used with `Add-Padding: true`, and the downloadable corpus is the
recorded fallback**

This satisfies A16-002's requirement exactly: **no plaintext password, no full hash with identity, no
email, no school, no username.** Five hexadecimal characters of a hash of a candidate password leave
the system, unauthenticated, with padded responses so that even an observer of the encrypted traffic
learns little from response size.

**Failure behaviour is unchanged from Stage 16 SEC-D006: the check is skipped and the password is
accepted.** A parent must be able to set a password when a third party is down. **Fail open here is
deliberate and it is not an authority decision** — it weakens a quality check, not an access control.

**Legal classification: LEGAL REVIEW REQUIRED.** The technical fact is that **no account identifier is
intentionally transferred**. Whether that makes the endpoint a processor is not a determination this
document makes (§14, INT-P-legal boundary).

**The self-hosted corpus is the recorded alternative** if the transfer posture or availability becomes
unacceptable, and it is the reason this selection is reversible: **the same five-character lookup runs
against a local table with no transfer at all.**

### 34.5 PRV-007 / PRV-008 Sentry — ADD

| | |
|---|---|
| Sources | `docs.sentry.io/organization/data-storage-location/` · `docs.sentry.io/product/uptime-monitoring/` |
| Proves | **an EU region exists, physically in Frankfurt**, storing *"Error events, activity, and issue links, Transactions, Spans, Profiles, Logs, Metrics, Release health, Releases, debug symbols, and source maps"* |
| Proves | *"Once selected, your data storage location can't be changed. The only way to switch it is by creating a new organization"* |
| Proves | **some account metadata remains in the US regardless of region** |
| Proves (uptime) | external HTTP checks at **1, 5, 10, 20, 30 or 60-minute** intervals, run *"from a variety of geographical locations in a round-robin fashion"*, issue raised after **three consecutive failures** |
| Unverified | Sentry's current DPA and sub-processor list were not fetched |

**INT-D039 · Sentry is selected with the EU (Frankfurt) region, and the region choice is irreversible —
which makes it a Stage 21 provisioning gate, not a setting**

**An organisation created in the wrong region cannot be moved.** This is recorded as a provisioning
precondition with the same weight as Neon's, and for the same reason.

**INT-D040 · Availability monitoring reuses Sentry Uptime — no separate provider**

The owner's §6.8 prefers reusing the observability platform where it provides a suitable independent
external check. **It does.** External HTTP checks, from multiple geographies, alerting after three
consecutive failures — which is precisely the shape needed, and it removes an entire sub-processor from
the register.

**It monitors the public health surface only.** Stage 14's `/health/live` is what an external check
reaches; **`/health/dependencies` is an authorised Platform diagnostic and is never exposed to an
external monitor** (Stage 16 §31, and the owner's §6.8: *do not expose internal dependency architecture
publicly*). **Stage 18 sets the thresholds; Stage 21 configures the check.**

**Residual, recorded:** Sentry's DPA and sub-processor list are **not yet verified**. Sentry is
classified **ADD** on the strength of verified region and capability evidence; **INTAR-026 makes DPA
and sub-processor verification a precondition of enabling it**, exactly as scrubbing is.

### 34.6 PRV-003 Resend — KEEP, CONDITIONAL

**This is the one verification that failed against a locked position, and it is reported as a failure
rather than smoothed over.**

| | |
|---|---|
| Sources | `resend.com/legal/dpa` · `resend.com/legal/subprocessors` · `resend.com/docs/dashboard/domains/regions` — all last updated 27 August 2026 |
| Proves | *"Customer acknowledges that Company's primary processing operations take place in the United States, and that the transfer of Customer's Personal Data to the United States is necessary for the provision of the Services"* |
| Proves | **all 22 named sub-processors are located in the USA** |
| Proves | four sending regions exist — North Virginia, **Ireland (eu-west-1)**, São Paulo, Tokyo |
| **Proves — decisively** | *"Region selection controls where your emails are routed and sent from. It does not control where customer data is stored."* and *"All account data, including email metadata, logs, and API records, is stored in the United States"* |
| Proves | data deleted within 90 days of account termination; compliance records kept 3 years |
| Notable | the sub-processor list includes **Anthropic, PBC ("Artificial Intelligence")** and **RunPod, Inc. ("Self-hosted LLMs")** |

**What this collides with.** Stage 11's technology table attaches **[TQ-1] UK/EU** to Neon, to object
storage, to hosting and to error monitoring. **Resend's row carries no TQ-1 marker** — but the same
document's prose says *"**TQ-1 applies here too.** Resend receives recipient addresses and message
content — which includes children's names and payable amounts"*, and concludes *"Resend remains KEEP
unless that verification finds a concrete incompatibility."*

**The locked table and the locked prose disagree, and the verification has now found the
incompatibility the prose anticipated.** Resend can send from Ireland; it stores every message's
metadata, logs and API records in the United States, and offers no configuration that changes that.

→ **C-97**, and → **INTQ-3** (§39). **Resend is NOT marked SELECT.** It remains **KEEP-CONDITIONAL**:
retained for V1, with the residency posture unresolved and escalated.

**No replacement is chosen here**, because choosing one would be answering INTQ-3 on the owner's behalf.
Candidates that advertise EU/UK data residency exist and would each require **A11-001** amending Stage
11's KEEP; **that evaluation is scoped, not performed**, and §39 states exactly what would trigger it.

---

## 35. Provider contract register — INT-C001 … INT-C008

Each contract fixes **semantics**. **Every numeric budget is Stage 18's**, except a tolerance the
provider's own protocol mandates (§7).

| INT-C | Contract | Provider | Auth | Data allowed out | Data forbidden out | Idempotency | Owner |
|---|---|---|---|---|---|---|---|
| **INT-C001** | email send | PRV-003 | platform API key from the secret store | recipient address, subject, rendered body, school display identity | credentials, session ids, raw tokens at rest, any field not in the MAIL template's allow list | provider message id recorded | MOD-015 |
| **INT-C002** | email event receipt (bounce, complaint, delivery) | PRV-003 | signature over **raw bytes** (Stage 16 SEC-D053) | — inbound | — | **event id, deduplicated** | MOD-015 |
| **INT-C003** | object upload | PRV-004 | signed URL, short-lived, issued after an authority check | file bytes, generated opaque key | original filename in the key, any tenant identifier in a public path | key is the idempotency unit | MOD-011 / MOD-015 |
| **INT-C004** | object read | PRV-004 | signed URL after an authority check | — | a durable public URL for anything but published site media | n/a | MOD-015 |
| **INT-C005** | scan verdict | PRV-005 | AWS IAM, least privilege | — inbound | — | object version is the unit | MOD-015 |
| **INT-C006** | compromised-password lookup | PRV-006 | **none — unauthenticated by design** | **5 hex characters of a SHA-1 hash**, `Add-Padding: true` | the password, the full hash, email, username, school, IP correlation | n/a — stateless | MOD-002 |
| **INT-C007** | error event | PRV-007 | DSN from the secret store | stack trace, correlation id, release, **scrubbed** context | Stage 16 §31's list in full | event id | MOD-015 |
| **INT-C008** | availability check | PRV-008 | none — the check is inbound to a public surface | HTTP status of `/health/live` | dependency detail, versions, internal topology | n/a | MOD-015 |
| **INT-C009** | future payment | PRV-011 | **per-school credential — DBT-040** | reference, amount, currency, payer contact | **child name, class, book titles** (INT-D029) | provider idempotency key required | MOD-007 |

**INT-D041 · Every contract's retry semantics are stated here; every retry number is Stage 18's**

| Contract | Retryable | Never retried | On exhaustion |
|---|---|---|---|
| INT-C001 email | timeout, 5xx, rate-limit | invalid address, rejected content | terminal delivery failure recorded; **notification truth untouched** |
| INT-C002 event | n/a — the provider retries us | — | duplicate delivery is a **200 no-op** (INT-D008) |
| INT-C003 upload | client-side, by the browser | authority failure | the pending object expires |
| INT-C005 scan | `FAILED` only | `THREATS_FOUND`, `UNSUPPORTED`, `ACCESS_DENIED` | the object stays unavailable — **never published** |
| INT-C006 breach | one short retry | any 4xx | **skip the check, accept the password** (SEC-D006) |
| INT-C007 error event | best effort | — | dropped; **never blocks a request** |
| INT-C009 payment | timeout only, **with the provider's idempotency key** | any 4xx | queued and visible; **settlement is unaffected** |

**INTAR-027 · A provider callback is acknowledged fast: authenticate, deduplicate, record the signal,
respond.** Long business processing never happens before the acknowledgement unless the provider's own
contract requires it.

---

## 36. Amendment raised against locked Stage 15 — A15-002

**§10 of the owner's instruction directs that a new durable deliverability fact must first be sought in
the locked Stage 15 schema, and only amended for if no structure can carry it without abuse. That
inspection was performed and both candidates fail.**

```
A15-002                              raised by Stage 17, 31 August 2026
AFFECTS      DATABASE_SCHEMA.md — §41 catalogue · §33 uniqueness register
TYPE         ADDITION — one table. Nothing removed, renamed or renumbered.
STATUS       RECORDED in DATABASE_SCHEMA.md §55
```

| Candidate structure | Why it cannot carry the fact |
|---|---|
| **DBT-057 `notification_preferences`** | it records **what a person chose**. A provider-driven suppression is not a choice; writing it here makes a bounce indistinguishable from a preference, and a person who fixes their mailbox finds their own settings silently rewritten |
| **DBT-054 `delivery_attempts`** | it records **each attempt**, correctly and append-only. It holds no current-state fact, so "this address is currently undeliverable" would have to be recomputed from history on every send |
| **DBT-008 `credentials`** | Stage 16 closed its field list (SEC-D003) and its subject is **proving identity**. Deliverability is a delivery concern owned by MOD-009/MOD-015 — putting it here re-fuses two concerns these stages spent Stage 15 separating |

**DBT-078 `email_suppressions`** — MOD-009 · **GLOBAL, no `school_id`**

`id` · `email` (citext) · `suppression_kind` (`hard_bounce` · `complaint` · `manual`) ·
`first_suppressed_at` · `last_event_at` · `last_failure_class` · `released_at` ·
`released_by_person_id` · `released_reason`.

**Global, not per-school, because a dead mailbox is dead everywhere.** A guardian at two schools has one
address; suppressing it at one school and not the other would send mail known to fail.

| New | Constraint | Enforces |
|---|---|---|
| **DBI-033** | `UNIQUE (email) WHERE released_at IS NULL` | one live suppression per address; release is explicit and attributed |

**DB-P19 checked: the predicate reads one stored column and does not consult the wall clock.**

**What this table must never do:** it never writes, clears or influences `credentials.email_verified_at`.
**Verification is a historical identity fact; suppression is a current delivery fact.** That separation
is the whole reason the table exists rather than a flag on an existing row.

**Created by MIG-03**, with the other new tables — never by application DDL (**C-86**) and never by
`db:push` (**DBD-043**, **C-78**).

**Effect on Stage 15's counts:** tables **77 → 78** (with A15-001's DBT-077); uniqueness **32 → 33**.

---

## 37. Email template registry — MAIL-001 … MAIL-024

Derived from **locked workflows and locked security flows only**. **No marketing email exists and none
is invented.**

**MOD-009 decides notification truth. MOD-015 attempts delivery.** A row here is a *delivery template*;
its existence never implies that every in-app notification is emailed.

| MAIL | Canonical key | Trigger | Recipient | Bearer link | Notification truth | On final failure |
|---|---|---|---|---|---|---|
| **MAIL-001** | `school_admin.invite` | platform invites a school administrator | invitee | **YES** — invite token | yes | surfaced to platform; **invite stays valid** |
| **MAIL-002** | `staff.invite` | school invites staff | invitee | **YES** | yes | surfaced to the inviting admin |
| **MAIL-003** | `guardian.invite` | school invites a guardian | invitee | **YES** | yes | surfaced to the school |
| **MAIL-004** | `guardian.link_code` | a child link code is issued | guardian | **YES** — link code | yes | surfaced; **code unaffected** |
| **MAIL-005** | `password.reset_request` | reset requested | account holder | **YES** — reset token | yes | recorded; **never logged** (SEC-D025) |
| **MAIL-006** | `password.changed` | password changed | account holder | no | yes | recorded — **this is the message that tells a victim** (SECAR-014) |
| **MAIL-007** | `email.verify` | address added or changed | account holder | **YES** | yes | verification simply does not complete |
| **MAIL-008** | `mfa.enrolment_required` | AUTH-SCHOOL / AUTH-FINANCE grace period opens (SECQ-2 = A) | staff member | no | yes | surfaced to the school admin |
| **MAIL-009** | `mfa.grace_expiring` | grace period nearly over | staff member | no | yes | surfaced to the school admin |
| **MAIL-010** | `mfa.changed` | MFA enabled or disabled | account holder | no | yes | recorded |
| **MAIL-011** | `mfa.recovery_code_used` | a recovery code is consumed | account holder | no | yes | recorded (SECAR-012) |
| **MAIL-012** | `school.setup_continue` | setup incomplete | school admin | no | yes | recorded |
| **MAIL-013** | `requirement.new` | a new payable requirement exists | guardian | no | yes | recorded; **the requirement is unaffected** |
| **MAIL-014** | `settlement.confirmed` | finance confirms — I-2's required consequence | guardian | no | **yes — written INSIDE the I-2 transaction** | **the business fact stands** (DBD-030) |
| **MAIL-015** | `settlement.rejected` | finance rejects | guardian | no | yes | recorded |
| **MAIL-016** | `finance.investigation` | a reconciliation exception needs a person | finance | no | yes | surfaced in-app |
| **MAIL-017** | `allocation.ready` | books allocated and ready | guardian | no | yes | recorded |
| **MAIL-018** | `handover.completed` | a child received their books | guardian | no | yes | recorded |
| **MAIL-019** | `replacement.requested` | teacher raises a replacement | school admin | no | yes | in-app |
| **MAIL-020** | `replacement.decided` | admin decides | teacher, guardian | no | yes | recorded |
| **MAIL-021** | `replacement.charge` | finance charge decision | guardian | no | yes | recorded |
| **MAIL-022** | `message.received` | a thread message arrives | the counterparty | no | yes | in-app |
| **MAIL-023** | `digest.daily` | the scheduled digest | school staff | no | yes | **skipped, never accumulated forever** |
| **MAIL-024** | `security.break_glass` | break-glass elevation granted | other platform owners | no | yes | **the failure is itself recorded** (SECAR-020) |

**Every template, without exception:**

```
ALLOWED     school display identity (INTQ-2 = C) · recipient's own name · child FIRST name
            where the locked workflow requires it · amounts · a single-use link where the
            row says YES · a deep link to the app
FORBIDDEN   passwords · hashes · MFA secrets · recovery codes · session identifiers ·
            another family's data · full payment card or bank detail · raw provider payloads ·
            any field not named in this row
ALWAYS      plain-text alternative part · escaped interpolation (INT-D014) ·
            unsubscribe ONLY where the message is not a mandatory operational notice
```

**INT-D042 · A mandatory operational notice carries no unsubscribe, and marketing does not exist**

MAIL-001 … MAIL-012, MAIL-014, MAIL-015 and MAIL-024 are **mandatory**: they are how a person exercises
or protects their access. **MAIL-013, MAIL-017, MAIL-018, MAIL-022 and MAIL-023 are preference-governed**
through **DBT-057**, which is the structure that exists for exactly that and is not abused by §36's
suppression fact.

**INTAR-028 · A bearer-link template's token lifecycle is Stage 16's, not the template's.** The template
carries the link; **DBT-077 `credential_tokens` (A15-001)** owns its expiry, single use and
invalidation.

---

## 38. Consistency amendment raised against locked Stage 16 — A16-002

Recorded in full in `SECURITY_AUTH_PRIVACY.md` §51 alongside A16-001. **Three ownership and count
corrections; no security redesign.**

| | Correction |
|---|---|
| **38.1 baseline control count** | Stage 16 §2.1's table lists **fifteen** controls; the prose and every summary say **fourteen**. Recounted directly from the table: **15**. The amended reading is **fifteen controls present and correct**; the original locked text is preserved through the register |
| **38.2 retention ownership** | Stage 16 says *"Stage 18 sets every number."* **Corrected boundary:** Stage 16 owns handling categories, minimisation, erasure mechanisms and the technical ability to enforce a decision. **Legally or commercially significant retention — child and family records, financial and statutory records, custody evidence, erasure exceptions, lawful basis — belongs to qualified legal / controller-approved policy.** Stage 18 owns **operational engineering windows only** — import staging, job metadata, idempotency records, transient traces. Stage 19 owns audit-record mechanics subject to that policy; Stage 21 owns backup lifecycle. **Stage 18 must not invent "UK law requires N years."** |
| **38.3 compromised-password mechanism** | Stage 16 SEC-D006 names *k-anonymity against a public breached-password corpus* — an implementation, decided a stage early. **Corrected to a provider-neutral requirement:** screening against a maintained compromised-password source using a privacy-preserving mechanism, with no plaintext, no full hash with identity, no email, no school, no username, nothing sensitive logged, and explicit failure behaviour. **Stage 17 selects the implementation — §34.4, PRV-006** |

**A16-001 is untouched and remains in force.**

---

## 39. Owner decisions and the one new question

```
INTQ-1   DECIDED — A    each school owns its payment-provider account       §16
INTQ-2   DECIDED — C    school display identity, ScholarShelf sending       §16
INTQ-3   OPEN           does the UK/EU processing policy extend to email?   below
```

### INTQ-3 · Does TQ-1's UK/EU processing requirement extend to the email provider?

**This question did not exist before this stage's provider verification. It is raised because the
owner's §16 says a genuinely new commercial question must not be hidden merely to reach zero.**

**The verified facts** (§34.6): Resend stores **all account data, email metadata, logs and API records
in the United States**, with **22 US sub-processors**, and its Ireland region changes only where mail is
*sent from*. The message bodies concerned carry **children's first names, school names and payable
amounts**. Stage 11 marked [TQ-1] UK/EU on the database, object storage, hosting and error monitoring —
**and not on Resend's row**, while its prose says TQ-1 applies to Resend too.

**Why this is not an engineering choice.** It is not a comparison of two products' features. It is
whether the product's data-residency promise to UK schools covers the email channel — which changes what
BytHub can tell a school DPO, what its contracts say, and whether a provider switch and an **A11-001**
amendment to locked Stage 11 are required.

| | **A — the policy extends to email** | **B — the policy does not extend to email** | **C — V1 as-is, resolve before scale** |
|---|---|---|---|
| Resend | **replaced** | **kept** | kept for V1 |
| Requires | **A11-001** amending Stage 11's KEEP; provider evaluation; migration of `server/email.ts`'s senders | nothing technical | a dated review point |
| What a school DPO is told | "everything is UK/EU" | "everything except transactional email, which is US" | "US today, under review" |
| Cost | provider evaluation and migration work | none | none now |
| Risk | delay | a residency answer with an exception in it | the exception ships and is easy to forget |

**Stage 17's engineering position, offered not decided:** the technical work is contained — email leaves
through **one helper**, and `INT-C001`'s contract is provider-neutral by construction — so option A is
**cheaper now than later**, and cheapest before schools are onboarded at volume.

**BytHub Legal should see this before it is answered.** Whether a US transfer of this content is
acceptable is their determination, not this document's (§14, INT-P-legal boundary).

**What INTQ-3 blocks:** the email provider's classification only. **PRV-003 stays KEEP-CONDITIONAL.**
Every other selection in §34 is decided and none depends on the answer.

---

## 40. Conflicts raised by this correction pass

**C-97 · Resend stores all email data in the US, while TQ-1 requires UK/EU processing for every other
personal-data provider — ACTIVE**

*Evidence:* `resend.com/docs/dashboard/domains/regions` — *"Region selection controls where your emails
are routed and sent from. It does not control where customer data is stored"* and *"All account data,
including email metadata, logs, and API records, is stored in the United States."*
`resend.com/legal/subprocessors` — **22 sub-processors, all USA.** `resend.com/legal/dpa` — the customer
acknowledges US transfer as necessary.

*Impact:* the product's residency posture has an unmarked exception, in the channel that carries
children's first names and payable amounts. **Stage 11's own table and prose disagree about whether TQ-1
applies to Resend**, so the exception is not currently visible in any locked document.

*Resolution:* **INTQ-3.** Option A additionally requires **A11-001**. **Not closed here.**

**A note on what was NOT raised.** The three ownership corrections at §38, the DBT-040 correction at §5,
the provider-selection ownership correction at §25, the retry-number handoff at §7, the cron target at
§15 and the bounce semantics at §10 are **corrections to this document's own proposed draft**. The
owner's §17 directs that documentation corrections do not become conflicts, and **no identifier is
issued for any of them.**

---

## 41. Final validation and lock

### 41.1 Gate

| Check | Result |
|---|---|
| INTQ-1 = A · INTQ-2 = C recorded | ✔ §16 |
| Open owner questions from those two | ✔ **0** |
| A genuinely new question, not hidden | ✔ **INTQ-3**, permitted by the owner's §16 |
| V1 live payment remains DEFERRED | ✔ PRV-011 · §16 |
| Future school payment providers per school; BytHub not central collector | ✔ §16 · INT-D004 |
| V1 email = school display name via ScholarShelf; no per-school DNS | ✔ §16 |
| DBT-040 remains `school_id NOT NULL`; platform providers are not DBT-040 rows | ✔ INT-D003 |
| Stage 17 owns provider selection; Stage 21 owns provisioning | ✔ §25 · INT-P13 |
| A16-002 exists; control count, retention boundary, breach-check neutrality corrected | ✔ §38 |
| A16-001 intact | ✔ §19 |
| PRV register complete | ✔ **11** |
| INT-C register complete | ✔ **9** |
| MAIL registry complete | ✔ **24** |
| **Resend officially verified** | ✔ **verified — outcome is a blocking finding, C-97 + INTQ-3** |
| Object storage selected with evidence | ✔ **PRV-004 AWS S3 `eu-west-2`** |
| Malware scanning selected with evidence | ✔ **PRV-005 GuardDuty Malware Protection for S3** |
| Breached-password mechanism selected with evidence | ✔ **PRV-006 HIBP range API, padded** |
| Error monitoring selected with evidence | ✔ **PRV-007 Sentry, EU (Frankfurt)** |
| Availability monitoring decided | ✔ **PRV-008 Sentry Uptime — no separate provider** |
| Live payment provider NOT selected | ✔ **DEFERRED** |
| Hard bounce ≠ email identity unverified | ✔ INT-D015 · **A15-002** |
| Exact retry and time budgets moved to Stage 18 | ✔ §7 · INT-D041 |
| API-278 `POST /api/internal/jobs/run` remains the target | ✔ INT-D025 |
| No provider callback reaches I-2; signal ≠ settlement | ✔ INT-D009 · INT-D030 · SECAR-031 |
| No legal compliance claim | ✔ §14 · §34.4 · §39 |
| No provider configured · no SDK installed · no code changed · no production data touched | ✔ §1.2 |

**One gate item is answered with a qualification, and it is stated rather than ticked quietly:**
**Resend was officially verified and the verification found a blocker.** The owner's fail condition is
*"if any required provider selection cannot be verified"* — every selection was verified. **PRV-003 is
therefore classified KEEP-CONDITIONAL, not SELECT**, and the unresolved part is escalated as INTQ-3
rather than decided. **If the owner reads the gate as requiring a positive Resend selection, this lock
should be rejected and INTQ-3 answered first.**

### 41.2 Final counts

| Family | Range | Count |
|---|---|---|
| INT-P principles | INT-P1 … INT-P14 | 14 |
| INT-D decisions | INT-D001 … INT-D042 | **42** |
| INTAR requirements | INTAR-001 … INTAR-028 | **28** |
| INT-R risks | INT-R001 … INT-R014 | 14 |
| INT-F findings | INT-F01 … INT-F06 | 6 |
| **PRV providers** | PRV-001 … PRV-011 | **11** |
| **INT-C contracts** | INT-C001 … INT-C009 | **9** |
| **MAIL templates** | MAIL-001 … MAIL-024 | **24** |
| Diagrams | ID-1 … ID-12 | 12 |
| Sections | 1 … 41 | **41** |
| **New conflicts** | C-91 … C-97 | **7** |
| Conflicts closed | — | **0** |
| Amendments raised | **A16-001 · A16-002 · A15-002** | **3** |
| Amendment identified as required if INTQ-3 = A | **A11-001** — not raised, contingent | — |
| Open owner questions | **INTQ-3** | **1** |

### 41.3 Lock

```
STAGE 17 — INTEGRATIONS, PROVIDERS & EXTERNAL BOUNDARIES
STATUS: LOCKED
Locked: 31 August 2026 by the owner (BytHub Technology Ltd)
Owner decisions: INTQ-1 = A · INTQ-2 = C
Open owner questions: 1 — INTQ-3, raised by provider verification, blocking PRV-003 only
New conflicts: C-91 … C-97      Conflicts closed: 0
Amendments raised: A16-001 · A16-002 · A15-002
Stage 18 is authorised. The go-live block of 23 August 2026 stands.
```

Later stages may implement and provision. **They may not silently change:**

- a provider signal is never business truth; **no callback enters I-2**;
- **school-owned future payment accounts**; BytHub is not the central merchant or remitter;
- the **V1 reconciliation-only** position;
- **ScholarShelf sending infrastructure with school display identity**, and **no per-school DNS
  dependency for V1**;
- the selected object storage (**PRV-004**), scanning approach (**PRV-005**), compromised-password
  mechanism (**PRV-006**), error monitoring (**PRV-007**) and availability arrangement (**PRV-008**);
- the provider data-minimisation contracts (**INT-C001 … INT-C009**);
- **MOD-009 notification truth / MOD-015 delivery attempt** separation;
- **DBT-040's school-only meaning**;
- external integrations behind gateways.

**Stage 17 approval is not production security clearance, not vendor approval and not legal sign-off.**
**No provider account has been created, no secret supplied, no SDK installed, no configuration changed.**
The BytHub Legal & Compliance go-live block of 23 August 2026 — **17 Critical, 52 High, across 14
domains, 0% clearance** — **stands in full.** The baseline remains **UNVERIFIED**, capped at **E2**.
---

## 42. Owner review — INTQ-3 resolution, amendments, and the replacement provider

**This section is the current reading of Stage 17. Where it differs from §33–§41, this section
governs.** §33–§41 remain as the historical record of the lock of 31 August 2026, and are not edited.

```
INTQ-1   DECIDED — A     each school owns its payment-provider account
INTQ-2   DECIDED — C     school display identity, ScholarShelf sending infrastructure
INTQ-3   DECIDED — A     TQ-1's UK/EU processing policy INCLUDES transactional email

OPEN OWNER QUESTIONS: 0
```

### 42.1 INTQ-3 = A — and why it was never really an unconstrained choice

**The owner's reading is correct and this document adopts it.** Stage 11 TD-025 already states, in
locked text: *"**TQ-1 applies here too.** Resend receives recipient addresses and message content —
which includes children's names and payable amounts."* The policy was already stated; what was missing
was the verification.

Stage 17's verification supplied it: **Resend's sending region can be Ireland, but all account data,
email metadata, logs and API records are stored in the United States, and no configuration changes
that.** The locked policy plus the verified fact together determine the outcome. **INTQ-3 = A records
a determination, not a preference.**

**This is a product and procurement policy decision. It is NOT a statement that US processing of
transactional email is unlawful under UK GDPR.** Qualified legal review remains required for the
transfer analysis, and nothing here substitutes for it (§14).

**C-97 · TARGET RESOLUTION ESTABLISHED · IMPLEMENTATION OPEN — not closed.**

```
C-97   TARGET RESOLVED       the email provider must satisfy TQ-1
       IMPLEMENTATION OPEN   Resend is still the provider in the current tree
                             migration has not happened
                             a target decision is not a remediation
```

### 42.2 A11-001 — amendment raised against locked Stage 11

Recorded in full in `TECH_STACK.md`'s amendment register.

```
A11-001 · Transactional email provider replacement required by TQ-1
RAISED BY  Stage 17 owner review, 31 August 2026
AFFECTS    TD-025 · the §3 technology table's Email row
TYPE       AMENDED TARGET — the historical selection is preserved, not rewritten
```

| | |
|---|---|
| **ORIGINAL (locked, preserved)** | Resend **KEEP**, subject to later provider and privacy verification. The Email row carried no [TQ-1] marker while TD-025's prose said TQ-1 applied |
| **NEW EVIDENCE** | Stage 17's official verification: SES-equivalent account data, email metadata, logs and API records are stored in the US; **all 22 Resend sub-processors are USA**; the Ireland region controls sending only |
| **LOCKED POLICY** | TQ-1 applies to email — TD-025's own prose |
| **AMENDED TARGET** | **Resend is a CURRENT / LEGACY provider only.** It must be replaced before production by a provider whose *verified* technical and data-location posture satisfies the locked UK/EU procurement policy |

**TD-025 is not rewritten as though Resend had never been selected.** It was a reasonable selection on
the evidence available at Stage 11, and the document says so; **the chronology is the record, and
erasing it would hide how the decision was actually reached.**

### 42.3 A17-001 — amendment raised against this stage's own lock

```
A17-001 · INTQ-3 resolution and email-provider replacement
RAISED BY  owner review, 31 August 2026
AFFECTS    §33 PRV register (PRV-003) · §34.6 · §39 · §41
TYPE       RESOLUTION of an open question, plus a provider addition
```

| Locked at §41 | Current reading |
|---|---|
| INTQ-3 **OPEN** | **INTQ-3 = A · DECIDED** |
| Open owner questions: **1** | **0** |
| PRV-003 Resend **KEEP-CONDITIONAL** | **PRV-003 Resend — CURRENT / LEGACY · REPLACE BEFORE PRODUCTION** |
| PRV register PRV-001 … PRV-011 | **PRV-001 … PRV-012** — appended, **PRV-003 is not reused and nothing is renumbered** |
| C-97 raised, unresolved | **C-97 target resolved · implementation open** |

### 42.4 PRV-012 · Amazon SES, `eu-west-2` (London) — SELECT

**Evaluated first because the architecture is already partly AWS — S3 `eu-west-2` (PRV-004) and
GuardDuty (PRV-005) — and one provider family is one DPA, one contracting entity and one IAM boundary.
It was NOT selected for that reason**; it was selected because the SES-specific facts verify.

| # | Requirement | Verified | Source |
|---|---|---|---|
| 1–2 | **SES is available in `eu-west-2` for outbound transactional email**, API **and** SMTP | ✔ `email.eu-west-2.amazonaws.com` · `email-smtp.eu-west-2.amazonaws.com` | `docs.aws.amazon.com/general/latest/gr/ses.html` |
| 3 | where message content and service data are processed | **PARTIAL** — AWS's general commitment is *"customer data stays in the AWS Region you select"*; **SES-specific retention documentation does not state a region** | `aws.amazon.com/compliance/eu-data-protection/` · `docs.aws.amazon.com/ses/latest/dg/data-protection.html` |
| 4 | is SES among the services whose normal operation requires transfer outside the Region | **NOT ESTABLISHED EITHER WAY.** AWS discloses that *"a small number of AWS services involve the transfer of data … because transfer is an essential part of the service (such as a content delivery service)"* but **no per-service exception list naming or excluding SES was obtainable** | as above |
| 5 | AWS DPA applicability | ✔ the AWS DPA and the sub-processor register both cover SES by name | `aws.amazon.com/compliance/sub-processors/` |
| 6 | **sub-processors** | ✔ **and this is a material finding — see below** | as above |
| 7 | bounce / complaint / delivery events | ✔ SES publishes event notifications for these classes | SES developer guide |
| 8 | stable message and event identity | ✔ SES returns a message id used to correlate events | SES developer guide |
| 9–10 | sending-domain verification, DKIM, SPF, DMARC for a **ScholarShelf-controlled** domain | ✔ standard SES domain identity verification | SES developer guide |
| 11 | Node / Vercel compatibility | ✔ AWS SDK v3 is a plain HTTPS client; no daemon, no native binary | |
| 12 | retry and error semantics | ✔ throttling and transient errors are distinguishable from permanent rejections | |
| 13 | quotas and production access | **a named provisioning step** — SES accounts begin in a sandbox and require a production-access request | |
| 14 | deletion / retention controls | **PARTIAL** — not documented at the level obtained | |
| 15 | pricing reasonable for V1 | ✔ per-message pricing at V1 volumes is immaterial | |

**The material sub-processor finding, recorded rather than buried.** AWS's sub-processor register
(last updated 28 July 2026) names, **for Amazon SES specifically**, two third-party providers for
*"Email deliverability metrics"*:

```
250ok Inc.                 Brazil · UK · USA
Email Data Source, Inc.    Brazil · UK · USA
providing AWS entity for SES:  AMCS LLC (USA) for most customers
```

**This is not equivalent to the Resend finding and the difference is the point.** Resend's own
documentation states affirmatively that **all** account data, metadata, logs and API records are stored
in the US. AWS's states that customer data stays in the selected Region, and names **two deliverability-
metrics sub-processors with multi-jurisdiction locations** whose applicability the register says
*"will depend on the AWS Region the customer selects and the particular AWS services that the customer
uses."*

**Two residuals are therefore recorded as Stage 21 pre-provision verification items, not waved away:**

```
R1   SES-specific documentation confirming where message content is retained, and for how long
R2   whether 250ok / Email Data Source apply to an eu-west-2 SES sender, and what they receive
```

**Neither residual blocks the architecture decision**, because the same AWS regional commitment already
underpins Neon (`aws-eu-west-2`) and S3 (`eu-west-2`) — **the data layer already rests on it.** Both
residuals are **procurement and legal verification**, and §14's boundary holds: the technical data flow
is recorded; **the legal classification is LEGAL REVIEW REQUIRED.**

**PRV-012 · Amazon SES · Class B · SELECT · region `eu-west-2` (London) · platform-scope configuration
— NOT a DBT-040 row** (INT-D003).

### 42.5 INT-C001 is replaced provider-neutrally — INT-C010

**INT-C001 (Resend delivery) remains in the register as the legacy contract.** The target contract is
appended, not edited:

| INT-C | Contract | Provider | Auth | Data allowed out | Forbidden | Owner |
|---|---|---|---|---|---|---|
| **INT-C010** | email send — target | **PRV-012 SES** | **AWS SigV4, IAM least-privilege, credentials from the secret store** | recipient address, subject, rendered body, school **display** identity | credentials · session ids · raw tokens at rest · any field not in the MAIL template's allow list | **MOD-015** |
| **INT-C011** | email event receipt — target | **PRV-012 SES** | event notification with **SES message id** as the stable identity | — inbound | — | **MOD-015** |

**INT-D043 · The email gateway is the only thing that changes. MOD-009 / MOD-015 does not.**

```
MOD-009   notification truth        UNCHANGED — DBT-053, written inside the business transaction
MOD-015   delivery attempt          UNCHANGED — DBT-054, one row per attempt
gateway   the selected transport    Resend  →  SES        ← the ONLY layer that moves
```

**No provider identifier enters a business module.** A SES message id is a `provider_reference` on a
delivery attempt (DBT-054), exactly where a Resend message id sits today. **A provider swap must not
change workflow meaning, and under this split it cannot.**

**INT-D044 · MAIL-001 … MAIL-024 are unchanged and are not duplicated for SES.** They are ScholarShelf
template contracts, provider-neutral by construction. **A per-provider template set would be the first
step towards a provider identifier in a business module.**

**INTQ-2 = C is not reopened.** The experience — *"School Name via ScholarShelf"*, a ScholarShelf-
controlled verified sending domain, optional configured Reply-To, **no per-school DNS** — is unchanged.
**The provider is replaceable behind that experience, which is what §42.5 demonstrates.**

### 42.6 PRV-005 GuardDuty — reclassified SELECT-CONDITIONAL after rechecking

**§34.3 recorded the feature-level region gap honestly and it was rechecked. It has not closed.**

| | |
|---|---|
| **Verified** | *"GuardDuty downloads that object from S3 bucket by using an AWS PrivateLink and then reads, decrypts, and **scans it in an isolated environment in the same Region**."* — a direct residency statement, stronger than anything obtained before |
| **Verified** | GuardDuty endpoints exist for `eu-west-2` — `guardduty.eu-west-2.amazonaws.com` |
| **Verified** | the five scan statuses, unchanged (INT-D037) |
| **STILL UNVERIFIED** | **feature-level availability of Malware Protection for S3 in `eu-west-2` specifically.** Three documentation routes were attempted; two returned redirect loops and the third does not state per-feature region availability |

**INT-D045 · PRV-005 is reclassified SELECT-CONDITIONAL, and Stage 21 carries a hard gate**

```
PRV-005   Amazon GuardDuty Malware Protection for S3
          SELECT-CONDITIONAL
          → the architecture selects it
          → Stage 21 MUST verify feature availability against an eu-west-2 bucket
            BEFORE the object-storage migration (MIG-11) depends on it

IF UNAVAILABLE IN eu-west-2    the fallback is NOT a self-hosted daemon (§34.3)
                               it is scan-on-demand serverless invocation,
                               preserving the same three-way vocabulary and the same
                               fail-closed gate
```

**The scanner is not described as configured, enabled, provisioned or proven running anywhere in this
document.** The same-Region PrivateLink statement is a good residency fact and it is **not** a
statement of feature availability, and conflating the two would be the exact error §8 of the owner's
instruction exists to prevent.

### 42.7 Consistency cleanup

**Every current-target summary now reads:**

```
INTQ-1 = A   ·   INTQ-2 = C   ·   INTQ-3 = A   ·   Open owner questions: 0
PRV-003 Resend        CURRENT / LEGACY — replace before production
PRV-012 Amazon SES    SELECT — eu-west-2 (London)
PRV-005 GuardDuty     SELECT-CONDITIONAL — Stage 21 gate
Stage 17 SELECTS providers   ·   Stage 21 PROVISIONS them
```

**Statements superseded by this section**, each remaining in place as historical record within §33–§41:
*"KEEP-CONDITIONAL"* for PRV-003 · *"Open owner questions: 1"* · *"INTQ-3 OPEN"* · *"No replacement is
chosen here"* · PRV-005 as unqualified **SELECT**.

**Not stale and not changed:** the corrections at §5 (DBT-040), §7 (numbers to Stage 18), §10 (bounce
semantics), §15 (API-278) and §25 (selection ownership) were made before the lock and stand.

### 42.8 Amended counts

| Family | Range | Count |
|---|---|---|
| INT-D decisions | INT-D001 … **INT-D045** | **45** |
| INTAR requirements | INTAR-001 … INTAR-028 | 28 |
| **PRV providers** | PRV-001 … **PRV-012** | **12** — nothing renumbered, PRV-003 not reused |
| **INT-C contracts** | INT-C001 … **INT-C011** | **11** |
| MAIL templates | MAIL-001 … MAIL-024 | 24 — **unchanged and provider-neutral** |
| Sections | 1 … **42** | 42 |
| New conflicts | C-91 … C-97 | 7 |
| **Conflicts closed** | — | **0** — C-97 is target-resolved, implementation open |
| Amendments raised **by** Stage 17 | A16-001 · A16-002 · A15-002 · **A11-001** | 4 |
| Amendments raised **against** Stage 17 | **A17-001** | 1 |
| **Open owner questions** | — | **0** |

```
STAGE 17 — INTEGRATIONS, PROVIDERS & EXTERNAL BOUNDARIES
STATUS: LOCKED — 31 August 2026, amended by A17-001 on owner review
INTQ-1 = A · INTQ-2 = C · INTQ-3 = A · Open owner questions: 0
Email target: PRV-012 Amazon SES eu-west-2 · Resend is CURRENT/LEGACY
C-97 target resolved, implementation open · Conflicts closed: 0
No provider account created · no SDK installed · no configuration changed · no code changed
The go-live block of 23 August 2026 stands.
```
