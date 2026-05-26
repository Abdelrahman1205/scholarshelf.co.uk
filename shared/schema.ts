import { randomUUID } from "crypto";
import { pgTable, text, varchar, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role and status constants
export const USER_ROLES = ["owner", "platform_admin", "school_admin", "teacher", "parent", "finance", "it_personnel", "student"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "invited", "disabled", "locked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Legacy role mapping for backward compatibility with demo accounts
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: "school_admin",
  teacher: "teacher",
  parent: "parent",
};

export const SCHOOL_STATUSES = ["active", "pending_setup", "suspended"] as const;
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

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

export const classes = pgTable("classes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  academicYear: text("academic_year"),
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
});

export const insertBookSchema = createInsertSchema(books).omit({ id: true });
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

export const childLinkingCodes = pgTable("child_linking_codes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  studentId: varchar("student_id", { length: 36 }).references(() => students.id, { onDelete: "cascade" }).notNull(),
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
});

export const insertParentChildSchema = createInsertSchema(parentChildren).omit({ id: true, linkedAt: true });
export type InsertParentChild = z.infer<typeof insertParentChildSchema>;
export type ParentChild = typeof parentChildren.$inferSelect;

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

export const bookPayments = pgTable("book_payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  parentIdentifier: text("parent_identifier").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank_transfer"),
  paymentReference: text("payment_reference").unique().notNull(),
  status: text("status").default("pending").notNull(),
  paidAt: timestamp("paid_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  externalPaymentId: text("external_payment_id"),
  externalPaymentStatus: text("external_payment_status"),
  notes: text("notes"),
  schoolId: varchar("school_id", { length: 36 }),
});

export const insertBookPaymentSchema = createInsertSchema(bookPayments).omit({ id: true, paidAt: true, confirmedAt: true });
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
  allocatedAt: timestamp("allocated_at").defaultNow(),
  receivedAt: timestamp("received_at"),
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

// === AUTH REQUEST VALIDATION SCHEMAS ===

export const signInSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
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

