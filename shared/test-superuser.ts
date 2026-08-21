/**
 * shared/test-superuser.ts
 *
 * The Universal Test Account — one development account that can view the
 * platform as any role without logging out.
 *
 * WHY THIS FILE IS SMALL
 *
 * ScholarShelf already has role simulation. A user can hold secondary roles
 * (`SECONDARY_ROLE:<role>` rows in `user_permissions`), `getUserAccessProfile()`
 * turns those into a list of available "contexts", `POST /api/auth/context`
 * switches between them, `requireRole()` authorises against the ACTIVE CONTEXT
 * rather than the stored role, and `layout.tsx` already renders a context
 * switcher. None of that needed to be built.
 *
 * So the test account is not a new permission system. It is one flag that makes
 * `getUserAccessProfile()` return EVERY role as an available context, plus one
 * extra context ("all_access") that satisfies any role check. Everything after
 * that — the switch endpoint, the session storage, the server-side guards, the
 * client route guards, the navigation — is the machinery that was already there.
 *
 * SECURITY
 *
 *   · The flag lives in `user_permissions`, server-side. A client cannot set it,
 *     and nothing in a request body can grant it.
 *   · The whole feature is OFF in production unless ALLOW_TEST_SUPERUSER=true is
 *     set deliberately. With it off, the flag grants nothing at all.
 *   · Switching still goes through `syncSessionActiveContext()`, which refuses
 *     any context the account does not actually have.
 *   · The simulated role is stored in the SESSION, never trusted from the
 *     client, so hiding UI is not what enforces anything — the API is.
 */

/**
 * The permission string that marks the Universal Test Account. Stored as a row
 * in `user_permissions` (the same table that already carries BRANDING_* grants
 * and SECONDARY_ROLE:* entries), so this needs no schema change.
 */
export const TEST_SUPERUSER_PERMISSION = "TEST_SUPERUSER";

/**
 * The "All Features / Super Admin" context.
 *
 * Deliberately NOT a member of USER_ROLES: it is not a role anybody can hold,
 * it is a testing mode. `requireRole()` lets it through every check, but only
 * for a session the server has already verified as a test superuser.
 */
export const ALL_ACCESS_CONTEXT = "all_access";
export const ALL_ACCESS_LABEL = "All Features (Super Admin)";

/**
 * Roles the Universal Test Account does NOT simulate.
 *
 * The switcher is otherwise built from the platform's own USER_ROLES enum, so a
 * role added to ScholarShelf tomorrow appears automatically. These three are
 * deliberately held back:
 *
 *   owner, platform_admin — the platform-owner tier. These reach every tenant's
 *     data across every school, so a development convenience account is the
 *     wrong thing to hand that to. (They are one tier: both resolve through
 *     PLATFORM_OWNER_ROLES and both land on /admin/owner.) Remove them from this
 *     list if you decide you want them.
 *
 *   student — present in USER_ROLES, but ScholarShelf has no student portal:
 *     no route, no dashboard, no navigation. There is nothing to simulate, and
 *     inventing a student area is not this feature's job.
 */
export const TEST_ACCOUNT_EXCLUDED_ROLES: readonly string[] = ["owner", "platform_admin", "student"];

/** Where "All Features" mode lands — the widest real screen in the app. */
export const ALL_ACCESS_DEFAULT_PATH = "/admin";

/** Human labels for the contexts a tester will be switching between. */
export const CONTEXT_LABELS: Record<string, string> = {
  owner: "Platform Owner",
  platform_admin: "Platform Admin",
  school_admin: "School Admin",
  admin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  finance: "Finance",
  it_personnel: "IT Personnel",
  student: "Student",
  [ALL_ACCESS_CONTEXT]: ALL_ACCESS_LABEL,
};

export function contextLabel(key: string): string {
  return CONTEXT_LABELS[key]
    || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}
