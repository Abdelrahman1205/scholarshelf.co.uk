import path from "path";
import crypto from "crypto";
import type { Request } from "express";
import type { FileFilterCallback } from "multer";
import type { SchoolBranding } from "../shared/schema.js";

export const BRANDING_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

// SECURITY: extensions AND MIME types accepted for branding uploads.
// SVG is intentionally excluded — it can contain <script> tags (stored XSS).
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Magic bytes (file signatures) for each allowed MIME type.
// Checking actual file bytes prevents MIME spoofing via the Content-Type header.
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" at byte 8
];

/**
 * Returns the detected MIME type from the file's actual bytes, or null if
 * the content does not match any allowed format.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const match = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
    if (match) return sig.mime;
  }
  return null;
}

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

/**
 * Multer fileFilter — first-pass check on extension and declared MIME type.
 * A second check on actual magic bytes is performed in validateUploadedImage()
 * AFTER multer has buffered the file, because fileFilter runs before we have
 * access to the buffer.
 */
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

/**
 * Post-upload validation — checks actual file bytes against known magic numbers.
 * Call this AFTER multer has processed the upload and file.buffer is populated.
 *
 * Returns the validated MIME type, or throws an Error if the content is invalid.
 *
 * This prevents MIME-type spoofing: a client claiming Content-Type: image/png
 * while uploading an SVG or other payload is rejected here.
 */
export function validateUploadedImage(file: Express.Multer.File): string {
  if (!file.buffer || file.buffer.length < 12) {
    throw new Error("Uploaded file is empty or too small to be a valid image.");
  }

  const detectedMime = detectImageMimeType(file.buffer);
  if (!detectedMime) {
    throw new Error(
      "File content does not match a supported image format (PNG, JPG, or WEBP). " +
      "SVG and other formats are not accepted.",
    );
  }

  // Ensure the detected type matches what was declared — defence-in-depth.
  if (detectedMime !== file.mimetype) {
    throw new Error(
      `File content (${detectedMime}) does not match the declared type (${file.mimetype}). ` +
      "Upload rejected.",
    );
  }

  return detectedMime;
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
  // SECURITY: Validate actual file bytes before accepting the upload.
  const validatedMime = validateUploadedImage(file);

  const extension = extensionForMime(validatedMime);
  const fileId = `${field}-${Date.now()}-${crypto.randomUUID()}${extension}`;

  // NOTE: Images are currently stored as base64 data URIs in the database for
  // serverless compatibility. This causes DB bloat and large API responses.
  // TODO: Migrate to Vercel Blob / S3 object storage and store only the URL.
  const base64 = file.buffer.toString("base64");
  return {
    fileId,
    url: `data:${validatedMime};base64,${base64}`,
  };
}
