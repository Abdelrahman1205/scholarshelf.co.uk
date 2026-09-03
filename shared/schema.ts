import { randomUUID } from "crypto";
import { pgTable, text, varchar, integer, numeric, boolean, timestamp, index, uniqueIndex, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role and status constants
export const USER_ROLES = ["owner", "platform_admin", "school_admin", "teacher", "parent", "finance", "it_personnel", "student"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "invited", "disabled", "locked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const BRANDING_PERMISSIONS = [
  "BRANDING_VIEW",
  "BRANDING_MANAGE",
  "BRANDING_UPLOAD_LOGO",
  "BRANDING_UPDATE_THEME",
  "BRANDING_RESET_DEFAULT",
] as const;
export type BrandingPermission = (typeof BRANDING_PERMISSIONS)[number];

export const BRANDING_AUDIT_ACTIONS = [
  "BRANDING_VIEWED_BY_OWNER",
  "BRANDING_UPDATED",
  "BRANDING_LOGO_UPLOADED",
  "BRANDING_BANNER_UPLOADED",
  "BRANDING_FAVICON_UPLOADED",
  "BRANDING_THEME_CHANGED",
  "BRANDING_RESET_TO_DEFAULT",
  "BRANDING_EMAIL_LOGO_UPDATED",
  "BRANDING_PDF_LOGO_UPDATED",
] as const;
export type BrandingAuditAction = (typeof BRANDING_AUDIT_ACTIONS)[number];

// Legacy role mapping for backward compatibility with older account rows
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: "school_admin",
  teacher: "teacher",
  parent: "parent",
};

// === PAYMENT & DISTRIBUTION STATUS ENUMS ===
export const PAYMENT_STATUSES = ["awaiting_reference", "reference_submitted", "confirmed", "rejected", "needs_review"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = [
  "awaiting_payment_reference",
  "payment_under_review",
  "payment_confirmed",
  "ready_for_teacher_distribution",
  "partially_distributed",
  "distributed",
  "pending_student_collection",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DISTRIBUTION_STATUSES = ["pending_distribution", "received_by_student", "student_absent", "issue_reported"] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

export const SCHOOL_STATUSES = ["active", "pending_setup", "suspended", "archived", "pending_deletion", "deleted"] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export const SCHOOL_SETUP_STATUSES = [
  "school_created",
  "pending_admin_invite",
  "pending_admin_acceptance",
  "admin_accepted",
  "operational_setup_in_progress",
  "operational_setup_complete",
  "complete",
  "active",
] as const;
export type SchoolSetupStatus = (typeof SCHOOL_SETUP_STATUSES)[number];

export const schools = pgTable("schools", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  code: text("code").unique().notNull(),
  status: text("status").default("active").notNull(),
  setupStatus: text("setup_status").default("pending_admin_invite").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  notes: text("notes"),
  paymentAppName: text("payment_app_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Lifecycle metadata
  isDeleted: boolean("is_deleted").default(false).notNull(),
  suspendedAt: timestamp("suspended_at"),
  suspendedBy: varchar("suspended_by", { length: 36 }),
  suspensionReason: text("suspension_reason"),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by", { length: 36 }),
  archiveReason: text("archive_reason"),
  restoredAt: timestamp("restored_at"),
  restoredBy: varchar("restored_by", { length: 36 }),
  restoreReason: text("restore_reason"),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionRequestedBy: varchar("deletion_requested_by", { length: 36 }),
  deletionReason: text("deletion_reason"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  deleteReason: text("delete_reason"),
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true, createdAt: true, updatedAt: true,
  isDeleted: true, suspendedAt: true, suspendedBy: true, suspensionReason: true,
  archivedAt: true, archivedBy: true, archiveReason: true,
  restoredAt: true, restoredBy: true, restoreReason: true,
  deletionRequestedAt: true, deletionRequestedBy: true, deletionReason: true,
  deletedAt: true, deletedBy: true, deleteReason: true,
});
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

export const schoolBranding = pgTable(
  "school_branding",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    logoFileId: text("logo_file_id"),
    faviconUrl: text("favicon_url"),
    faviconFileId: text("favicon_file_id"),
    bannerImageUrl: text("banner_image_url"),
    bannerFileId: text("banner_file_id"),
    emailHeaderLogoUrl: text("email_header_logo_url"),
    emailHeaderLogoFileId: text("email_header_logo_file_id"),
    pdfLogoUrl: text("pdf_logo_url"),
    pdfLogoFileId: text("pdf_logo_file_id"),
    primaryColour: text("primary_colour").default("#2563EB"),
    secondaryColour: text("secondary_colour").default("#1E3A8A"),
    accentColour: text("accent_colour").default("#0EA5E9"),
    themeName: text("theme_name").default("default"),
    fontPreference: text("font_preference").default("Inter"),
    setupStatus: text("setup_status").default("pending"), // pending | skipped | completed
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  },
  (table) => ({
    schoolUnique: uniqueIndex("school_branding_school_id_unique").on(table.schoolId),
    schoolIndex: index("school_branding_school_id_idx").on(table.schoolId),
  }),
);

// ── Scheduled-job bookkeeping ────────────────────────────────────────────────
// One row per (job, school, day). The cron INSERTs before doing any work with
// ON CONFLICT DO NOTHING: if the insert wins, this instance owns the run; if it
// loses, the work is already done and it moves on.
//
// Without this, a timeout halfway through the loop meant some schools got their
// digest and some did not, with no way to tell which — and a retry re-emailed
// parents about money they owe.
export const cronJobRuns = pgTable(
  "cron_job_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    job: text("job").notNull(),
    schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
    runDate: text("run_date").notNull(),          // ISO yyyy-mm-dd, UTC
    status: text("status").notNull().default("running"), // running | completed | failed
    sentCount: integer("sent_count").default(0),
    detail: text("detail"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    jobSchoolDayUnique: uniqueIndex("cron_job_runs_job_school_day_unique").on(table.job, table.schoolId, table.runDate),
    schoolIdx: index("cron_job_runs_school_id_idx").on(table.schoolId),
  }),
);
export type CronJobRun = typeof cronJobRuns.$inferSelect;

// ── Webhook replay protection ────────────────────────────────────────────────
//
// A signed webhook body with no event id is replayable forever: capture it once
// and you can re-settle the same order any number of times. One row per
// (source, event_id), claimed with ON CONFLICT DO NOTHING before any work is
// done — winning the insert means you own the delivery. Same shape as
// cron_job_runs above, for the same reason.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    source: text("source").notNull(),        // which webhook, e.g. "payment-update"
    eventId: text("event_id").notNull(),     // the sender's id for this delivery
    status: text("status").notNull().default("processing"), // processing | completed | failed
    detail: text("detail"),
    receivedAt: timestamp("received_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    sourceEventUnique: uniqueIndex("webhook_events_source_event_unique").on(table.source, table.eventId),
  }),
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;

