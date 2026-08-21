/**
 * server/middleware/test-superuser.ts
 *
 * Server-side truth for the Universal Test Account.
 *
 * Three questions live here, and nothing else:
 *   1. Is the feature switched on at all?        → isTestModeEnabled()
 *   2. Does THIS account hold the flag?          → isTestSuperuser()
 *   3. Is THIS session simulating a role,
 *      and which one?                            → the session helpers
 *
 * The answer to (2) is read from the database, never from the request. The
 * answer to (3) lives in the session, written only after (1) and (2) both pass.
 * That ordering is the whole security model: a client can ask to switch role,
 * but it can neither grant itself the flag nor write the simulated role.
 */
import type { Request } from "express";
import { storage } from "../storage.js";
import { TEST_SUPERUSER_PERMISSION, ALL_ACCESS_CONTEXT } from "../../shared/test-superuser.js";

/**
 * The feature is a development tool. It is OFF in production unless someone
 * deliberately turns it on for a staging deployment.
 *
 * Evaluated per call rather than cached at import, so a test can flip it and so
 * a misread env var can never be baked in at module load.
 */
export function isTestModeEnabled(): boolean {
  if (process.env.ALLOW_TEST_SUPERUSER === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Does this user hold the test-superuser flag?
 *
 * Reads `user_permissions` — the same table that already stores branding grants
 * and secondary roles. Returns false whenever the feature is disabled, so a
 * flagged account left behind in a production database is inert.
 */
export async function isTestSuperuser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (!isTestModeEnabled()) return false;
  try {
    const permissions = await storage.getUserPermissions(userId);
    return permissions.includes(TEST_SUPERUSER_PERMISSION);
  } catch {
    // A permission lookup failure must never accidentally GRANT access.
    return false;
  }
}

/**
 * The cheap, synchronous check used on the hot path (every `requireRole` call).
 *
 * `session.testSuperuser` is stamped at login and refreshed on every context
 * switch, always after a database check — so trusting it here is trusting a
 * value the server itself wrote, not one the client sent.
 */
export function sessionIsTestSuperuser(req: Request): boolean {
  return isTestModeEnabled() && req.session?.testSuperuser === true;
}

/** True when this session is in "All Features" mode. */
export function sessionHasAllAccess(req: Request): boolean {
  return sessionIsTestSuperuser(req) && req.session?.activeContext === ALL_ACCESS_CONTEXT;
}

/**
 * Stamp (or clear) the flag on the session. Called at login and after any
 * change that could affect it. Never called with a client-supplied value.
 */
export async function stampTestSuperuser(req: Request, userId: string): Promise<boolean> {
  const flagged = await isTestSuperuser(userId);
  req.session.testSuperuser = flagged || undefined;
  return flagged;
}

/**
 * Grant or revoke the flag. Server-side only — there is deliberately no HTTP
 * route that calls this. The account is created by `npm run seed:test-account`.
 */
export async function grantTestSuperuser(userId: string): Promise<void> {
  await storage.addUserPermission(userId, TEST_SUPERUSER_PERMISSION);
}

export async function revokeTestSuperuser(userId: string): Promise<void> {
  await storage.removeUserPermission(userId, TEST_SUPERUSER_PERMISSION);
}
