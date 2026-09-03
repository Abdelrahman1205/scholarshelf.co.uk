# COMPLIANCE_CONTROL_INVENTORY.md

> **Note — 2026-09-02.** Demo accounts, the `POST /api/seed-users` endpoint, the
> in-memory fallback accounts and the login-page quick-login buttons have been
> removed from the codebase. Anything below describing them is a record of how
> the system used to work. Test fixtures now live in `tests/support/seed-fixtures.ts`.
> Rows already written to a live database still need deleting — see Part 4 of
> `DEPLOY_CHECKLIST.md`.

# The architecture's answer to the go-live block — one half of a mapping

```
STATUS: WORKING DOCUMENT — not a stage, not locked, not approved
Written: 1 September 2026

THIS DOCUMENT CLEARS NOTHING.

The BytHub Legal & Compliance deployment halt and production go-live block
of 23 August 2026 — 17 Critical, 52 High, across 14 domains, 0% compliance
clearance — STANDS IN FULL.

NO COMPLIANCE CLAIM IS MADE ANYWHERE IN THIS DOCUMENT.
NO FINDING OF LAW IS ADOPTED.
NO RETENTION PERIOD IS INVENTED.
```

---

## 1. Why this exists, and what it deliberately is not

The block is **cited in ten locked documents and itemised in none.** Sixty-nine findings across
fourteen domains, and no register anywhere lists them individually. A gate nobody can enumerate is a
gate nobody can close.

This document builds **the right-hand side of the mapping**: every compliance-relevant control the
locked architecture already specifies, with its identifier, its owning stage, the batch that
implements it, the evidence that would prove it, and its **actual state today**.

When the findings arrive, each one either lands on a control below — or falls through, and a
fall-through is the real work.

**What this document is NOT:**

| | |
|---|---|
| **Not a compliance assessment** | engineering cannot grant compliance clearance. **BytHub Legal & Compliance can** |
| **Not a claim that any control works** | every control below is **SPECIFIED**. Not one is implemented, and none is verified |
| **Not a legal interpretation** | where a UK GDPR obligation is named, it is named because Stage 16 records it as *asserted by the audit or by the regulation's plain text*. This document **does not adopt a finding of law** |
| **Not a retention schedule** | **no retention period is invented here.** Every one is **POLICY INPUT REQUIRED** |
| **Not evidence** | the baseline is **UNVERIFIED**, capped at **E2** — read directly, not executed |

---

## 2. What is missing, and exactly what I need from you

```
THE 69 FINDINGS THEMSELVES.

   the BytHub Legal & Compliance report of 23 August 2026
   17 Critical · 52 High · the 14 domain names

WITHOUT THEM THIS DOCUMENT IS HALF A MAPPING.
```

**What each finding needs to carry, for the mapping to be mechanical:** an identifier, its severity,
its domain, what it asserts is wrong, and — where the report gives one — the obligation it is asserted
under. **If the report has no per-finding identifiers, say so and I will assign stable ones**, in a
register that never renumbers.

**What I will do with them:** each finding gets exactly one of five dispositions.

| Disposition | Meaning |
|---|---|
| **SPECIFICATION-RESOLVED** | the locked architecture already answers it. Names the control **and the batch that builds it**. **Still not closed** — a specification is not an implementation |
| **BATCH-OWNED** | not yet specified, but it belongs inside an existing MP-B. Names which |
| **POLICY INPUT REQUIRED** | it needs a decision from the owner or from Legal — a retention period, a lawful basis, a disposition. **Engineering must not invent it** |
| **EXTERNAL** | only an external party can close it — a penetration tester, an assessor, a DPO, a regulator |
| **UNADDRESSED** | nothing in Stages 1–22 answers it. **This is the list that matters most**, because it is the one that changes the plan |

---

## 3. The control inventory, by domain

**Reading the columns.** *Controls* are the locked identifiers. *Stage* owns the specification.
*Batch* is where the Master Plan builds it. *Evidence* is what would prove it. **State is SPECIFIED
for every row — there are no exceptions today.**

### 3.1 Identity and credentials