// ── Distributed rate limiting (used by server/middleware/auth.ts on serverless) ──
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// ── School public website content (CMS sections, managed by IT / school admin) ──
export const schoolWebsiteSections = pgTable("school_website_sections", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  type: text("type").default("custom").notNull(), // hero | about | announcement | contact | custom
  title: text("title").notNull(),
  body: text("body"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
}, (table) => ({
    schoolIdx: index("school_website_sections_school_id_idx").on(table.schoolId),
}));

export type SchoolWebsiteSection = typeof schoolWebsiteSections.$inferSelect;
export type InsertSchoolWebsiteSection = typeof schoolWebsiteSections.$inferInsert;

// ── Media library (uploaded assets for the school website / CMS, managed by IT) ──
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  kind: text("kind").default("image").notNull(), // image | document | video
  sizeBytes: integer("size_bytes").default(0).notNull(),
  dataUri: text("data_uri").notNull(), // base64 data URI (same storage approach as branding)
  title: text("title"),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow(),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
}, (table) => ({
    schoolIdx: index("media_assets_school_id_idx").on(table.schoolId),
}));

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

// ── Notification / email preferences (opt-out of scheduled digests & reminders) ──
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  dailyDigest: boolean("daily_digest").default(true).notNull(),       // staff: daily summary
  lowStockAlerts: boolean("low_stock_alerts").default(true).notNull(), // staff: low-stock section
  paymentReminders: boolean("payment_reminders").default(true).notNull(), // parents: unpaid reminders
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// Safe-URL validators for CMS content. A section is published to a PUBLIC page,
// so a stored URL must not carry active content. We allow only navigable schemes
// and reject javascript:, data:, vbscript:, file:, etc. — closing the stored-XSS
// vector where a link like `javascript:...` would execute in a visitor's browser.
const SAFE_LINK_SCHEMES = ["http:", "https:", "mailto:", "tel:"];
const SAFE_IMAGE_SCHEMES = ["http:", "https:"];

function safeUrl(allowedSchemes: string[], label: string) {
  return z
    .string()
    .trim()
    .max(2000)
    .refine((v) => {
      try {
        const scheme = new URL(v).protocol.toLowerCase();
        return allowedSchemes.includes(scheme);
      } catch {
        return false;
      }
    }, `${label} must be a valid URL using ${allowedSchemes.map((s) => s.replace(":", "")).join(", ")}`)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null));
}

export const websiteSectionInputSchema = z.object({
  type: z.enum(["hero", "about", "announcement", "contact", "custom"]).default("custom"),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().max(20000).optional().nullable(),
  imageUrl: safeUrl(SAFE_IMAGE_SCHEMES, "Image"),
  linkUrl: safeUrl(SAFE_LINK_SCHEMES, "Link"),
  linkLabel: z.string().max(100).optional().nullable(),
  isPublished: z.boolean().optional(),
}).strict();

export const insertSchoolBrandingSchema = createInsertSchema(schoolBranding).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSchoolBrandingSchema = insertSchoolBrandingSchema.partial().omit({ schoolId: true });
export type InsertSchoolBranding = z.infer<typeof insertSchoolBrandingSchema>;
export type UpdateSchoolBrandingInput = z.infer<typeof updateSchoolBrandingSchema>;
export type SchoolBranding = typeof schoolBranding.$inferSelect;

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userPermissionUnique: uniqueIndex("user_permissions_user_id_permission_unique").on(table.userId, table.permission),
    userPermissionUserIdx: index("user_permissions_user_id_idx").on(table.userId),
  }),
);

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({ id: true, createdAt: true });
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;

