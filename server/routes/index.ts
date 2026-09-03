/**
 * server/routes/index.ts
 *
 * Registers all API route domains onto the Express app.
 * Each domain is isolated in its own file under server/routes/.
 *
 * Routes are registered in the same order as the original routes.ts
 * to preserve Express route-matching precedence.
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerMfaRoutes } from "./mfa.routes.js";
import { registerCronRoutes } from "./cron.routes.js";
import { registerSetupRoutes } from "./setup.routes.js";
import { registerBookRoutes } from "./book.routes.js";
import { registerStudentRoutes } from "./student.routes.js";
import { registerParentRoutes } from "./parent.routes.js";
import { registerPaymentRoutes } from "./payment.routes.js";
import { registerAllocationRoutes } from "./allocation.routes.js";
import { registerUserRoutes } from "./user.routes.js";
import { registerMessageRoutes } from "./message.routes.js";
import { registerNotificationRoutes } from "./notification.routes.js";
import { registerOwnerRoutes } from "./owner.routes.js";
import { registerDashboardRoutes } from "./dashboard.routes.js";
// Legacy family.routes.ts (registerFamilyRoutes) was removed — its
// /api/admin/families/* endpoints had zero frontend consumers after the
// family-first refactor migrated to /api/families/* in family-enrollment.routes.ts.
import { registerFamilyEnrollmentRoutes } from "./family-enrollment.routes.js";
import { registerPublicRoutes } from "./public.routes.js";
import { registerWebsiteRoutes } from "./website.routes.js";
import { registerDbConsoleRoutes } from "./db-console.routes.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Public — unauthenticated school landing page API
  registerPublicRoutes(app);

  // Owner DB Console — database admin panel (owner only)
  registerDbConsoleRoutes(app);

  // Auth — login, register, invite acceptance, password reset, /me
  registerAuthRoutes(app);
  registerMfaRoutes(app);
  registerCronRoutes(app);

  // Admin setup checklist + school branding (public + admin + owner)
  registerSetupRoutes(app);

  // School public-website CMS (IT personnel + school admin)
  registerWebsiteRoutes(app);

  // Books, classes, students, book levels, class-book-level assignments
  registerBookRoutes(app);

  // Linking codes + student bulk import
  registerStudentRoutes(app);

  // Parent portal: link children, baskets, payments, messages
  registerParentRoutes(app);

  // Finance: payment confirmation, rejection, review
  registerPaymentRoutes(app);

  // Allocations + teacher book distribution + extra-copy requests
  registerAllocationRoutes(app);

  // Users, admin user management, invites
  registerUserRoutes(app);

  // Messaging (parent ↔ teacher) + payment webhook
  registerMessageRoutes(app);

  // Notifications summary + admin communications view
  registerNotificationRoutes(app);

  // Family-first enrollment (households, guardians, students)
  registerFamilyEnrollmentRoutes(app);

  // Owner: support mode, school lifecycle, owner invites, pending setups
  registerOwnerRoutes(app);

  // Admin dashboards, reports, and API catch-all
  registerDashboardRoutes(app);

  return httpServer;
}
