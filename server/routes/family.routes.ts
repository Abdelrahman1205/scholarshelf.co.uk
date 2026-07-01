/**
 * server/routes/family.routes.ts
 *
 * Family group management — admin CRUD + family link code generation.
 * Spec §5.3 Priority 3: Family groups + family link codes.
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import {
  requireRole, sessionSchoolId, auditLog, routeParam, generateLinkingCode,
  ADMIN_UI_ROLES,
} from "../middleware/auth.js";

export function registerFamilyRoutes(app: Express): void {
  // GET /api/admin/families — list all families for the school
  app.get("/api/admin/families", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const families = await storage.getFamilies(sid);
      res.json(families);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/admin/families/:id — get a single family with members
  app.get("/api/admin/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const family = await storage.getFamilyById(routeParam(req.params.id));
      if (!family) return res.status(404).json({ message: "Family not found" });
      res.json(family);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/families — create a new family
  app.post("/api/admin/families", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Family name is required" });
      const family = await storage.createFamily({ name: name.trim(), schoolId: sid });
      res.status(201).json(family);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // PATCH /api/admin/families/:id — rename a family
  app.patch("/api/admin/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const { name } = req.body;
      const updated = await storage.updateFamily(id, { name: name?.trim() });
      if (!updated) return res.status(404).json({ message: "Family not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // DELETE /api/admin/families/:id — delete a family
  app.delete("/api/admin/families/:id", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      await storage.deleteFamily(routeParam(req.params.id));
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/admin/families/:id/students/:studentId — add student to family
  app.put("/api/admin/families/:id/students/:studentId", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const familyId = routeParam(req.params.id);
      const studentId = routeParam(req.params.studentId);
      await storage.addStudentToFamily(familyId, studentId);
      const family = await storage.getFamilyById(familyId);
      res.json(family);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // DELETE /api/admin/families/:id/students/:studentId — remove student from family
  app.delete("/api/admin/families/:id/students/:studentId", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      await storage.removeStudentFromFamily(routeParam(req.params.id), routeParam(req.params.studentId));
      res.status(204).send();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/families/:id/link-code — generate a family linking code
  app.post("/api/admin/families/:id/link-code", requireRole(...ADMIN_UI_ROLES), async (req, res) => {
    try {
      const familyId = routeParam(req.params.id);
      const sid = sessionSchoolId(req);

      const family = await storage.getFamilyById(familyId);
      if (!family) return res.status(404).json({ message: "Family not found" });
      if (!family.students || family.students.length === 0) {
        return res.status(400).json({ message: "Family has no students. Add students before generating a code." });
      }

      const { parentEmail, expiresInDays } = req.body;
      if (!parentEmail?.trim()) return res.status(400).json({ message: "Parent email is required" });

      const code = generateLinkingCode();
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 86400_000)
        : new Date(Date.now() + 30 * 86400_000); // default 30 days

      const linkingCode = await storage.createLinkingCode({
        studentId: null as any, // family code — no single studentId
        familyId,
        code,
        parentEmail: parentEmail.trim().toLowerCase(),
        expiresAt,
        schoolId: sid,
      });

      await auditLog(req, "family_link_code_generated", `family:${familyId} code:${code}`);

      res.status(201).json({ ...linkingCode, familyName: family.name, studentCount: family.students.length });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });
}
