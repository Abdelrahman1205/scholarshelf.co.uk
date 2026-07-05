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

// Legacy role mapping for backward compatibility with demo accounts
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
});

export type SchoolWebsiteSection = typeof schoolWebsiteSections.$inferSelect;
export type InsertSchoolWebsiteSection = typeof schoolWebsiteSections.$inferInsert;

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
  schoolId: varchar("school_id", { length: 36 }),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// === INVITES ===
export const invites = pgTable("invites", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  email: text("email").notNull(),
  inviteeName: text("invitee_name"),
  role: text("role").notNull(),
  schoolId: varchar("school_id", { length: 36 }),
  tokenHash: text("token_hash").notNull(),
  invitedBy: varchar("invited_by", { length: 36 }).references(() => users.id),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  schoolId: varchar("school_id", { length: 36 }),
});

export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

export const students = pgTable("students", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  classId: varchar("class_id", { length: 36 }).references(() => classes.id),
  studentCode: text("student_code").unique(),
  schoolId: varchar("school_id", { length: 36 }),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by", { length: 36 }),
});

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
  schoolId: varchar("school_id", { length: 36 }),
  bookCode: varchar("book_code", { length: 50 }),
  barcodeGeneratedAt: timestamp("barcode_generated_at"),
});

export const insertBookSchema = createInsertSchema(books).omit({ id: true, bookCode: true, barcodeGeneratedAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export const bookLevels = pgTable("book_levels", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  schoolId: varchar("school_id", { length: 36 }),
});

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
  schoolId: varchar("school_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStudentBookLevelSchema = createInsertSchema(studentBookLevels).omit({ id: true });
export type InsertStudentBookLevel = z.infer<typeof insertStudentBookLevelSchema>;
export type StudentBookLevel = typeof studentBookLevels.$inferSelect;

// === FAMILIES ===
export const families = pgTable("families", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  schoolId: varchar("school_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const familyStudents = pgTable("family_students", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  familyId: varchar("family_id", { length: 36 }).references(() => families.id, { onDelete: "cascade" }).notNull(),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }).notNull(),
});

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true });
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;
export type FamilyStudent = typeof familyStudents.$inferSelect;

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
  schoolId: varchar("school_id", { length: 36 }),
});

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
  schoolId: varchar("school_id", { length: 36 }),
});

export const insertParentChildSchema = createInsertSchema(parentChildren).omit({ id: true, linkedAt: true });
export type InsertParentChild = z.infer<typeof insertParentChildSchema>;
export type ParentChild = typeof parentChildren.$inferSelect;

// === TEACHER PROFILES ===
export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id", { length: 36 }).notNull(),
    department: text("department"),
    subjects: text("subjects"), // JSON array stored as text
    createdAt: timestamp("created_at").defaultNow(),
    createdByAdminId: varchar("created_by_admin_id", { length: 36 }),
  },
  (table) => ({
    userSchoolUnique: uniqueIndex("teacher_profiles_user_school_unique").on(table.userId, table.schoolId),
    userIdx: index("teacher_profiles_user_id_idx").on(table.userId),
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
  schoolId: varchar("school_id", { length: 36 }),
});

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
  schoolId: varchar("school_id", { length: 36 }),
  // Teacher-led distribution tracking
  orderStatus: text("order_status").default("awaiting_payment_reference").notNull(),
});

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
});

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
  schoolId: varchar("school_id", { length: 36 }),
});

export const insertAllocationSchema = createInsertSchema(financeBookAllocations).omit({ id: true, allocatedAt: true, receivedAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type FinanceBookAllocation = typeof financeBookAllocations.$inferSelect;

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
  schoolId: varchar("school_id", { length: 36 }),
});

export const insertExtraCopyRequestSchema = createInsertSchema(extraCopyRequests).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertExtraCopyRequest = z.infer<typeof insertExtraCopyRequestSchema>;
export type ExtraCopyRequest = typeof extraCopyRequests.$inferSelect;

// === PARENT–TEACHER MESSAGING ===

export const THREAD_STATUSES = ["open", "closed", "archived"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const messageThreads = pgTable("message_threads", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull(),
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
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true, lastMessageAt: true, closedBy: true, closedAt: true, createdAt: true, updatedAt: true,
});
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  threadId: varchar("thread_id", { length: 36 }).references(() => messageThreads.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id", { length: 36 }).notNull(),
  senderUserId: varchar("sender_user_id", { length: 36 }).references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true, isRead: true, createdAt: true, editedAt: true, deletedAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const messageAuditLogs = pgTable("message_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  schoolId: varchar("school_id", { length: 36 }).notNull(),
  threadId: varchar("thread_id", { length: 36 }).references(() => messageThreads.id),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id).notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