export const brandingUploadResponseSchema = z.object({
  url: z.string().url(),
  fileId: z.string(),
  field: z.enum(["logo", "banner", "favicon", "emailLogo", "pdfLogo"]),
});
export type BrandingUploadResponse = z.infer<typeof brandingUploadResponseSchema>;

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  status: text("status").default("active").notNull(),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  // Multi-factor authentication (TOTP). Secret + recovery-code hashes are only
  // populated once a user completes enrolment; never exposed to the client.
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  mfaSecret: text("mfa_secret"),
  mfaRecoveryCodes: text("mfa_recovery_codes"), // JSON array of SHA-256 recovery-code hashes
  mfaEnrolledAt: timestamp("mfa_enrolled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("users_school_id_idx").on(table.schoolId),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true, updatedAt: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true, mfaEnrolledAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// === INVITES ===
export const invites = pgTable("invites", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  email: text("email").notNull(),
  inviteeName: text("invitee_name"),
  role: text("role").notNull(),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  invitedBy: varchar("invited_by", { length: 36 }).references(() => users.id),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // Staff-invite wizard: optional family link so a staff member who is also a
  // parent is auto-linked to their children (as a parent) when they accept.
  familyId: varchar("family_id", { length: 36 }),
  relationship: text("relationship"),
  guardianPermissions: text("guardian_permissions"),
}, (table) => ({
    schoolIdx: index("invites_school_id_idx").on(table.schoolId),
}));

export const insertInviteSchema = createInsertSchema(invites).omit({ id: true, acceptedAt: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invites.$inferSelect;

// === AUDIT LOGS ===
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  userId: varchar("user_id", { length: 36 }),
  action: text("action").notNull(),
  target: text("target"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Session storage used by connect-pg-simple.
export const userSessions = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { mode: "date" }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);
export type UserSession = typeof userSessions.$inferSelect;

export const classes = pgTable("classes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  academicYear: text("academic_year"),
  yearGroup: text("year_group"),
  teacherId: varchar("teacher_id", { length: 36 }),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
}, (table) => ({
    schoolIdx: index("classes_school_id_idx").on(table.schoolId),
}));

export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

// ── Subjects ─────────────────────────────────────────────────────────────────
export const subjects = pgTable("subjects", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("subjects_school_id_idx").on(table.schoolId),
}));
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, createdAt: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjects.$inferSelect;

// ── Class ↔ teacher assignments (many-to-many, subject-based) ────────────────
// Replaces the single classes.teacherId for schools where several teachers share
// one class by subject — e.g. MSS: each of 21 classes has an Arabic teacher, and
// 5 Quran teachers are shared across those classes. classes.teacherId is kept for
// backward compatibility (treated as an implicit assignment).
export const classTeacherAssignments = pgTable("class_teacher_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  classId: varchar("class_id", { length: 36 }).references(() => classes.id, { onDelete: "cascade" }).notNull(),
  subjectId: varchar("subject_id", { length: 36 }),
  teacherId: varchar("teacher_id", { length: 36 }).notNull(),
  assignmentRole: text("assignment_role").default("Subject Teacher"),
  academicYear: text("academic_year"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("class_teacher_assignments_school_id_idx").on(table.schoolId),
}));
export const insertClassTeacherAssignmentSchema = createInsertSchema(classTeacherAssignments).omit({ id: true, createdAt: true });
export type InsertClassTeacherAssignment = z.infer<typeof insertClassTeacherAssignmentSchema>;
export type ClassTeacherAssignment = typeof classTeacherAssignments.$inferSelect;

export const students = pgTable("students", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  classId: varchar("class_id", { length: 36 }).references(() => classes.id),
  studentCode: text("student_code").unique(),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  // Family-first fields (additive / nullable — a student belongs to one family).
  // FK with ON DELETE SET NULL: deleting a family unlinks its students but keeps
  // the student records (and their allocation/payment history) intact.
  familyId: varchar("family_id", { length: 36 }).references(() => families.id, { onDelete: "set null" }),
  dateOfBirth: text("date_of_birth"),                 // ISO yyyy-mm-dd
  gender: text("gender"),
  gradeLevel: text("grade_level"),
  preferredReadingLevel: text("preferred_reading_level"),
  photoUrl: text("photo_url"),
  status: text("status").default("active").notNull(), // active | inactive | alumni
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by", { length: 36 }),
}, (table) => ({
    schoolIdx: index("students_school_id_idx").on(table.schoolId),
    schoolClassIdx: index("students_school_class_idx").on(table.schoolId, table.classId),
}));

