# Row-level security — what has to happen before it can be switched on

**Status: policies written (`migrations/007_row_level_security.sql`), RLS not enabled.**

The Legal & Compliance directive requires database-enforced tenant separation.
The policies exist and can be reviewed. They are inert until three things change,
and the order matters — enabling RLS before them takes the platform down.

## Why it is not just `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

A policy needs to know which tenant is asking. The standard way to tell it is a
session setting written inside the request's transaction:

```sql
BEGIN;
  SET LOCAL app.school_id = '<from the server session>';
  -- every query in this request
COMMIT;
```

ScholarShelf cannot do that today, for a specific reason: tenant data goes
through `getDb()`, which is the **Neon serverless HTTP driver**. Every statement
is an independent HTTP request on its own connection. There is no session for a
setting to live in, so `SET LOCAL` would apply to a connection that is gone
before the next query runs. The policies would evaluate against an unset setting,
`app_current_school_id()` would return NULL, and every row would be invisible.

So RLS is not a migration. It is a driver change.

## The three preconditions

**1. Pooled connections and a transaction per request.**
`getTxDb()` in `server/storage.ts` and `getPool()` in `server/config/database.ts`
already give pooled node-postgres connections — settlement uses one. Tenant reads
and writes need to move onto the same footing: a middleware that opens a
transaction, sets the GUC, and hands that handle to the storage layer for the
life of the request.

This is the large piece of work. It touches the ~150 storage methods that
currently call `getDb()` directly. It is also worth doing on its own merits: it
is what makes a request atomic, not only what makes RLS possible.

**2. The setting must come from the session, never from the request.**
`sessionSchoolId(req)` is already the single place that answers "which school is
this request for", and it reads the session. That is the value to set, and
nothing else may reach it. A header or body field that could influence
`app.school_id` would hand every tenant the keys to every other tenant.

Platform-owner requests set `app.platform_owner = 'on'` instead — the same rule
`sessionSchoolId` already applies when it returns `null` for owner roles, and
support mode continues to work by setting `app.school_id` to the school being
supported.

**3. The application must stop connecting as the database owner.**
RLS does not apply to a table's owner, and does not apply to any role with
`BYPASSRLS`. Connect as the owner and the policies are enabled, visible in
`pg_policies`, and enforcing nothing — which is worse than not having them,
because it looks done. `migrations/007` creates `scholarshelf_app` for this;
`DATABASE_URL` must point at it before RLS goes on, and `FORCE ROW LEVEL
SECURITY` must be set so even the owner is subject to the policy.

## Order of work

1. Request-scoped transaction middleware; storage methods take the handle.
2. Point the application's `DATABASE_URL` at `scholarshelf_app`. Nothing changes
   behaviourally — the role has the same DML grants — so this is a safe, separate
   deploy that proves the grants are right.
3. Run `migrations/007` (creates role and policies; still inert).
4. In a scratch database, enable RLS on every tenant table and run
   `npm run test:tenant`. The S5 cross-tenant probe is the one that matters.
5. Enable table by table in production, verifying between each, starting with the
   lowest-traffic tables and ending with `students` and `book_payments`.
6. Write the `users` policy separately. It is the one table the pattern does not
   fit: platform-owner rows have a NULL `school_id` by design, and sign-in has to
   find an account before any school is known.

## What is protecting tenants in the meantime

- The application-layer scoping asserts, and `sessionSchoolId` as the single
  choke point.
- The `school_id` foreign keys in `migrations/002b`.
- The **composite** foreign keys in `migrations/006`, which are the part of the
  directive's B.1 that could be delivered without the driver change: a basket
  cannot be linked to a payment in another school, and an allocation cannot name
  a student or a book from another school, because the `(id, school_id)` pair it
  would have to reference does not exist.

That is a real improvement and it is not RLS. Tenant separation is still
enforced by application code, and one missed scope check still crosses a school
boundary. Describe it that way to anyone who asks.
