/**
 * server/routes/public.routes.ts
 *
 * Unauthenticated public endpoints — no requireAuth middleware.
 * Currently exposes: GET /api/public/schools/:code
 */
import type { Express } from "express";
import { storage } from "../storage.js";

export function registerPublicRoutes(app: Express): void {
  /**
   * GET /api/public/schools/:code
   * Returns a school's public profile (name, contact, branding).
   * No auth required — used by the /school/:code landing page.
   */
  app.get("/api/public/schools/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const school = await storage.getSchoolByCode(code.toUpperCase());

      if (!school || school.isDeleted || school.status !== "active") {
        return res.status(404).json({ message: "School not found" });
      }

      const branding = await storage.getSchoolBranding(school.id);

      return res.json({
        id: school.id,
        name: school.name,
        code: school.code,
        address: school.address ?? null,
        contactEmail: school.contactEmail ?? null,
        contactPhone: school.contactPhone ?? null,
        branding: branding
          ? {
              logoUrl: branding.logoUrl ?? null,
              bannerImageUrl: branding.bannerImageUrl ?? null,
              primaryColour: branding.primaryColour ?? "#2563EB",
              secondaryColour: branding.secondaryColour ?? "#1E3A8A",
              accentColour: branding.accentColour ?? "#0EA5E9",
              fontPreference: branding.fontPreference ?? "Inter",
            }
          : null,
      });
    } catch (e: any) {
      console.error("[public] GET /api/public/schools/:code", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * GET /api/public/schools/:code/website
   * Returns the school's PUBLISHED website sections for the public page.
   * Fails safe: returns [] if the table doesn't exist yet or anything errors,
   * so the public page never breaks.
   */
  app.get("/api/public/schools/:code/website", async (req, res) => {
    try {
      const school = await storage.getSchoolByCode(req.params.code.toUpperCase());
      if (!school || school.isDeleted || school.status !== "active") {
        return res.status(404).json({ message: "School not found" });
      }
      const sections = await storage.getWebsiteSections(school.id, true);
      return res.json(sections.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        body: s.body ?? null,
        imageUrl: s.imageUrl ?? null,
        linkUrl: s.linkUrl ?? null,
        linkLabel: s.linkLabel ?? null,
      })));
    } catch (e: any) {
      console.error("[public] GET /api/public/schools/:code/website", e.message);
      return res.json([]); // fail-safe: public page renders without CMS sections
    }
  });
}