| Controls | Stage | Batch | Evidence that would prove it | State |
|---|---|---|---|---|
| **SECAR-003 … 006** server-side policy · bounded bcrypt tail · uniform login responses · **timing levelled** | 16 | **MP-B06** | login-response and timing suites | SPECIFIED |
| **Argon2id**, rehash-on-login — DEP-C007 · CBR-002 | 11 · 16 | **MP-B06 → MP-B12** | Argon2 suite; residual-bcrypt count reaching zero or being recorded | SPECIFIED |
| **SECAR-011 · 012** MFA enrolment requires the current password; recovery codes single-use and notified | 16 | **MP-B09** | **SEC-T03, demonstrated RED first** — C-90 | SPECIFIED |
| **SECAR-050** the MFA requirement is read from the credential at request time, never from `session.mfaEnabled` | 16 | **MP-B09** | MFA suite | SPECIFIED |
| **SECAR-051 … 053** every single-use credential enforced single-use **by the database**; no credential secret in the session store; the memory fallback unreachable from every credential path | 16 | **MP-B09 · MP-B12** | SEC-T + CBR-005's fail-to-boot assertion | SPECIFIED |
| **SECAR-013 · 014** concurrent redemption cannot both succeed; a password change is notified | 16 | **MP-B09** | concurrency test on a real database | SPECIFIED |

### 3.2 Access control and authority

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **CAP-001 … CAP-095**, the Stage 7 chain: PERSON → CONTEXT → AUTHORITIES → CAPABILITY → RESOURCE → SCOPE → CONDITIONS | 7 | **MP-B08 → MP-B12** | **TST-D034** — a role string must not satisfy a capability check | SPECIFIED |
| **SECAR-007** no capability check is satisfied by a role string | 16 | **MP-B08** | TST-D034 | SPECIFIED |
| **SECAR-001** no request-supplied header influences an authority decision, a credential, or a URL | 16 | **MP-B10** | origin and header suites | SPECIFIED |
| **PA-1** context and authority-exercised are **two separate audit facts** | 7 · 19 | **MP-B30** | audit taxonomy coverage | SPECIFIED |
| **PA-2** account recovery requires support mode | 7 | **MP-B28** | support-scope suite | SPECIFIED |

### 3.3 Tenant isolation

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **FORCE ROW LEVEL SECURITY** + ownership separation — MIG-10 · DEP-D015 | 15 · 16 · 21 | **MP-B07** | **PFL-008**, and **TEN-T run as a NON-BYPASSING role** | SPECIFIED |
| **SECAR-008 … 010** `SET LOCAL` on every scoped query; policies reviewed as security code; **support never bypasses RLS** | 16 | **MP-B07 · MP-B28** | TEN-T01 … T12 | SPECIFIED |
| **SECAR-046** an RLS denial is a **security alert** | 16 | **MP-B07 · MP-B10** | alerting assertion | SPECIFIED |
| twelve untenanted tables gain `school_id`, zero NULLs proved — **C-65** | 15 | **MP-B05** | MIG-T02 · MIG-T08 | SPECIFIED |
| **guardian scope across two schools — no cross-school aggregate** | 7 · 9 | **MP-B25** | TEN-T guardian scope | SPECIFIED |

> **The one live measurement in this table.** MP-B01 recorded tenant isolation at **25/26 with the S5
> cross-tenant probe unexercised** and four comparisons skipped for thin fixtures. Uncommitted MP-B04
> work takes it to **29/29 with S5 running** — the suite grew from 26 assertions to 29. **That is a
> harness change, not a regression comparison**, and neither number is verified evidence yet.

