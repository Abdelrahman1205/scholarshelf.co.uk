# Admin RBAC + Parent Visibility Note

## Problem Snapshot
- Parent accounts were not visible in the admin user workflow after strict school filtering because many parent accounts use school links (via child linking/payment data) rather than direct `users.schoolId`.
- Admin navigation lacked a dedicated Parents management view.
- User edit flow allowed dangerous role transitions (including self-role changes), creating a privilege and lockout risk.

## Fix Direction
- Treat school-linked parents as in-scope for school admins.
- Add dedicated admin parents endpoint and page.
- Enforce role-change restrictions in backend and remove unsafe role editing controls in admin UI.