export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export const books = pgTable("books", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  title: text("title").notNull(),
  author: text("author"),
  isbn: text("isbn"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isActive: boolean("is_active").default(true),
  stockQuantity: integer("stock_quantity").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  reorderQuantity: integer("reorder_quantity").default(50),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  bookCode: varchar("book_code", { length: 50 }),
  barcodeGeneratedAt: timestamp("barcode_generated_at"),
}, (table) => ({
    schoolIdx: index("books_school_id_idx").on(table.schoolId),
}));

export const insertBookSchema = createInsertSchema(books).omit({ id: true, bookCode: true, barcodeGeneratedAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

// ── Book copies ──────────────────────────────────────────────────────────────
// Per-physical-copy tracking. Every individual book gets its own unique,
// scannable ScholarShelf code (copyCode, e.g. "SSC-000123-7") and moves through
// a lifecycle: in_stock → allocated → sold, plus damaged/lost write-offs.
// bookCode on `books` remains the TITLE-level SKU; this table is the COPY level.
export const bookCopies = pgTable("book_copies", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id, { onDelete: "cascade" }).notNull(),
  copyNumber: integer("copy_number").notNull(),          // per-school running serial
  copyCode: varchar("copy_code", { length: 50 }).notNull().unique(), // scannable marker
  status: text("status").default("in_stock").notNull(),  // in_stock | allocated | sold | damaged | lost | returned
  condition: text("condition").default("new"),            // new | good | damaged
  studentId: varchar("student_id", { length: 36 }),       // set when allocated/sold
  paymentId: varchar("payment_id", { length: 36 }),       // set when sold (links to book_payments)
  academicYear: text("academic_year"),                    // the intake batch, e.g. "2026/27"
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),                   // set when the printed label is scan-confirmed at intake
  soldAt: timestamp("sold_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("book_copies_school_id_idx").on(table.schoolId),
}));

export const insertBookCopySchema = createInsertSchema(bookCopies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBookCopy = z.infer<typeof insertBookCopySchema>;
export type BookCopy = typeof bookCopies.$inferSelect;

export const bookLevels = pgTable("book_levels", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
}, (table) => ({
    schoolIdx: index("book_levels_school_id_idx").on(table.schoolId),
}));

export const insertBookLevelSchema = createInsertSchema(bookLevels).omit({ id: true });
export type InsertBookLevel = z.infer<typeof insertBookLevelSchema>;
export type BookLevel = typeof bookLevels.$inferSelect;

export const bookLevelItems = pgTable("book_level_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  bookLevelId: varchar("book_level_id", { length: 36 }).references(() => bookLevels.id, { onDelete: "cascade" }).notNull(),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").default(1),
});

export const insertBookLevelItemSchema = createInsertSchema(bookLevelItems).omit({ id: true });
export type InsertBookLevelItem = z.infer<typeof insertBookLevelItemSchema>;
export type BookLevelItem = typeof bookLevelItems.$inferSelect;

export const classBookLevels = pgTable("class_book_levels", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  classId: varchar("class_id", { length: 36 }).references(() => classes.id, { onDelete: "cascade" }).notNull(),
  bookLevelId: varchar("book_level_id", { length: 36 }).references(() => bookLevels.id, { onDelete: "cascade" }).notNull(),
});

export const insertClassBookLevelSchema = createInsertSchema(classBookLevels).omit({ id: true });
export type InsertClassBookLevel = z.infer<typeof insertClassBookLevelSchema>;
export type ClassBookLevel = typeof classBookLevels.$inferSelect;

// Per-student book level override (overrides the class-level assignment for one student)
export const studentBookLevels = pgTable("student_book_levels", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }).notNull().unique(),
  bookLevelId: varchar("book_level_id", { length: 36 }).references(() => bookLevels.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("student_book_levels_school_id_idx").on(table.schoolId),
}));
export const insertStudentBookLevelSchema = createInsertSchema(studentBookLevels).omit({ id: true });
export type InsertStudentBookLevel = z.infer<typeof insertStudentBookLevelSchema>;
export type StudentBookLevel = typeof studentBookLevels.$inferSelect;

// === FAMILIES (family-first enrollment: the central household record) ===
export const families = pgTable("families", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),                       // legacy display name (kept in sync with householdName)
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  // Family-first fields (all additive / nullable so existing rows keep working)
  familyCode: text("family_code").unique(),           // friendly household reference shown in the UI (never the UUID)
  householdName: text("household_name"),
  primaryContactGuardianId: varchar("primary_contact_guardian_id", { length: 36 }),
  primaryPhone: text("primary_phone"),
  primaryEmail: text("primary_email"),
  address: text("address"),
  status: text("status").default("enrolled").notNull(), // draft | ready | enrolled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("families_school_id_idx").on(table.schoolId),
}));

export const familyStudents = pgTable("family_students", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  familyId: varchar("family_id", { length: 36 }).references(() => families.id, { onDelete: "cascade" }).notNull(),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }).notNull(),
});

