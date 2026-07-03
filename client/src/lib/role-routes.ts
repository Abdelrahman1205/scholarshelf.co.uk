/**
 * Maps an authenticated user's active role to its default frontend route.
 * Single source of truth — imported by App.tsx, login.tsx, and accept-invite.tsx.
 *
 * accept-invite uses a slightly different mapping for school_admin (→ /admin/setup
 * instead of /admin) because new admins must complete onboarding first.
 */
export function getRoleRoute(role: string, opts?: { isNewAccount?: boolean }): string {
  switch (role) {
    case "owner":
    case "platform_admin":
      return "/admin/owner";
    case "school_admin":
      // New school admins land on the setup wizard; existing ones on the dashboard
      return opts?.isNewAccount ? "/admin/setup" : "/admin";
    case "admin":
      return "/admin";
    case "it_personnel":
      return "/admin/website";
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "finance":
      return "/finance";
    default:
      return "/login";
  }
}
