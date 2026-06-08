import path from "path";
import crypto from "crypto";
import type { Request } from "express";
import type { FileFilterCallback } from "multer";
import type { SchoolBranding } from "../shared/schema.js";

export const BRANDING_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type BrandingUploadField = "logo" | "banner" | "favicon" | "emailLogo" | "pdfLogo";

const brandingFieldToColumn: Record<BrandingUploadField, { url: keyof SchoolBranding; fileId: keyof SchoolBranding }> = {
  logo: { url: "logoUrl", fileId: "logoFileId" },
  banner: { url: "bannerImageUrl", fileId: "bannerFileId" },
  favicon: { url: "faviconUrl", fileId: "faviconFileId" },
  emailLogo: { url: "emailHeaderLogoUrl", fileId: "emailHeaderLogoFileId" },
  pdfLogo: { url: "pdfLogoUrl", fileId: "pdfLogoFileId" },
};

export function getBrandingFieldColumns(field: BrandingUploadField) {
  return brandingFieldToColumn[field];
}

export function getDefaultBranding() {
  return {
    logoUrl: null,
    faviconUrl: "/favicon.png",
    bannerImageUrl: null,
    emailHeaderLogoUrl: null,
    pdfLogoUrl: null,
    primaryColour: "#2563EB",
    secondaryColour: "#1E3A8A",
    accentColour: "#0EA5E9",
    themeName: "default",
    fontPreference: "Inter",
    setupStatus: "pending",
  };
}

export function normalizeHexColour(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const input = value.trim();
  if (!input) return fallback;
  const normalized = input.startsWith("#") ? input : `#${input}`;
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

export function normalizeThemeName(value: unknown): string {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "default";
  return trimmed.slice(0, 40);
}

export function normalizeFontPreference(value: unknown): string {
  if (typeof value !== "string") return "Inter";
  const trimmed = value.trim();
  if (!trimmed) return "Inter";
  return trimmed.slice(0, 60);
}

export function buildBrandingResponse(branding: Partial<SchoolBranding> | null | undefined, schoolName?: string | null) {
  const defaults = getDefaultBranding();
  return {
    schoolName: schoolName || null,
    logoUrl: branding?.logoUrl || defaults.logoUrl,
    faviconUrl: branding?.faviconUrl || defaults.faviconUrl,
    bannerImageUrl: branding?.bannerImageUrl || defaults.bannerImageUrl,
    emailHeaderLogoUrl: branding?.emailHeaderLogoUrl || defaults.emailHeaderLogoUrl,
    pdfLogoUrl: branding?.pdfLogoUrl || defaults.pdfLogoUrl,
    primaryColour: branding?.primaryColour || defaults.primaryColour,
    secondaryColour: branding?.secondaryColour || defaults.secondaryColour,
    accentColour: branding?.accentColour || defaults.accentColour,
    themeName: branding?.themeName || defaults.themeName,
    fontPreference: branding?.fontPreference || defaults.fontPreference,
    setupStatus: branding?.setupStatus || defaults.setupStatus,
  };
}

export function brandingFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    cb(new Error("Only PNG, JPG, JPEG, and WEBP files are allowed."));
    return;
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error("Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed."));
    return;
  }
  cb(null, true);
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

export async function storeBrandingImage(
  _schoolId: string,
  field: BrandingUploadField,
  file: Express.Multer.File,
  _previousFileId?: string | null,
) {
  const extension = extensionForMime(file.mimetype);
  const fileId = `${field}-${Date.now()}-${crypto.randomUUID()}${extension}`;

  // Use data URLs for persistence across serverless deployments where local
  // filesystem storage is not durable.
  const base64 = file.buffer.toString("base64");
  return {
    fileId,
    url: `data:${file.mimetype};base64,${base64}`,
  };
}
