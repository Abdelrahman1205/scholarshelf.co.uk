/**
 * server/routes/public.routes.ts
 *
 * Unauthenticated public endpoints — no requireAuth middleware.
 * Currently exposes: GET /api/public/schools/:code
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import { rateLimit } from "../middleware/auth.js";
import { sendContactMessageEmail, sendContactAcknowledgementEmail } from "../email.js";

export function registerPublicRoutes(app: Express): void {
  /**
   * POST /api/public/contact
   * Public contact form. No auth. Delivered to a FIXED internal inbox — the
   * recipient is never taken from the request, so this cannot be used as an
   * open relay. Rate-limited per IP to blunt spam.
   */
  app.post("/api/public/contact", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket?.remoteAddress || "unknown";
      if (await rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many messages sent. Please try again later." });
      }

      const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const name = str(req.body?.name, 120);
      const email = str(req.body?.email, 200);
      const subject = str(req.body?.subject, 160);
      const message = str(req.body?.message, 4000);
      // Honeypot: a hidden field real users never fill in. Silently accept to
      // avoid telling a bot it was caught.
      const trap = str(req.body?.company, 100);

      if (!name || !email || !message) {
        return res.status(400).json({ message: "Please provide your name, email address and a message." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      if (trap) return res.json({ ok: true });

      const delivered = await sendContactMessageEmail({ name, email, subject, message });
      if (!delivered) {
        console.log(`[CONTACT] ${name} <${email}> — ${subject || "(no subject)"}: ${message}`);
      }
      // Acknowledgement is best-effort; never fail the request because of it.
      sendContactAcknowledgementEmail(email, name).catch(() => {});

      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Sorry, we couldn't send your message. Please email us directly." });
    }
  });

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
