/**
 * shared/contexts.ts
 *
 * Human labels for the role contexts a user can hold.
 *
 * A "context" is the role a session is currently acting as. Most accounts have
 * exactly one; an account holding `SECONDARY_ROLE:*` grants — a teacher who is
 * also a parent at the school — has several and can switch between them. The
 * switch is authorised server-side in `getUserAccessProfile()`; this file only
 * supplies the words shown next to it.
 */
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
};

export function contextLabel(key: string): string {
  return CONTEXT_LABELS[key]
    || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}