// Guardians / parents attached directly to a family record.
export const guardians = pgTable("guardians", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  familyId: varchar("family_id", { length: 36 }).references(() => families.id, { onDelete: "cascade" }).notNull(),
  fullName: text("full_name").notNull(),
  relationship: text("relationship"),                 // Mother | Father | Guardian | Other
  email: text("email"),
  phone: text("phone"),
  isPrimaryContact: boolean("is_primary_contact").default(false).notNull(),
  portalAccessStatus: text("portal_access_status").default("none").notNull(), // none | invited | active
  // Explicit guardian↔portal-user link (Slice 2). Nullable: a guardian may have no
  // portal account yet. Set on linking-code redemption / backfilled from redemptions.
  // ON DELETE SET NULL so deleting a user never cascades away the guardian record.
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("guardians_school_id_idx").on(table.schoolId),
}));

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true, updatedAt: true, familyCode: true });
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;
export type FamilyStudent = typeof familyStudents.$inferSelect;
export const insertGuardianSchema = createInsertSchema(guardians).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuardian = z.infer<typeof insertGuardianSchema>;
export type Guardian = typeof guardians.$inferSelect;

export const childLinkingCodes = pgTable("child_linking_codes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  // For single-child codes: studentId is set. For family codes: familyId is set, studentId is null.
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }),
  familyId: varchar("family_id", { length: 36 }).references(() => families.id, { onDelete: "cascade" }),
  code: text("code").unique().notNull(),
  parentEmail: text("parent_email").notNull(),
  isUsed: boolean("is_used").default(false),
  linkedAt: timestamp("linked_at"),
  expiresAt: timestamp("expires_at"),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
}, (table) => ({
    schoolIdx: index("child_linking_codes_school_id_idx").on(table.schoolId),
}));

export const insertChildLinkingCodeSchema = createInsertSchema(childLinkingCodes).omit({ id: true, isUsed: true, linkedAt: true });
export type InsertChildLinkingCode = z.infer<typeof insertChildLinkingCodeSchema>;
export type ChildLinkingCode = typeof childLinkingCodes.$inferSelect;

export const parentChildren = pgTable("parent_children", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  parentIdentifier: text("parent_identifier").notNull(),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }).notNull(),
  linkedAt: timestamp("linked_at").defaultNow(),
  // Multi-role: optional metadata for admin-created links
  relationship: text("relationship"), // Mother | Father | Guardian | Other
  addedByAdminId: varchar("added_by_admin_id", { length: 36 }),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
}, (table) => ({
    schoolIdx: index("parent_children_school_id_idx").on(table.schoolId),
}));

export const insertParentChildSchema = createInsertSchema(parentChildren).omit({ id: true, linkedAt: true });
export type InsertParentChild = z.infer<typeof insertParentChildSchema>;
export type ParentChild = typeof parentChildren.$inferSelect;

// === TEACHER PROFILES ===
export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    department: text("department"),
    subjects: text("subjects"), // JSON array stored as text
    createdAt: timestamp("created_at").defaultNow(),
    createdByAdminId: varchar("created_by_admin_id", { length: 36 }),
  },
  (table) => ({
    userSchoolUnique: uniqueIndex("teacher_profiles_user_school_unique").on(table.userId, table.schoolId),
    userIdx: index("teacher_profiles_user_id_idx").on(table.userId),
    // The unique index above leads with user_id, so it cannot serve a
    // school_id-only filter. Tenant-scoped lookups need their own.
    schoolIdx: index("teacher_profiles_school_id_idx").on(table.schoolId),
  }),
);

export const insertTeacherProfileSchema = createInsertSchema(teacherProfiles).omit({ id: true, createdAt: true });
export type InsertTeacherProfile = z.infer<typeof insertTeacherProfileSchema>;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;

export const childBookBaskets = pgTable("child_book_baskets", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id).notNull(),
  parentIdentifier: text("parent_identifier").notNull(),
  status: text("status").default("pending").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0"),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  // Stamped at write time so revenue and order history stay attributable to the
  // year they belong to after the September roll-up. See shared/academic-year.ts.
  academicYear: text("academic_year"),
}, (table) => ({
    schoolIdx: index("child_book_baskets_school_id_idx").on(table.schoolId),
}));

export const insertChildBookBasketSchema = createInsertSchema(childBookBaskets).omit({ id: true });
export type InsertChildBookBasket = z.infer<typeof insertChildBookBasketSchema>;
export type ChildBookBasket = typeof childBookBaskets.$inferSelect;

