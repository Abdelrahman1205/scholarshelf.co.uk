import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  academicYear: text("academic_year"),
});

export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

export const students = pgTable("students", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  classId: uuid("class_id").references(() => classes.id),
  studentCode: text("student_code").unique(),
});

export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

export const books = pgTable("books", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author"),
  isbn: text("isbn"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isActive: boolean("is_active").default(true),
  stockQuantity: integer("stock_quantity").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  reorderQuantity: integer("reorder_quantity").default(50),
});

export const insertBookSchema = createInsertSchema(books).omit({ id: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export const bookLevels = pgTable("book_levels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertBookLevelSchema = createInsertSchema(bookLevels).omit({ id: true });
export type InsertBookLevel = z.infer<typeof insertBookLevelSchema>;
export type BookLevel = typeof bookLevels.$inferSelect;

export const bookLevelItems = pgTable("book_level_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookLevelId: uuid("book_level_id").references(() => bookLevels.id, { onDelete: "cascade" }).notNull(),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").default(1),
});

export const insertBookLevelItemSchema = createInsertSchema(bookLevelItems).omit({ id: true });
export type InsertBookLevelItem = z.infer<typeof insertBookLevelItemSchema>;
export type BookLevelItem = typeof bookLevelItems.$inferSelect;

export const classBookLevels = pgTable("class_book_levels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
  bookLevelId: uuid("book_level_id").references(() => bookLevels.id, { onDelete: "cascade" }).notNull(),
});

export const insertClassBookLevelSchema = createInsertSchema(classBookLevels).omit({ id: true });
export type InsertClassBookLevel = z.infer<typeof insertClassBookLevelSchema>;
export type ClassBookLevel = typeof classBookLevels.$inferSelect;

export const childLinkingCodes = pgTable("child_linking_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  code: text("code").unique().notNull(),
  parentEmail: text("parent_email").notNull(),
  isUsed: boolean("is_used").default(false),
  linkedAt: timestamp("linked_at"),
  expiresAt: timestamp("expires_at"),
});

export const insertChildLinkingCodeSchema = createInsertSchema(childLinkingCodes).omit({ id: true, isUsed: true, linkedAt: true });
export type InsertChildLinkingCode = z.infer<typeof insertChildLinkingCodeSchema>;
export type ChildLinkingCode = typeof childLinkingCodes.$inferSelect;

export const parentChildren = pgTable("parent_children", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parentIdentifier: text("parent_identifier").notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  linkedAt: timestamp("linked_at").default(sql`now()`),
});

export const insertParentChildSchema = createInsertSchema(parentChildren).omit({ id: true, linkedAt: true });
export type InsertParentChild = z.infer<typeof insertParentChildSchema>;
export type ParentChild = typeof parentChildren.$inferSelect;

export const childBookBaskets = pgTable("child_book_baskets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  parentIdentifier: text("parent_identifier").notNull(),
  status: text("status").default("pending").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"),
});

export const insertChildBookBasketSchema = createInsertSchema(childBookBaskets).omit({ id: true });
export type InsertChildBookBasket = z.infer<typeof insertChildBookBasketSchema>;
export type ChildBookBasket = typeof childBookBaskets.$inferSelect;

export const basketItems = pgTable("basket_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  basketId: uuid("basket_id").references(() => childBookBaskets.id, { onDelete: "cascade" }).notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertBasketItemSchema = createInsertSchema(basketItems).omit({ id: true });
export type InsertBasketItem = z.infer<typeof insertBasketItemSchema>;
export type BasketItem = typeof basketItems.$inferSelect;

export const bookPayments = pgTable("book_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parentIdentifier: text("parent_identifier").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank_transfer"),
  paymentReference: text("payment_reference").unique().notNull(),
  status: text("status").default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  confirmedAt: timestamp("confirmed_at"),
});

export const insertBookPaymentSchema = createInsertSchema(bookPayments).omit({ id: true, paidAt: true, confirmedAt: true });
export type InsertBookPayment = z.infer<typeof insertBookPaymentSchema>;
export type BookPayment = typeof bookPayments.$inferSelect;

export const basketPayments = pgTable("basket_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  basketId: uuid("basket_id").references(() => childBookBaskets.id, { onDelete: "cascade" }).notNull(),
  paymentId: uuid("payment_id").references(() => bookPayments.id, { onDelete: "cascade" }).notNull(),
});

export const financeBookAllocations = pgTable("finance_book_allocations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  bookId: uuid("book_id").references(() => books.id).notNull(),
  basketId: uuid("basket_id").references(() => childBookBaskets.id),
  status: text("status").default("allocated").notNull(),
  allocatedAt: timestamp("allocated_at").default(sql`now()`),
  receivedAt: timestamp("received_at"),
});

export const insertAllocationSchema = createInsertSchema(financeBookAllocations).omit({ id: true, allocatedAt: true, receivedAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type FinanceBookAllocation = typeof financeBookAllocations.$inferSelect;

export const bookInventoryTransactions = pgTable("book_inventory_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "cascade" }).notNull(),
  transactionType: text("transaction_type").notNull(),
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertInventoryTransactionSchema = createInsertSchema(bookInventoryTransactions).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type BookInventoryTransaction = typeof bookInventoryTransactions.$inferSelect;
