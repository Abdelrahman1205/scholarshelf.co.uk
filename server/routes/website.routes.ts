/**
 * server/routes/website.routes.ts
 *
 * School public-website CMS. IT personnel (and school admins) manage the
 * content sections rendered on the public /school/:code page — no code needed.
 */
import type { Express } from "express";
import multer from "multer";
import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage.js";
import { getDb } from "../config/database.js";
import {
  requireRole, sessionSchoolId, auditLog, routeParam,
  PLATFORM_OWNER_ROLES,
} from "../middleware/auth.js";
import { websiteSectionInputSchema, mediaAssets } from "../../shared/schema.js";

const WEBSITE_MANAGER_ROLES = ["admin", "school_admin", "it_personnel", ...PLATFORM_OWNER_ROLES] as const;

// Media library uploads — images and PDFs, up to 8 MB, buffered in memory then
// stored as a base64 data URI (same approach as branding assets).
const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const MEDIA_ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/pdf",
]);
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MEDIA_ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, SVG, PDF."));
  },
});
function mediaKind(mime: string): "image" | "document" | "video" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

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

  // ═══ MEDIA LIBRARY ════════════════════════════════════════════
  // Gallery of uploaded assets (images / PDFs) for the school website & CMS.
  app.get("/api/media", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const rows = await getDb()
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.schoolId, sid))
        .orderBy(desc(mediaAssets.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/media", requireRole(...WEBSITE_MANAGER_ROLES), (req, res) => {
    mediaUpload.single("file")(req as any, res as any, async (err: unknown) => {
      try {
        if (err) return res.status(400).json({ message: (err as Error).message || "Upload failed" });
        const sid = sessionSchoolId(req);
        if (!sid) return res.status(400).json({ message: "School context required" });
        const file = (req as any).file as { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined;
        if (!file) return res.status(400).json({ message: "No file provided" });
        const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        const [asset] = await getDb()
          .insert(mediaAssets)
          .values({
            schoolId: sid,
            fileName: file.originalname.slice(0, 255),
            mimeType: file.mimetype,
            kind: mediaKind(file.mimetype),
            sizeBytes: file.size,
            dataUri,
            title: rawTitle ? rawTitle.slice(0, 200) : null,
            uploadedBy: req.session.userId ?? null,
          })
          .returning();
        await auditLog(req, "media_asset_uploaded", `media:${asset.id}`, { fileName: asset.fileName, kind: asset.kind });
        res.status(201).json(asset);
      } catch (e: any) {
        res.status(400).json({ message: e.message });
      }
    });
  });

  app.patch("/api/media/:id", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const patch: { title?: string | null; caption?: string | null } = {};
      if (req.body && "title" in req.body) patch.title = req.body.title ? String(req.body.title).slice(0, 200) : null;
      if (req.body && "caption" in req.body) patch.caption = req.body.caption ? String(req.body.caption).slice(0, 500) : null;
      const [asset] = await getDb()
        .update(mediaAssets)
        .set(patch)
        .where(and(eq(mediaAssets.id, routeParam(req.params.id)), eq(mediaAssets.schoolId, sid)))
        .returning();
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      res.json(asset);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/media/:id", requireRole(...WEBSITE_MANAGER_ROLES), async (req, res) => {
    try {
      const sid = sessionSchoolId(req);
      if (!sid) return res.status(400).json({ message: "School context required" });
      const [asset] = await getDb()
        .delete(mediaAssets)
        .where(and(eq(mediaAssets.id, routeParam(req.params.id)), eq(mediaAssets.schoolId, sid)))
        .returning();
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      await auditLog(req, "media_asset_deleted", `media:${asset.id}`, { fileName: asset.fileName });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });
}