export const basketItems = pgTable("basket_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  basketId: varchar("basket_id", { length: 36 }).references(() => childBookBaskets.id, { onDelete: "cascade" }).notNull(),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id).notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertBasketItemSchema = createInsertSchema(basketItems).omit({ id: true });
export type InsertBasketItem = z.infer<typeof insertBasketItemSchema>;
export type BasketItem = typeof basketItems.$inferSelect;

/**
 * Payment / Order statuses:
 *   awaiting_reference    – order created, parent has not yet submitted external reference
 *   reference_submitted   – parent submitted a Paragon/external reference number
 *   confirmed             – admin verified the reference and approved the payment
 *   rejected              – admin rejected the reference; parent may resubmit
 *   needs_review          – admin flagged for further investigation
 *   ready_for_collection  – payment confirmed, books ready for parent/student collection
 *   collected             – books collected / order fully complete
 *   cancelled             – order cancelled by admin
 *
 * Legacy status "pending" is treated as "awaiting_reference" in the UI.
 * Legacy status "completed" is treated as "confirmed".
 * Legacy status "failed" is treated as "rejected".
 */
export const bookPayments = pgTable("book_payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  parentIdentifier: text("parent_identifier").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("external_reference"),
  paymentReference: text("payment_reference").unique().notNull(),
  status: text("status").default("awaiting_reference").notNull(),
  paidAt: timestamp("paid_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  // External payment reference fields (Paragon App or similar)
  paymentReferenceNumber: text("payment_reference_number"),
  paymentReferenceSubmittedAt: timestamp("payment_reference_submitted_at"),
  paymentReferenceSubmittedBy: varchar("payment_reference_submitted_by", { length: 36 }),
  // Admin review fields
  paymentReviewedAt: timestamp("payment_reviewed_at"),
  paymentReviewedBy: varchar("payment_reviewed_by", { length: 36 }),
  paymentReviewNote: text("payment_review_note"),
  // Legacy / optional fields
  externalPaymentId: text("external_payment_id"),
  externalPaymentStatus: text("external_payment_status"),
  notes: text("notes"),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  // Teacher-led distribution tracking
  orderStatus: text("order_status").default("awaiting_payment_reference").notNull(),
  // How this order's finance stage was settled — see VERIFICATION_METHODS.
  // Null on orders that predate automatic verification, and on orders that have
  // not reached a finance decision yet. The full history (including failed
  // automatic attempts that preceded a manual override) lives in
  // payment_verification_attempts; this column is only the latest answer, so the
  // finance list can show it without a join.
  verificationMethod: text("verification_method"),
  // Stamped at write time so revenue and order history stay attributable to the
  // year they belong to after the September roll-up. See shared/academic-year.ts.
  academicYear: text("academic_year"),
}, (table) => ({
    schoolIdx: index("book_payments_school_id_idx").on(table.schoolId),
    schoolStatusIdx: index("book_payments_school_status_idx").on(table.schoolId, table.status),
}));

export const insertBookPaymentSchema = createInsertSchema(bookPayments).omit({
  id: true, paidAt: true, confirmedAt: true,
  paymentReferenceSubmittedAt: true, paymentReviewedAt: true,
});
export type InsertBookPayment = z.infer<typeof insertBookPaymentSchema>;
export type BookPayment = typeof bookPayments.$inferSelect;

export const basketPayments = pgTable("basket_payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  basketId: varchar("basket_id", { length: 36 }).references(() => childBookBaskets.id, { onDelete: "cascade" }).notNull(),
  paymentId: varchar("payment_id", { length: 36 }).references(() => bookPayments.id, { onDelete: "cascade" }).notNull(),
  // Carried on the link row itself so the database can state that this link,
  // its basket and its payment are all one school. See the composite foreign
  // keys in migrations/006 — with a NULL here those keys do not fire (MATCH
  // SIMPLE), so this must always be written.
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
});

// === PROVIDER PAYMENTS — the payment-data layer ==============================
//
// One row per payment as the PAYMENT PROVIDER sees it, normalised into a shape
// ScholarShelf understands. This table is deliberately provider-agnostic and
// deliberately sits BETWEEN the provider and the finance workflow:
//
//     Stripe CSV/XLSX export  ─┐
//                              ├─→  provider_payments  →  verification  →  workflow
//     Stripe API (later)      ─┘
//
// Nothing downstream of this table knows or cares where a row came from, which
// is what lets the spreadsheet importer be replaced by the Stripe API without
// touching matching, verification or the finance workflow. `source` records the
// origin for auditing only — it is never a branch in the verification logic.
//
// It also means finance verification never re-opens a spreadsheet: it queries
// this table.

