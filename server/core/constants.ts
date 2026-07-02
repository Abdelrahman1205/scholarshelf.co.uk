/**
 * server/core/constants.ts
 *
 * All business-domain constants in a single file.
 * Import from here throughout the server — never re-declare inline.
 *
 * These mirror the shared/schema.ts constants but are decoupled from
 * the database schema layer so services can depend on them without
 * pulling in Drizzle/Zod.
 */

// ── Roles ──────────────────────────────────────────────────────────────────

export const PLATFORM_OWNER_ROLES   = ["owner", "platform_admin"] as const;
export const ADMIN_UI_ROLES         = ["admin", "school_admin", "owner", "platform_admin"] as const;
export const IT_WEBSITE_ROLES       = ["it_personnel"] as const;
export const FINANCE_ROLES          = [...ADMIN_UI_ROLES, "finance"] as const;
export const ALL_STAFF_ROLES        = [...FINANCE_ROLES, "teacher", "it_personnel"] as const;

export type PlatformOwnerRole       = (typeof PLATFORM_OWNER_ROLES)[number];
export type AdminUIRole             = (typeof ADMIN_UI_ROLES)[number];

/** Legacy role aliases for demo/seed accounts. */
export const LEGACY_ROLE_MAP: Record<string, string> = {
  admin:   "school_admin",
  teacher: "teacher",
  parent:  "parent",
};

export function resolveRole(role: string): string {
  return LEGACY_ROLE_MAP[role] ?? role;
}

export function isPlatformOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (PLATFORM_OWNER_ROLES as readonly string[]).includes(resolveRole(role));
}

// ── Session lifetimes (ms) ─────────────────────────────────────────────────

export const SESSION_MAX_AGE: Record<string, number> = {
  owner:          8  * 3_600_000,
  platform_admin: 8  * 3_600_000,
  school_admin:   8  * 3_600_000,
  admin:          8  * 3_600_000,
  finance:        8  * 3_600_000,
  it_personnel:   8  * 3_600_000,
  teacher:        24 * 3_600_000,
  parent:         30 * 86_400_000,
};
export const DEFAULT_SESSION_MAX_AGE = 24 * 3_600_000;

export function getSessionMaxAge(role: string): number {
  return SESSION_MAX_AGE[resolveRole(role)] ?? DEFAULT_SESSION_MAX_AGE;
}

// ── School setup statuses ──────────────────────────────────────────────────

export const COMPLETE_SETUP_STATUSES = new Set([
  "operational_setup_complete",
  "complete",
  "active",
]);

export const SCHOOL_SETUP_STEP_LABELS: Record<string, string> = {
  schoolProfileComplete:          "Complete school profile",
  brandingDesignConfigured:       "Configure branding & design",
  classesCreated:                 "Create at least one class",
  booksAdded:                     "Add at least one book",
  bookLevelsCreated:              "Create at least one book level",
  bookLevelsAssignedToClasses:    "Assign a book level to a class",
  studentsAdded:                  "Add at least one student",
  parentCodesGenerated:           "Generate parent linking codes",
  parentsLinked:                  "Link at least one parent account",
  paymentSetupReviewed:           "Record a payment submission",
  operationalSetupComplete:       "Mark setup as complete",
};

// ── Branding permissions ───────────────────────────────────────────────────

export const BRANDING_VIEW_PERMISSION             = "BRANDING_VIEW";
export const BRANDING_MANAGE_PERMISSION           = "BRANDING_MANAGE";
export const BRANDING_UPLOAD_LOGO_PERMISSION      = "BRANDING_UPLOAD_LOGO";
export const BRANDING_UPDATE_THEME_PERMISSION     = "BRANDING_UPDATE_THEME";
export const BRANDING_RESET_DEFAULT_PERMISSION    = "BRANDING_RESET_DEFAULT";

export const BRANDING_PERMISSIONS = [
  BRANDING_VIEW_PERMISSION,
  BRANDING_MANAGE_PERMISSION,
  BRANDING_UPLOAD_LOGO_PERMISSION,
  BRANDING_UPDATE_THEME_PERMISSION,
  BRANDING_RESET_DEFAULT_PERMISSION,
] as const;

// ── Context routing ────────────────────────────────────────────────────────

export const CONTEXT_DEFAULT_PATHS: Record<string, string> = {
  owner:          "/admin/owner",
  platform_admin: "/admin/owner",
  school_admin:   "/admin",
  admin:          "/admin",
  teacher:        "/teacher",
  parent:         "/parent",
  finance:        "/finance",
  it_personnel:   "/admin/website",
};
