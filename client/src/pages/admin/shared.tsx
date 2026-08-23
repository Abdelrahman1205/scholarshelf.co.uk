import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime as sharedFormatDateTime } from "@/lib/format";

// ─── NAVIGATION HELPER ─────────────────────────────────────────────────────
export function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Safely format school display text — never expose raw UUIDs */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function formatSchoolDisplay(item: { schoolCode?: string | null; schoolName?: string | null; schoolId?: string | null }): string {
  const code = item.schoolCode;
  const name = item.schoolName;
  if (code && !UUID_RE.test(code)) {
    return `${name && !UUID_RE.test(name) ? name : "School"} (${code})`;
  }
  if (name && !UUID_RE.test(name)) return name;
  return "Not available";
}


// ─── SHARED UTILITIES ──────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    pending: { class: "bg-amber-100 text-amber-700 border-amber-200", label: "Pending" },
    awaiting_reference: { class: "bg-amber-100 text-amber-700 border-amber-200", label: "Awaiting Reference" },
    reference_submitted: { class: "bg-blue-100 text-blue-700 border-blue-200", label: "Reference Submitted" },
    confirmed: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Payment Confirmed" },
    completed: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Completed" },
    ready_for_collection: { class: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "Ready for Collection" },
    collected: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Collected" },
    cancelled: { class: "bg-gray-100 text-gray-500 border-gray-200", label: "Cancelled" },
    rejected: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    failed: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    needs_review: { class: "bg-orange-100 text-orange-700 border-orange-200", label: "Needs Review" },
    approved: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Approved" },
    allocated: { class: "bg-blue-100 text-blue-700 border-blue-200", label: "Allocated" },
    received: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Received" },
    absent: { class: "bg-gray-100 text-gray-700 border-gray-200", label: "Absent" },
  };
  const c = config[status] || { class: "bg-gray-100 text-gray-700", label: status };
  return <Badge variant="outline" className={`${c.class} text-xs font-medium`}>{c.label}</Badge>;
}

/**
 * Kept as an export because communications.tsx and parents.tsx import it from
 * here. The implementation now delegates so every screen shares one locale —
 * this used to call toLocaleString() with no locale, rendering in whatever the
 * viewer's browser was set to.
 */
export function formatDateTime(value: string | null | undefined) {
  return sharedFormatDateTime(value, "Not available");
}

export function normalizeRole(role: string | null | undefined) {
  if (!role) return "unknown";
  if (role === "admin") return "school_admin";
  if (role === "owner" || role === "platform_admin" || role === "platform_owner") return "platform_owner";
  return role;
}

export function roleLabel(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  if (normalized === "platform_owner") return "Platform Owner";
  if (normalized === "school_admin") return "School Admin";
  if (normalized === "teacher") return "Teacher";
  if (normalized === "parent") return "Parent";
  return normalized.replace(/_/g, " ");
}

export function isProtectedPlatformOwner(role: string | null | undefined) {
  return normalizeRole(role) === "platform_owner";
}

export const BRANDING_PERMISSION_OPTIONS = [
  { key: "BRANDING_VIEW", label: "View branding" },
  { key: "BRANDING_MANAGE", label: "Manage branding" },
  { key: "BRANDING_UPLOAD_LOGO", label: "Upload logo" },
  { key: "BRANDING_UPDATE_THEME", label: "Update theme" },
  { key: "BRANDING_RESET_DEFAULT", label: "Reset defaults" },
];