export const PAYMENT_PROVIDERS = ["stripe"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Provider statuses, normalised. Stripe's exports use several vocabularies
 * ("Paid"/"succeeded"/"Complete"), so raw values are mapped onto these and the
 * original is kept in `rawStatus` for the audit trail.
 *
 * ONLY "succeeded" can satisfy automatic verification. Everything else — and
 * anything unrecognised, which maps to "unknown" — goes to a Finance Officer.
 */
export const PROVIDER_PAYMENT_STATUSES = [
  "succeeded", "pending", "failed", "cancelled",
  "refunded", "partially_refunded", "disputed", "unknown",
] as const;
export type ProviderPaymentStatus = (typeof PROVIDER_PAYMENT_STATUSES)[number];

/** The allow-list. Kept as its own constant so it can never drift by accident. */
export const PROVIDER_PAYMENT_VERIFIABLE_STATUSES: readonly ProviderPaymentStatus[] = ["succeeded"];

export const PROVIDER_PAYMENT_SOURCES = ["spreadsheet_import", "provider_api"] as const;
export type ProviderPaymentSourceKind = (typeof PROVIDER_PAYMENT_SOURCES)[number];

export const providerPayments = pgTable("provider_payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  provider: text("provider").default("stripe").notNull(),
  /** The provider's own unique id — Payment Intent, Charge or Transaction id. */
  providerPaymentId: text("provider_payment_id").notNull(),
  /** Charge id when the export carries both (pi_… plus ch_…). Informational. */
  providerChargeId: text("provider_charge_id"),
  status: text("status").notNull(),                  // normalised, see above
  rawStatus: text("raw_status"),                     // exactly what the export said
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  amountRefunded: numeric("amount_refunded", { precision: 10, scale: 2 }).default("0"),
  /** Uppercase ISO-4217. GBP and USD are different money and never match. */
  currency: varchar("currency", { length: 3 }).notNull(),
  /** The ScholarShelf payment reference found in the row (metadata/description). */
  reference: text("reference"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  description: text("description"),
  disputed: boolean("disputed").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  source: text("source").default("spreadsheet_import").notNull(),
  sourceFilename: text("source_filename"),
  importedAt: timestamp("imported_at").defaultNow(),
  importedBy: varchar("imported_by", { length: 36 }),
  /** The original row as JSON, so a Finance Officer can see what was imported. */
  raw: text("raw"),
}, (table) => ({
  schoolIdx: index("provider_payments_school_id_idx").on(table.schoolId),
  referenceIdx: index("provider_payments_reference_idx").on(table.schoolId, table.reference),
  // Re-uploading the same Stripe export must not duplicate transactions. The
  // provider's own id is the identity, scoped per school.
  identityIdx: uniqueIndex("provider_payments_identity_idx")
    .on(table.schoolId, table.provider, table.providerPaymentId),
}));

export const insertProviderPaymentSchema = createInsertSchema(providerPayments).omit({ id: true, importedAt: true });
export type InsertProviderPayment = z.infer<typeof insertProviderPaymentSchema>;
export type ProviderPayment = typeof providerPayments.$inferSelect;

// === PAYMENT VERIFICATION ATTEMPTS — append-only audit ======================
//
// Every verification decision, automatic or manual, appends one row. Nothing is
// ever updated or deleted, so "how was this order verified, by whom, and why"
// survives later changes. The finance UI reads the latest row for a payment to
// explain its current state.

export const VERIFICATION_OUTCOMES = ["verified", "investigation", "rejected"] as const;
export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number];

export const VERIFICATION_METHODS = [
  "automatic_stripe",           // matched against imported provider data, no human involved
  "manual_finance_override",    // a Finance Officer approved it by hand
  "manual_finance_rejection",   // a Finance Officer rejected it by hand
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/**
 * Why automatic verification did not verify. These are the strings the Finance
 * Officer sees explained in the UI, so they are part of the contract.
 */
export const VERIFICATION_REASON_CODES = [
  "no_provider_payment_found",
  "missing_payment_reference",
  "reference_mismatch",
  "payment_pending",
  "payment_failed",
  "payment_cancelled",
  "payment_refunded",
  "payment_disputed",
  "amount_mismatch",
  "currency_mismatch",
  "multiple_possible_matches",
  "weak_match_only",
  "provider_data_unavailable",
  "unknown_provider_status",
] as const;
export type VerificationReasonCode = (typeof VERIFICATION_REASON_CODES)[number];

export const paymentVerificationAttempts = pgTable("payment_verification_attempts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  paymentId: varchar("payment_id", { length: 36 })
    .references(() => bookPayments.id, { onDelete: "cascade" }).notNull(),
  outcome: text("outcome").notNull(),                // verified | investigation | rejected
  method: text("method").notNull(),                  // see VERIFICATION_METHODS
  reasonCode: text("reason_code"),                   // null when verified automatically
  reasonDetail: text("reason_detail"),               // human sentence, or the officer's note
  /** provider_payments.id of the transaction used (or the best candidate). */
  matchedProviderPaymentId: varchar("matched_provider_payment_id", { length: 36 }),
  candidateCount: integer("candidate_count").default(0),
  /** JSON snapshot of what was compared — expected vs found. */
  evidence: text("evidence"),
  /** Null for automatic decisions; the Finance Officer's id for manual ones. */
  actorUserId: varchar("actor_user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  paymentIdx: index("payment_verification_attempts_payment_idx").on(table.paymentId),
  schoolIdx: index("payment_verification_attempts_school_id_idx").on(table.schoolId),
}));

export const insertPaymentVerificationAttemptSchema =
  createInsertSchema(paymentVerificationAttempts).omit({ id: true, createdAt: true });
export type InsertPaymentVerificationAttempt = z.infer<typeof insertPaymentVerificationAttemptSchema>;
export type PaymentVerificationAttempt = typeof paymentVerificationAttempts.$inferSelect;

