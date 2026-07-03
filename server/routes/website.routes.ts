/**
 * server/routes/website.routes.ts
 *
 * School public-website CMS. IT personnel (and school admins) manage the
 * content sections rendered on the public /school/:code page — no code needed.
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import {
  requireRole, sessionSchoolId, auditLog, routeParam,
  PLATFORM_OWNER_ROLES,
} from "../middleware/auth.js";
import { websiteSectionInputSchema } from "../../shared/schema.js";

const WEBSITE_MANAGER_ROLES = ["admin", "school_admin", "it_personnel", ...PLATFORM_OWNER_ROLES] as const;

export function registerWebsiteRoutes(app: Express): void {
  // List all sections (drafts included) for the manager UI
  app.get("/api/website/sections", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const sections = await storage.getWebsiteSections(sid);
      res.json(sections);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/website/sections", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const parsed = websiteSectionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }
      const section = await storage.createWebsiteSection({
        ...parsed.data,
        schoolId: sid,
        updatedBy: req.session.userId ?? null,
      });
      await auditLog(req, "website_section_created", `section:${section.id}`, { title: section.title, type: section.type });
      res.status(201).json(section);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/website/sections/:id", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const parsed = websiteSectionInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }
      const section = await storage.updateWebsiteSection(routeParam(req.params.id), sid, {
        ...parsed.data,
        updatedBy: req.session.userId ?? null,
      });
      await auditLog(req, "website_section_updated", `section:${section.id}`);
      res.json(section);
    } catch (e: any) {
      const status = e.message === "Section not found" ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  app.delete("/api/website/sections/:id", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      await storage.deleteWebsiteSection(routeParam(req.params.id), sid);
      await auditLog(req, "website_section_deleted", `section:${routeParam(req.params.id)}`);
      res.json({ success: true });
    } catch (e: any) {
      const status = e.message === "Section not found" ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  app.post("/api/website/sections/:id/move", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const direction = req.body?.direction === "up" ? "up" : "down";
      await storage.moveWebsiteSection(routeParam(req.params.id), sid, direction);
      res.json({ success: true });
    } catch (e: any) {
      const status = e.message === "Section not found" ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });
}
