/**
 * server/routes/user.routes.ts
 *
 * Route handlers: user domain.
 * Extracted from routes.ts monolith.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import {
  requireAuth, requireRole,
  sessionSchoolId, isInSupportMode, isPlatformOwnerRequest, isPlatformOwnerRole,
  getActiveRequestContext, resolveRole,
  auditLog, rateLimit,
  routeParam, normalizeEmail, normalizeSchoolCode, extractSupportReason,
  PLATFORM_OWNER_ROLES, ADMIN_UI_ROLES, FINANCE_ROLES,
  BRANDING_VIEW_PERMISSION, BRANDING_MANAGE_PERMISSION,
  BRANDING_UPLOAD_LOGO_PERMISSION, BRANDING_UPDATE_THEME_PERMISSION, BRANDING_RESET_DEFAULT_PERMISSION,
  COMPLETE_SETUP_STATUSES, CONTEXT_DEFAULT_PATHS,
  safeUser, buildAuthUserResponse, syncSessionActiveContext, getUserAccessProfile,
  getPublicBaseUrl, toEmailSafeLogoUrl, parseDataUriImage, getEmailBrandingForSchool,
  splitInviteToken, resolveInviteByToken, acceptInviteToken,
  generateLinkingCode, generatePaymentReference,
  roleBadge, formatUserForAdmin,
  getScopedAdminUsers, canManageUser, enforceRoleUpdateGuards,
  getSchoolSetupState, setupMilestonesFromState, deriveInviteStatus, nextOwnerAction,
  normalizeSchoolSetupStatus, SCHOOL_SETUP_STEP_LABELS,
  brandingUpload, runSingleBrandingUpload,
  canViewBranding, canManageBranding, canManageBrandingOperation, resolveTenantBranding,
  getBrandingPermissionSet,
} from "../middleware/auth.js";

import bcrypt from "bcryptjs";
import {
  sendInviteEmail, sendParentCodeEmail, isResendConfigured,
} from "../email.js";
import { BRANDING_PERMISSIONS } from "../../shared/schema.js";

export function registerUserRoutes(app: Express): void {
  // === USERS (admin-scoped; includes school-linked parents) ===
  const listAdminUsers = async (req: Request, res: Response) => {
    try {
      const [users, schools] = await Promise.all([
        getScopedAdminUsers(req),
        storage.getSchools(),
      ]);
      const parentChildrenCount = new Map<string, number>();
      const brandingPermissionMap = new Map<string, string[]>();
      const schoolsById = new Map<string, { name: string; code: string }>(
        schools.map((school) => [school.id, { name: school.name, code: school.code }]),
      );

      // For users whose school is not in the bulk list, try individual lookup
      const missingSchoolIds = new Set<string>();
      for (const u of users) {
        if (u.schoolId && !schoolsById.has(u.schoolId)) {
          missingSchoolIds.add(u.schoolId);
        }
      }
      await Promise.all(Array.from(missingSchoolIds).map(async (sid) => {
        try {
          const school = await storage.getSchoolById(sid);
          if (school) schoolsById.set(school.id, { name: school.name, code: school.code });
        } catch { /* ignore lookup failures */ }
      }));

      await Promise.all(users.map(async (user) => {
        if (resolveRole(user.role) !== "parent" || !user.email) return;
        const sid = sessionSchoolId(req);
        const children = await storage.getParentChildren(user.email);
        const scopedChildren = sid ? children.filter((child) => child.student?.schoolId === sid) : children;
        parentChildrenCount.set(user.id, scopedChildren.length);
      }));

      await Promise.all(users.map(async (user) => {
        if (resolveRole(user.role) !== "it_personnel") return;
        const permissions = await storage.getUserPermissions(user.id);
        brandingPermissionMap.set(user.id, permissions.filter((permission) => BRANDING_PERMISSIONS.includes(permission as any)));
      }));

      const payload = users.map((u) => {
        const school = u.schoolId ? schoolsById.get(u.schoolId) : undefined;
        return formatUserForAdmin(u, {
          schoolName: school?.name || null,
          schoolCode: school?.code || null,
          linkedChildrenCount: parentChildrenCount.get(u.id) ?? 0,
          brandingPermissions: brandingPermissionMap.get(u.id) || [],
        });
      });
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load users" });
    }
  };

  app.get("/api/users", requireRole(...ADMIN_UI_ROLES), listAdminUsers);
  app.get("/api/admin/users", requireRole(...ADMIN_UI_ROLES), listAdminUsers);

  app.get("/api/admin/parents", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const requestedSchoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : null;
      const sid = isPlatformOwnerRequest(req) ? requestedSchoolId : sessionSchoolId(req);
      const [users, schools] = await Promise.all([
        getScopedAdminUsers(req),
        storage.getSchools(),
      ]);
      const schoolsById = new Map<string, { name: string; code: string }>(
        schools.map((school) => [school.id, { name: school.name, code: school.code }]),
      );
      const parents = users.filter((u) => resolveRole(u.role) === "parent" && !!u.email);
      const linkingCodes = sid ? await storage.getLinkingCodes(sid) : await storage.getLinkingCodes();

      const payload = await Promise.all(parents.map(async (parent) => {
        const links = await storage.getParentChildren(parent.email);
        const scopedLinks = sid ? links.filter((link) => link.student?.schoolId === sid) : links;
        const baskets = await storage.getBaskets(parent.email, sid);
        const payments = await storage.getPayments(parent.email, sid);
        const parentCodes = linkingCodes.filter((code) => normalizeEmail(code.parentEmail) === normalizeEmail(parent.email));

        const linkedStudents = scopedLinks.map((link) => ({
          id: link.student?.id,
          name: link.student?.name,
          className: link.student?.class?.name || null,
        })).filter((s) => !!s.id);

        const resolvedSchoolId = parent.schoolId || scopedLinks[0]?.student?.schoolId || null;
        let resolvedSchool = resolvedSchoolId ? schoolsById.get(resolvedSchoolId) : undefined;
        // Fallback: try individual lookup if not found in bulk list
        if (!resolvedSchool && resolvedSchoolId) {
          try {
            const school = await storage.getSchoolById(resolvedSchoolId);
            if (school) {
              resolvedSchool = { name: school.name, code: school.code };
              schoolsById.set(school.id, resolvedSchool);
            }
          } catch { /* ignore lookup failures */ }
        }

        return formatUserForAdmin(parent, {
          schoolName: resolvedSchool?.name || null,
          schoolCode: resolvedSchool?.code || null,
          linkedChildrenCount: scopedLinks.length,
          linkedStudents,
          linkingCodesIssued: parentCodes.length,
          linkingCodesUsed: parentCodes.filter((c) => c.isUsed).length,
          basketsCount: baskets.length,
          activeBasketsCount: baskets.filter((b) => b.status === "pending").length,
          unpaidBasketsCount: baskets.filter((b) => b.status === "pending").length,
          paidAwaitingCollectionCount: baskets.filter((b) => b.status === "allocated").length,
          paymentsCount: payments.length,
          completedPaymentsCount: payments.filter((p) => p.status === "completed").length,
          lastPaymentAt: payments[0]?.paidAt || null,
          parentStatus: parent.status || "unknown",
          signupStatus: parent.status === "invited" ? "Invite pending" : parent.status === "active" ? "Completed" : "Not available",
          collectionStatus: "Not available",
        });
      }));

      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to load parents" });
    }
  });

  app.post("/api/users", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { username, password, name, role, email, brandingPermissions } = req.body;
      if (!username || !password || !name || !role) {
        return res.status(400).json({ message: "Username, password, name, and role are required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const normalizedRole = resolveRole(role);
      if (isPlatformOwnerRole(normalizedRole)) {
        return res.status(403).json({ message: "Platform owner accounts cannot be created from this endpoint." });
      }

      if (!isPlatformOwnerRequest(req) && !["school_admin", "teacher", "finance", "it_personnel", "student", "parent"].includes(normalizedRole)) {
        return res.status(403).json({ message: "Role is not allowed for school-level administrators." });
      }

      // Duplicate email detection: if email already exists with a compatible role, suggest merging
      if (email) {
        const emailUser = await storage.getUserByEmail(email.toLowerCase().trim());
        if (emailUser) {
          const existingRole = resolveRole(emailUser.role);
          const secondaryRoles = await storage.getSecondaryRoles(emailUser.id);
          const allRoles = [existingRole, ...secondaryRoles];
          if (!allRoles.includes(normalizedRole as any)) {
            const canMerge =
              (normalizedRole === "teacher" && allRoles.includes("parent")) ||
              (normalizedRole === "parent" && allRoles.includes("teacher")) ||
              (normalizedRole === "teacher" && existingRole === "parent") ||
              (normalizedRole === "parent" && existingRole === "teacher");
            if (canMerge) {
              return res.status(409).json({
                message: `An account with email ${email} already exists as ${existingRole}. Add ${normalizedRole} role to this account?`,
                existingUserId: emailUser.id,
                existingUserName: emailUser.name,
                existingRole,
                suggestedAction: "merge_role",
              });
            }
          }
        }
      }

      const hash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, passwordHash: hash, name, role: normalizedRole, email, status: "active", schoolId: sid });
      if (normalizedRole === "it_personnel" && Array.isArray(brandingPermissions)) {
        const scoped = brandingPermissions.filter((permission: string) => BRANDING_PERMISSIONS.includes(permission as any));
        await storage.setUserPermissions(user.id, scoped);
      }
      const { passwordHash: _ph, ...safeUserData } = user;
      res.status(201).json({ ...safeUserData, brandingPermissions: normalizedRole === "it_personnel" ? await storage.getUserPermissions(user.id) : [] });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  const updateAdminUser = async (req: Request, res: Response) => {
    try {
      const targetUser = await storage.getUserById(routeParam(req.params.id));
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      if (!(await canManageUser(req, targetUser))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const guardMessage = enforceRoleUpdateGuards(req, targetUser, req.body?.role);
      if (guardMessage) {
        return res.status(403).json({ message: guardMessage });
      }

      const { password, brandingPermissions, ...rest } = req.body;
      const updates: any = { ...rest };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 12);
      }

      if (updates.role) {
        updates.role = resolveRole(updates.role);
      }

      const user = await storage.updateUser(routeParam(req.params.id), updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      const targetRole = resolveRole(user.role);
      if (targetRole === "it_personnel" && Array.isArray(brandingPermissions)) {
        const scoped = brandingPermissions.filter((permission: string) => BRANDING_PERMISSIONS.includes(permission as any));
        await storage.setUserPermissions(user.id, scoped);
      }
      const effectivePermissions = targetRole === "it_personnel" ? await storage.getUserPermissions(user.id) : [];
      res.json(formatUserForAdmin(user, { brandingPermissions: effectivePermissions }));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  app.patch("/api/users/:id", requireRole(...ADMIN_UI_ROLES), updateAdminUser);
  app.patch("/api/admin/users/:id", requireRole(...ADMIN_UI_ROLES), updateAdminUser);

  const deleteAdminUser = async (req: Request, res: Response) => {
    const targetUser = await storage.getUserById(routeParam(req.params.id));
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const targetRole = resolveRole(targetUser.role);
    const ownerCanDeleteAdminAnywhere =
      isPlatformOwnerRequest(req) && ["admin", "school_admin", "platform_admin", "owner"].includes(targetRole);

    if (isPlatformOwnerRequest(req) && !ownerCanDeleteAdminAnywhere && !isInSupportMode(req)) {
      return res.status(403).json({
        message: "Owner user management is only allowed inside Support Mode for a selected school.",
      });
    }

    if (!ownerCanDeleteAdminAnywhere && !(await canManageUser(req, targetUser))) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.session.userId === targetUser.id) {
      return res.status(403).json({ message: "You cannot delete your own account." });
    }

    if (isPlatformOwnerRole(targetUser.role)) {
      return res.status(403).json({ message: "Platform owner accounts cannot be deleted from the standard dashboard workflow." });
    }

    if (["admin", "school_admin", "platform_admin", "owner"].includes(targetRole) && !isPlatformOwnerRequest(req)) {
      return res.status(403).json({ message: "Deleting admin-level users is restricted." });
    }

    await storage.deleteUser(routeParam(req.params.id));
    res.status(204).send();
  };

  app.delete("/api/users/:id", requireRole(...ADMIN_UI_ROLES), deleteAdminUser);
  app.delete("/api/admin/users/:id", requireRole(...ADMIN_UI_ROLES), deleteAdminUser);

  // === MULTI-ROLE USER MANAGEMENT ===

  // GET /api/admin/users/:userId — full user detail with roles, profiles, links, classes
  app.get("/api/admin/users/:userId", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      if (!(await canManageUser(req, { id: userId, schoolId: sid, role: "" }))) {
        // Fallback: just get the user and check school
        const u = await storage.getUserById(userId);
        if (!u || u.schoolId !== sid) return res.status(404).json({ message: "User not found" });
      }
      const detail = await storage.getUserWithDetail(userId, sid);
      if (!detail) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = detail;
      res.json(safe);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/admin/students/search — search students for the admin's school
  app.get("/api/admin/students/search", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const results = await storage.searchStudentsForAdmin(q, sid);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/roles/parent — add parent role to an existing user
  app.post("/api/admin/users/:userId/roles/parent", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { relationship, studentId } = req.body as { relationship?: string; studentId?: string };

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (!targetUser.email) return res.status(400).json({ message: "User must have an email address to receive a parent role" });

      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);

      if (primaryRole === "parent" || secondaryRoles.includes("parent")) {
        return res.status(409).json({ message: "User already has the parent role" });
      }

      // Add secondary role
      await storage.addSecondaryRole(userId, "parent");

      // If a student was specified, create the link immediately
      let linkResult: any = null;
      if (studentId) {
        const validStudent = await storage.getStudentById(studentId, sid);
        if (!validStudent) return res.status(400).json({ message: "Student not found in this school" });

        linkResult = await storage.addParentStudentLink({
          parentIdentifier: targetUser.email!,
          studentId,
          relationship: relationship || undefined,
          addedByAdminId: req.session.userId,
          schoolId: sid,
        });
      }

      await storage.createAuditLog({
        action: "USER_ROLE_ADDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role: "parent", addedTo: targetUser.username, schoolId: sid }),
      });
      if (studentId && linkResult) {
        await storage.createAuditLog({
          action: "ADMIN_LINKED_TEACHER_AS_PARENT",
          userId: req.session.userId!,
          target: `user:${userId}`,
          metadata: JSON.stringify({ studentId, relationship, schoolId: sid }),
        });
      }

      const detail = await storage.getUserWithDetail(userId, sid);
      const { passwordHash: _ph, ...safe } = detail;
      res.json({ message: "Parent role added successfully", user: safe, link: linkResult });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/roles/teacher — add teacher role to an existing user
  app.post("/api/admin/users/:userId/roles/teacher", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { department, subjects, classIds } = req.body as {
        department?: string;
        subjects?: string[];
        classIds?: string[];
      };

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);

      if (primaryRole === "teacher" || secondaryRoles.includes("teacher")) {
        return res.status(409).json({ message: "User already has the teacher role" });
      }

      // Add secondary role
      await storage.addSecondaryRole(userId, "teacher");

      // Create teacher profile
      await storage.upsertTeacherProfile({
        userId,
        schoolId: sid,
        department: department || null,
        subjects: subjects ? JSON.stringify(subjects) : null,
        createdByAdminId: req.session.userId,
      });

      // Assign to specified classes
      if (classIds && classIds.length > 0) {
        const allClasses = await storage.getClasses(sid);
        for (const classId of classIds) {
          const cls = allClasses.find((c) => c.id === classId);
          if (cls && cls.schoolId === sid) {
            await storage.updateClass(classId, { teacherId: userId });
          }
        }
      }

      await storage.createAuditLog({
        action: "USER_ROLE_ADDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role: "teacher", addedTo: targetUser.username, department, schoolId: sid }),
      });
      await storage.createAuditLog({
        action: "TEACHER_PROFILE_CREATED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ department, subjects, schoolId: sid }),
      });

      const detail = await storage.getUserWithDetail(userId, sid);
      const { passwordHash: _ph, ...safe } = detail;
      res.json({ message: "Teacher role added successfully", user: safe });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/link-child — link a child to an existing parent/multi-role user
  app.post("/api/admin/users/:userId/link-child", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const { studentId, relationship } = req.body as { studentId: string; relationship?: string };
      if (!studentId) return res.status(400).json({ message: "studentId is required" });

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (!targetUser.email) return res.status(400).json({ message: "User must have an email to be linked to a student" });

      // Verify user has parent role (primary or secondary)
      const primaryRole = resolveRole(targetUser.role);
      const secondaryRoles = await storage.getSecondaryRoles(userId);
      if (primaryRole !== "parent" && !secondaryRoles.includes("parent")) {
        return res.status(400).json({ message: "User does not have a parent role. Add parent role first." });
      }

      // Verify student belongs to this school
      const students = await storage.getStudents(sid);
      const validStudent = students.find((s) => s.id === studentId);
      if (!validStudent) return res.status(400).json({ message: "Student not found in this school" });

      const link = await storage.addParentStudentLink({
        parentIdentifier: targetUser.email!,
        studentId,
        relationship: relationship || undefined,
        addedByAdminId: req.session.userId,
        schoolId: sid,
      });

      await storage.createAuditLog({
        action: "PARENT_STUDENT_LINK_CREATED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ studentId, relationship, alreadyLinked: link.alreadyLinked, schoolId: sid }),
      });

      if (link.alreadyLinked) {
        return res.status(200).json({ message: "Child was already linked to this parent", link });
      }
      res.status(201).json({ message: "Child linked successfully", link });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/admin/users/:userId/roles/:role — remove a secondary role
  app.delete("/api/admin/users/:userId/roles/:role", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);
      const role = req.params.role as string;

      if (!["parent", "teacher"].includes(role)) {
        return res.status(400).json({ message: "Only parent and teacher secondary roles can be removed" });
      }

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const secondaryRoles = await storage.getSecondaryRoles(userId);
      if (!secondaryRoles.includes(role)) {
        return res.status(404).json({ message: `User does not have ${role} as a secondary role` });
      }

      await storage.removeSecondaryRole(userId, role);

      await storage.createAuditLog({
        action: "USER_ROLE_REMOVED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ role, removedFrom: targetUser.username, schoolId: sid }),
      });

      res.json({ message: `${role} role removed successfully` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/suspend — suspend a user
  app.post("/api/admin/users/:userId/suspend", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });
      if (req.session.userId === userId) return res.status(403).json({ message: "You cannot suspend your own account" });

      const updated = await storage.updateUser(userId, { status: "disabled" });
      await storage.createAuditLog({
        action: "USER_SUSPENDED",
        userId: req.session.userId!,
        target: `user:${userId}`,
        metadata: JSON.stringify({ username: targetUser.username, schoolId: sid }),
      });
      res.json({ message: "User suspended", user: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/users/:userId/reactivate — reactivate a suspended user
  app.post("/api/admin/users/:userId/reactivate", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const userId = routeParam(req.params.userId);

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.schoolId !== sid) return res.status(403).json({ message: "User belongs to a different school" });

      const updated = await storage.updateUser(userId, { status: "active" });
      res.json({ message: "User reactivated", user: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === INVITE MANAGEMENT (admin only, school-scoped) ===
  app.post("/api/invites", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      const normalizedRole = resolveRole(role);
      if (!USER_ROLES.includes(normalizedRole as any) || normalizedRole === "parent") {
        return res.status(400).json({ message: "Invalid role for invite. Parents self-register." });
      }

      if (isPlatformOwnerRole(normalizedRole)) {
        return res.status(403).json({ message: "Platform owner invites are blocked from this workflow." });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }

      const existingInvite = await storage.getPendingInviteByEmail(email);
      if (existingInvite) {
        return res.status(409).json({ message: "A pending invite for this email already exists" });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      const invite = await storage.createInvite({
        email,
        role: normalizedRole,
        schoolId: sid,
        tokenHash,
        invitedBy: req.session.userId!,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const inviteLink = `${getPublicBaseUrl(req)}/accept-invite/${invite.id}.${rawToken}`;
      const sent = await sendInviteEmail(email, normalizedRole, inviteLink, await getEmailBrandingForSchool(req, sid));
      if (!sent) {
        console.log(`[INVITE] Link for ${email} (${role}): ${inviteLink}`);
        if (!isResendConfigured()) {
          console.warn("[Resend] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; using log fallback for invite links.");
        }
      }

      await auditLog(req, "invite_created", `invite:${invite.id}`, { email, role: normalizedRole });

      res.status(201).json({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        inviteLink: process.env.NODE_ENV !== "production" ? inviteLink : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // === EXTERNAL PAYMENT WEBHOOK ===
}