export const financeBookAllocations = pgTable("finance_book_allocations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id).notNull(),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id).notNull(),
  basketId: varchar("basket_id", { length: 36 }).references(() => childBookBaskets.id),
  status: text("status").default("allocated").notNull(),
  // Distribution status for teacher-led workflow
  distributionStatus: text("distribution_status").default("pending_distribution"),
  allocatedAt: timestamp("allocated_at").defaultNow(),
  receivedAt: timestamp("received_at"),
  // Teacher who confirmed the student received the book
  receivedByTeacherId: varchar("received_by_teacher_id", { length: 36 }).references(() => users.id),
  // Absent tracking
  absentMarkedAt: timestamp("absent_marked_at"),
  absentMarkedByTeacherId: varchar("absent_marked_by_teacher_id", { length: 36 }).references(() => users.id),
  // Issue reporting
  issueNote: text("issue_note"),
  // Slice 4: explicit book-custody state for this allocation (one custody unit =
  // one student × one book). Happy path: reserved → prepared → handed_to_teacher
  // → issued → collected. Exceptions: absent | returned | damaged | lost.
  // Maintained alongside status/distributionStatus via recordCustodyTransition;
  // every change is appended to custody_events.
  custodyStatus: text("custody_status").default("reserved").notNull(),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  // ── History snapshot (see shared/academic-year.ts) ──────────────────────
  // These record what was true WHEN the allocation happened. Without them the
  // only route from an allocation to a class is student.classId, which is
  // overwritten every September — so last year's reports silently re-attribute
  // to whichever class the child is in now.
  academicYear: text("academic_year"),
  classIdAtAllocation: varchar("class_id_at_allocation", { length: 36 }),
  classNameAtAllocation: text("class_name_at_allocation"),
  yearGroupAtAllocation: text("year_group_at_allocation"),
}, (table) => ({
    schoolIdx: index("finance_book_allocations_school_id_idx").on(table.schoolId),
}));

export const insertAllocationSchema = createInsertSchema(financeBookAllocations).omit({ id: true, allocatedAt: true, receivedAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type FinanceBookAllocation = typeof financeBookAllocations.$inferSelect;

// Slice 4: append-only custody audit log. One row per custody transition.
export const custodyEvents = pgTable("custody_events", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  allocationId: varchar("allocation_id", { length: 36 }).references(() => financeBookAllocations.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id", { length: 36 }).references(() => schools.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),          // null for the very first event
  toStatus: text("to_status").notNull(),
  actorUserId: varchar("actor_user_id", { length: 36 }),
  actorRole: text("actor_role"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("custody_events_school_id_idx").on(table.schoolId),
}));

export const insertCustodyEventSchema = createInsertSchema(custodyEvents).omit({ id: true, createdAt: true });
export type InsertCustodyEvent = z.infer<typeof insertCustodyEventSchema>;
export type CustodyEvent = typeof custodyEvents.$inferSelect;

export const bookInventoryTransactions = pgTable("book_inventory_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id, { onDelete: "cascade" }).notNull(),
  transactionType: text("transaction_type").notNull(),
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryTransactionSchema = createInsertSchema(bookInventoryTransactions).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type BookInventoryTransaction = typeof bookInventoryTransactions.$inferSelect;

export const extraCopyRequests = pgTable("extra_copy_requests", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id).notNull(),
  classId: varchar("class_id", { length: 36 }).references(() => classes.id).notNull(),
  bookId: varchar("book_id", { length: 36 }).references(() => books.id).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  status: text("status").default("pending").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
}, (table) => ({
    schoolIdx: index("extra_copy_requests_school_id_idx").on(table.schoolId),
}));

export const insertExtraCopyRequestSchema = createInsertSchema(extraCopyRequests).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertExtraCopyRequest = z.infer<typeof insertExtraCopyRequestSchema>;
export type ExtraCopyRequest = typeof extraCopyRequests.$inferSelect;

// === PARENT–TEACHER MESSAGING ===

export const THREAD_STATUSES = ["open", "closed", "archived"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const messageThreads = pgTable("message_threads", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id).notNull(),
  parentUserId: varchar("parent_user_id", { length: 36 }).references(() => users.id).notNull(),
  teacherUserId: varchar("teacher_user_id", { length: 36 }).references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  status: text("status").default("open").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  closedBy: varchar("closed_by", { length: 36 }),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("message_threads_school_id_idx").on(table.schoolId),
}));

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true, lastMessageAt: true, closedBy: true, closedAt: true, createdAt: true, updatedAt: true,
});
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  threadId: varchar("thread_id", { length: 36 }).references(() => messageThreads.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  senderUserId: varchar("sender_user_id", { length: 36 }).references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
    schoolIdx: index("messages_school_id_idx").on(table.schoolId),
    threadIdx: index("messages_thread_idx").on(table.threadId),
}));

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true, isRead: true, createdAt: true, editedAt: true, deletedAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const messageAuditLogs = pgTable("message_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id", { length: 36 }).references(() => messageThreads.id),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id).notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
    schoolIdx: index("message_audit_logs_school_id_idx").on(table.schoolId),
}));

export const insertMessageAuditLogSchema = createInsertSchema(messageAuditLogs).omit({ id: true, createdAt: true });
export type InsertMessageAuditLog = z.infer<typeof insertMessageAuditLogSchema>;
export type MessageAuditLog = typeof messageAuditLogs.$inferSelect;

// === AUTH REQUEST VALIDATION SCHEMAS ===


export const signInSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
  schoolCode: z.string().trim().min(1, "School code is required").max(50).optional(),
});

export const signUpParentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Valid email is required").max(255),
  username: z.string().min(3, "Username must be at least 3 characters").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required").max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