### 3.4 Audit and accountability

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **DBT-079 `audit_events` + DBT-080 `console_operations`**, linked by a UNIQUE FK | 15 · 19 | **MP-B30** | three-way reconciliation across the three current stores | SPECIFIED |
| **AET-001 … AET-102**, covering **67 audit-required capabilities** (A7-001) | 7 · 19 | **MP-B30** | taxonomy coverage, enumerated mechanically against the register | SPECIFIED |
| **Class A coupling** — an audit-write failure **rolls the business transaction back** | 19 | **MP-B20 + MP-B30** | **INV-T04**, by inducing the failure — **C-102** | SPECIFIED |
| **CK-A7** no invented actor, authority or capability; `UNKNOWN/LEGACY` where the source never had the field | 19 | **MP-B30** | CK-A7 assertion | SPECIFIED |
| **SECAR-002 · 034** no credential field ever leaves the server; **logs are a personal-data store** | 16 | **MP-B10** | log-redaction suite — **C-18** | SPECIFIED |
| **AUD-D055** domain history is not audit; **no message body enters an audit record** | 19 | **MP-B23** | audit-exclusion assertion | SPECIFIED |
| **A19-001** legacy snapshots **QUARANTINED AND PRESERVED**, restricted read, not in audit search, not in any export | 19 | **MP-B30 · MP-B34** | quarantine reconciliation; an authorised operator reads one | SPECIFIED |

### 3.5 Personal data, children's data and lawful basis

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SEC-D068 · SECAR-038** the personal-data map exists **and is maintained** | 16 | **MP-B10 onward** | the map, reviewed per batch that adds a data class | SPECIFIED |
| **SEC-D016 · D069 · D070 · SECAR-039** children's data; **import staging is the shortest-lived store** | 16 | **MP-B22** | staging lifetime assertion | SPECIFIED |
| **SEC-D071 · D072 · SECAR-040** roles and lawful basis; **every DPA mechanism exists** | 16 | — | **POLICY INPUT REQUIRED** — the lawful basis is not engineering's to assert | **SPECIFIED + POLICY** |
| **SEC-D077 · D078** logs and derived stores are **in scope** for every right and every retention rule | 16 | **MP-B10** | derived-store enumeration | SPECIFIED |

### 3.6 Data-subject rights

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SEC-D073 · D074 · D075** access · rectification · restriction | 16 | **MP-B28** | per-right exercise against a real dataset | SPECIFIED |
| **SECAR-041** **rectification reaches derived data** — not just the source row | 16 | **MP-B28 · MP-B29** | a correction propagating to projections and exports | SPECIFIED |
| **SECAR-042** restriction is **expressible** in the model | 16 | **MP-B28** | model assertion | SPECIFIED |
| **API-276** erase-account, **CAP-036**, break-glass | 14 · 7 | **MP-B28** | audited elevation — AET-030 | SPECIFIED |

### 3.7 Retention and destruction

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SEC-D076 · SECAR-043** retention **runs as a job**, not as a manual act | 16 | **MP-B28** | the job, its schedule, its audit fact | SPECIFIED |
| **every retention PERIOD** | — | — | **POLICY INPUT REQUIRED. NO PERIOD IS INVENTED IN ANY LOCKED DOCUMENT** | **BLOCKED ON POLICY** |
| **MIG-14** — the one irreversible drop, behind **§39's eleven conditions** | 15 · 22 | **MP-B35** | all eleven, recorded | SPECIFIED |
| **final snapshot destruction** | 19 | — | **APPROVED LEGAL / PRIVACY DISPOSITION REQUIRED.** **MIG-14 may not destroy the quarantined bytes, and no pipeline can satisfy this** — A19-001 · AUD-P22 | **BLOCKED ON LEGAL** |

### 3.8 Third parties and sub-processors

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SEC-D079 · SECAR-044** **no analytics, no session replay, anywhere** | 16 | **MP-B10** | bundle and network assertion | SPECIFIED |
| **SECAR-045** the processing region is **settled** — **C-63** | 16 · 21 | **MP-B04** compute · **PFL-004** database | `lhr1` is the only execution region; the live database reports `eu-west-2` | **SPECIFIED · PROVISIONING OPEN** |
| Resend → **SES `eu-west-2`**, one active sender — **CBR-011** | 17 | **MP-B24 → MP-B32** | delivery parity; **never dual-send** | SPECIFIED |
| **Sentry EU** — **the region choice is irreversible** | 17 · 21 | **MP-B10** | PFL-013 | **SPECIFIED · PROVISIONING OPEN** |
| S3 `eu-west-2` + **GuardDuty**; **PENDING is readable by nobody** — OPSQ-1 = A | 17 · 21 | **MP-B26** | **PFL-010's EICAR test in staging, the hard gate** | SPECIFIED |

### 3.9 Breach detection and response

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SEC-D080 · SECAR-047** **breach questions are answerable from the data map plus the audit** | 16 · 19 | **MP-B30** | a rehearsal answering "whose data, which records, over what window" | SPECIFIED |
| **SECAR-035** the correlation id suffices to reconstruct a request | 16 | **MP-B10** | correlation coverage | SPECIFIED |
| CloudTrail on both AWS accounts **from day one** | 21 | **MP-B02** | CloudTrail confirmed logging | **PROVISIONING OPEN** |

### 3.10 Verification — the controls that verify the controls

| Controls | Stage | Batch | Evidence | State |
|---|---|---|---|---|
| **SECAR-048** an **independent penetration test before go-live** | 16 | — | **EXTERNAL** | **NOT BOOKED** |
| **SECAR-049** **the baseline remains UNVERIFIED at E2** | 16 | **MP-B01** | partially discharged — see §4 | **PARTIAL** |
| **decision 2A** — manual **WCAG 2.2 AA** assessment, eight surfaces, **mandatory before production go-live** | 20 | per release | **EXTERNAL.** **Not a "certificate"** — an assessment record | **NOT BOOKED** |
| **backup restore rehearsal** — PFL-016 · REL-G012 | 21 | **MP-B33** | **a backup that has not been restored is not a backup** | **NOT RUN** |
| **SEC-T01 … SEC-T18** | 20 | MP-B02 … MP-B28 | **no known-red security test merges** | SPECIFIED |

---

## 4. The honest state line

```
CONTROLS SPECIFIED           every row above
CONTROLS IMPLEMENTED         none
CONTROLS VERIFIED            none

BASELINE                     UNVERIFIED, capped at E2, except the specific
                             commands MP-B01 ran and recorded
BATCHES COMPLETE             MP-B01 only
BATCHES BLOCKED              MP-B02, on nine external provisioning items
CONFLICTS CLOSED             zero, in the entire programme to date

THE GO-LIVE BLOCK            17 Critical · 52 High · 14 domains · 0% clearance
                             UNCHANGED BY THIS DOCUMENT
```

**Three things above are blocked on someone other than engineering, and they are the ones with the
longest lead times:** the penetration test, the WCAG 2.2 AA assessor, and **every retention period**.
None is started. **All three can start today** — none of them waits on AWS, Neon or Vercel.

---

## 5. What the architecture does NOT cover

**Stated plainly, because a control inventory that only lists strengths is a sales document.**

| Gap | Why it is a gap |
|---|---|
| **Retention periods** | not one exists in any locked document, by design. Until Legal supplies them, **SEC-D076's job has no schedule to run** |
| **Lawful basis per processing purpose** | Stage 16 records that the mechanisms must exist. **It does not, and may not, assert the basis** |
| **Final snapshot disposition** | A19-001 chose *quarantine and preserve pending policy*. **That policy does not exist.** MIG-14 cannot proceed past it |
| **The 14 domain names** | unknown to this document. **The domain grouping in §3 is the architecture's own, not the auditor's**, and the two will not align perfectly |
| **Anything the report raises that Stages 1–22 never considered** | **this is the disposition that changes the plan**, and it cannot be estimated before the findings are read |

---

## 6. The three things worth starting this week

| | Why now |
|---|---|
| **1 · Send me the 23 August report** | it is the only missing input. Everything in §2 becomes mechanical the moment it exists |
| **2 · Book the assessor and the penetration tester** | **SECAR-048 and decision 2A are hard release gates with weeks of lead time and zero progress.** Booking them costs nothing and is not blocked by anything |
| **3 · Get retention periods and lawful basis from Legal** | they block **SEC-D076**, **MIG-14** and the snapshot disposition. Engineering **must not** invent them, and the plan cannot route around them |

```
NONE OF THE THREE WAITS ON AWS, NEON OR VERCEL.
ALL THREE ARE ON THE CRITICAL PATH TO PRODUCTION.
TWO OF THEM ARE, TODAY, AT ZERO.
```
