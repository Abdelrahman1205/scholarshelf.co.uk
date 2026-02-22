import { eq, and, lt, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export interface IStorage {
  getBooks(): Promise<schema.Book[]>;
  getBook(id: string): Promise<schema.Book | undefined>;
  getBookByIsbn(isbn: string): Promise<schema.Book | undefined>;
  createBook(book: schema.InsertBook): Promise<schema.Book>;
  updateBook(id: string, book: Partial<schema.InsertBook>): Promise<schema.Book | undefined>;
  deleteBook(id: string): Promise<void>;
  getLowStockBooks(): Promise<schema.Book[]>;
  adjustStock(bookId: string, quantity: number, type: string, reason?: string): Promise<schema.Book>;
  getInventoryTransactions(): Promise<schema.BookInventoryTransaction[]>;

  getClasses(): Promise<schema.Class[]>;
  createClass(c: schema.InsertClass): Promise<schema.Class>;
  updateClass(id: string, c: Partial<schema.InsertClass>): Promise<schema.Class | undefined>;
  deleteClass(id: string): Promise<void>;

  getStudents(): Promise<schema.Student[]>;
  getStudentsByClass(classId: string): Promise<schema.Student[]>;
  createStudent(s: schema.InsertStudent): Promise<schema.Student>;
  updateStudent(id: string, s: Partial<schema.InsertStudent>): Promise<schema.Student | undefined>;
  deleteStudent(id: string): Promise<void>;

  getBookLevels(): Promise<schema.BookLevel[]>;
  createBookLevel(bl: schema.InsertBookLevel): Promise<schema.BookLevel>;
  updateBookLevel(id: string, bl: Partial<schema.InsertBookLevel>): Promise<schema.BookLevel | undefined>;
  deleteBookLevel(id: string): Promise<void>;
  getBookLevelItems(bookLevelId: string): Promise<(schema.BookLevelItem & { book?: schema.Book })[]>;
  addBookLevelItem(item: schema.InsertBookLevelItem): Promise<schema.BookLevelItem>;
  removeBookLevelItem(id: string): Promise<void>;

  getClassBookLevels(): Promise<(schema.ClassBookLevel & { class?: schema.Class; bookLevel?: schema.BookLevel })[]>;
  assignClassBookLevel(cbl: schema.InsertClassBookLevel): Promise<schema.ClassBookLevel>;

  getLinkingCodes(): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class })[]>;
  createLinkingCode(code: schema.InsertChildLinkingCode): Promise<schema.ChildLinkingCode>;
  useLinkingCode(code: string, parentIdentifier: string): Promise<{ student: schema.Student; linkingCode: schema.ChildLinkingCode } | null>;

  getParentChildren(parentIdentifier: string): Promise<(schema.ParentChild & { student?: schema.Student & { class?: schema.Class } })[]>;

  generateBasket(studentId: string, parentIdentifier: string): Promise<schema.ChildBookBasket>;
  getBaskets(parentIdentifier?: string): Promise<any[]>;
  getBasket(id: string): Promise<any>;

  createPayment(payment: schema.InsertBookPayment, basketIds: string[]): Promise<schema.BookPayment>;
  getPayments(parentIdentifier?: string): Promise<schema.BookPayment[]>;
  confirmPayment(paymentId: string): Promise<schema.BookPayment>;
  rejectPayment(paymentId: string): Promise<schema.BookPayment>;

  getAllocations(classId?: string): Promise<any[]>;
  confirmReceipt(allocationId: string): Promise<schema.FinanceBookAllocation>;

  getUsers(): Promise<schema.User[]>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  getUserById(id: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: string, user: Partial<schema.InsertUser>): Promise<schema.User | undefined>;
  deleteUser(id: string): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getBooks(): Promise<schema.Book[]> {
    return db.select().from(schema.books);
  }

  async getBook(id: string): Promise<schema.Book | undefined> {
    const [book] = await db.select().from(schema.books).where(eq(schema.books.id, id));
    return book;
  }

  async getBookByIsbn(isbn: string): Promise<schema.Book | undefined> {
    const [book] = await db.select().from(schema.books).where(eq(schema.books.isbn, isbn));
    return book;
  }

  async createBook(book: schema.InsertBook): Promise<schema.Book> {
    const [created] = await db.insert(schema.books).values(book).returning();
    return created;
  }

  async updateBook(id: string, book: Partial<schema.InsertBook>): Promise<schema.Book | undefined> {
    const [updated] = await db.update(schema.books).set(book).where(eq(schema.books.id, id)).returning();
    return updated;
  }

  async deleteBook(id: string): Promise<void> {
    await db.delete(schema.books).where(eq(schema.books.id, id));
  }

  async getLowStockBooks(): Promise<schema.Book[]> {
    return db.select().from(schema.books).where(
      and(
        eq(schema.books.isActive, true),
        sql`${schema.books.stockQuantity} < ${schema.books.lowStockThreshold}`
      )
    );
  }

  async adjustStock(bookId: string, quantity: number, type: string, reason?: string): Promise<schema.Book> {
    const book = await this.getBook(bookId);
    if (!book) throw new Error("Book not found");
    
    const prev = book.stockQuantity ?? 0;
    let newQty: number;
    
    if (type === "purchase" || type === "return" || type === "adjustment") {
      newQty = prev + quantity;
    } else if (type === "damage" || type === "allocation") {
      newQty = prev - quantity;
    } else {
      newQty = prev + quantity;
    }
    
    if (newQty < 0) throw new Error("Stock cannot go below zero");

    await db.insert(schema.bookInventoryTransactions).values({
      bookId,
      transactionType: type,
      quantity,
      previousQuantity: prev,
      newQuantity: newQty,
    reason,
    });

    const [updated] = await db.update(schema.books).set({ stockQuantity: newQty }).where(eq(schema.books.id, bookId)).returning();
    return updated;
  }

  async getInventoryTransactions(): Promise<schema.BookInventoryTransaction[]> {
    return db.select().from(schema.bookInventoryTransactions).orderBy(desc(schema.bookInventoryTransactions.createdAt));
  }

  async getClasses(): Promise<schema.Class[]> {
    return db.select().from(schema.classes);
  }

  async createClass(c: schema.InsertClass): Promise<schema.Class> {
    const [created] = await db.insert(schema.classes).values(c).returning();
    return created;
  }

  async updateClass(id: string, c: Partial<schema.InsertClass>): Promise<schema.Class | undefined> {
    const [updated] = await db.update(schema.classes).set(c).where(eq(schema.classes.id, id)).returning();
    return updated;
  }

  async deleteClass(id: string): Promise<void> {
    await db.delete(schema.classes).where(eq(schema.classes.id, id));
  }

  async getStudents(): Promise<schema.Student[]> {
    return db.select().from(schema.students);
  }

  async getStudentsByClass(classId: string): Promise<schema.Student[]> {
    return db.select().from(schema.students).where(eq(schema.students.classId, classId));
  }

  async createStudent(s: schema.InsertStudent): Promise<schema.Student> {
    const code = `STU-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const [created] = await db.insert(schema.students).values({ ...s, studentCode: code }).returning();
    return created;
  }

  async updateStudent(id: string, s: Partial<schema.InsertStudent>): Promise<schema.Student | undefined> {
    const [updated] = await db.update(schema.students).set(s).where(eq(schema.students.id, id)).returning();
    return updated;
  }

  async deleteStudent(id: string): Promise<void> {
    await db.delete(schema.students).where(eq(schema.students.id, id));
  }

  async getBookLevels(): Promise<schema.BookLevel[]> {
    return db.select().from(schema.bookLevels);
  }

  async createBookLevel(bl: schema.InsertBookLevel): Promise<schema.BookLevel> {
    const [created] = await db.insert(schema.bookLevels).values(bl).returning();
    return created;
  }

  async updateBookLevel(id: string, bl: Partial<schema.InsertBookLevel>): Promise<schema.BookLevel | undefined> {
    const [updated] = await db.update(schema.bookLevels).set(bl).where(eq(schema.bookLevels.id, id)).returning();
    return updated;
  }

  async deleteBookLevel(id: string): Promise<void> {
    await db.delete(schema.bookLevels).where(eq(schema.bookLevels.id, id));
  }

  async getBookLevelItems(bookLevelId: string): Promise<(schema.BookLevelItem & { book?: schema.Book })[]> {
    const items = await db.select().from(schema.bookLevelItems).where(eq(schema.bookLevelItems.bookLevelId, bookLevelId));
    const result = [];
    for (const item of items) {
      const book = await this.getBook(item.bookId);
      result.push({ ...item, book });
    }
    return result;
  }

  async addBookLevelItem(item: schema.InsertBookLevelItem): Promise<schema.BookLevelItem> {
    const [created] = await db.insert(schema.bookLevelItems).values(item).returning();
    return created;
  }

  async removeBookLevelItem(id: string): Promise<void> {
    await db.delete(schema.bookLevelItems).where(eq(schema.bookLevelItems.id, id));
  }

  async getClassBookLevels(): Promise<(schema.ClassBookLevel & { class?: schema.Class; bookLevel?: schema.BookLevel })[]> {
    const cbls = await db.select().from(schema.classBookLevels);
    const result = [];
    for (const cbl of cbls) {
      const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, cbl.classId));
      const [bl] = await db.select().from(schema.bookLevels).where(eq(schema.bookLevels.id, cbl.bookLevelId));
      result.push({ ...cbl, class: cls, bookLevel: bl });
    }
    return result;
  }

  async assignClassBookLevel(cbl: schema.InsertClassBookLevel): Promise<schema.ClassBookLevel> {
    const [created] = await db.insert(schema.classBookLevels).values(cbl).returning();
    return created;
  }

  async getLinkingCodes(): Promise<(schema.ChildLinkingCode & { student?: schema.Student; class?: schema.Class })[]> {
    const codes = await db.select().from(schema.childLinkingCodes);
    const result = [];
    for (const code of codes) {
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, code.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...code, student, class: cls });
    }
    return result;
  }

  async createLinkingCode(codeData: schema.InsertChildLinkingCode): Promise<schema.ChildLinkingCode> {
    const [created] = await db.insert(schema.childLinkingCodes).values(codeData).returning();
    return created;
  }

  async useLinkingCode(code: string, parentIdentifier: string): Promise<{ student: schema.Student; linkingCode: schema.ChildLinkingCode } | null> {
    const [linkingCode] = await db.select().from(schema.childLinkingCodes).where(
      and(eq(schema.childLinkingCodes.code, code), eq(schema.childLinkingCodes.isUsed, false))
    );
    if (!linkingCode) return null;

    const [student] = await db.select().from(schema.students).where(eq(schema.students.id, linkingCode.studentId));
    if (!student) return null;

    await db.update(schema.childLinkingCodes).set({ isUsed: true, linkedAt: new Date() }).where(eq(schema.childLinkingCodes.id, linkingCode.id));

    await db.insert(schema.parentChildren).values({ parentIdentifier, studentId: student.id });

    return { student, linkingCode: { ...linkingCode, isUsed: true, linkedAt: new Date() } };
  }

  async getParentChildren(parentIdentifier: string): Promise<(schema.ParentChild & { student?: schema.Student & { class?: schema.Class } })[]> {
    const links = await db.select().from(schema.parentChildren).where(eq(schema.parentChildren.parentIdentifier, parentIdentifier));
    const result = [];
    for (const link of links) {
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, link.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...link, student: student ? { ...student, class: cls } : undefined });
    }
    return result;
  }

  async generateBasket(studentId: string, parentIdentifier: string): Promise<schema.ChildBookBasket> {
    const [student] = await db.select().from(schema.students).where(eq(schema.students.id, studentId));
    if (!student || !student.classId) throw new Error("Student or class not found");

    const classLevels = await db.select().from(schema.classBookLevels).where(eq(schema.classBookLevels.classId, student.classId));
    if (classLevels.length === 0) throw new Error("No book level assigned to this class");

    const allItems: { bookId: string; quantity: number; unitPrice: string }[] = [];
    for (const cl of classLevels) {
      const levelItems = await this.getBookLevelItems(cl.bookLevelId);
      for (const item of levelItems) {
        if (item.book && item.book.isActive) {
          allItems.push({
            bookId: item.bookId,
            quantity: item.quantity ?? 1,
            unitPrice: item.book.price,
          });
        }
      }
    }

    if (allItems.length === 0) throw new Error("No books found in the assigned level");

    let total = 0;
    for (const item of allItems) {
      total += parseFloat(item.unitPrice) * item.quantity;
    }

    const [basket] = await db.insert(schema.childBookBaskets).values({
      studentId,
      parentIdentifier,
      status: "pending",
      totalAmount: total.toFixed(2),
    }).returning();

    for (const item of allItems) {
      const tp = parseFloat(item.unitPrice) * item.quantity;
      await db.insert(schema.basketItems).values({
        basketId: basket.id,
        bookId: item.bookId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: tp.toFixed(2),
      });
    }

    return basket;
  }

  async getBaskets(parentIdentifier?: string): Promise<any[]> {
    let baskets;
    if (parentIdentifier) {
      baskets = await db.select().from(schema.childBookBaskets).where(eq(schema.childBookBaskets.parentIdentifier, parentIdentifier));
    } else {
      baskets = await db.select().from(schema.childBookBaskets);
    }

    const result = [];
    for (const basket of baskets) {
      const items = await db.select().from(schema.basketItems).where(eq(schema.basketItems.basketId, basket.id));
      const itemsWithBooks = [];
      for (const item of items) {
        const book = await this.getBook(item.bookId);
        itemsWithBooks.push({ ...item, book });
      }
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, basket.studentId));
      let cls;
      if (student?.classId) {
        [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...basket, items: itemsWithBooks, student: student ? { ...student, class: cls } : undefined });
    }
    return result;
  }

  async getBasket(id: string): Promise<any> {
    const [basket] = await db.select().from(schema.childBookBaskets).where(eq(schema.childBookBaskets.id, id));
    if (!basket) return null;
    const items = await db.select().from(schema.basketItems).where(eq(schema.basketItems.basketId, basket.id));
    const itemsWithBooks = [];
    for (const item of items) {
      const book = await this.getBook(item.bookId);
      itemsWithBooks.push({ ...item, book });
    }
    return { ...basket, items: itemsWithBooks };
  }

  async createPayment(payment: schema.InsertBookPayment, basketIds: string[]): Promise<schema.BookPayment> {
    const [created] = await db.insert(schema.bookPayments).values(payment).returning();
    for (const basketId of basketIds) {
      await db.insert(schema.basketPayments).values({ basketId, paymentId: created.id });
      await db.update(schema.childBookBaskets).set({ status: "paid" }).where(eq(schema.childBookBaskets.id, basketId));
    }
    return created;
  }

  async getPayments(parentIdentifier?: string): Promise<schema.BookPayment[]> {
    if (parentIdentifier) {
      return db.select().from(schema.bookPayments).where(eq(schema.bookPayments.parentIdentifier, parentIdentifier)).orderBy(desc(schema.bookPayments.paidAt));
    }
    return db.select().from(schema.bookPayments).orderBy(desc(schema.bookPayments.paidAt));
  }

  async confirmPayment(paymentId: string): Promise<schema.BookPayment> {
    const [payment] = await db.update(schema.bookPayments).set({ status: "completed", confirmedAt: new Date() }).where(eq(schema.bookPayments.id, paymentId)).returning();

    const bps = await db.select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await db.update(schema.childBookBaskets).set({ status: "allocated" }).where(eq(schema.childBookBaskets.id, bp.basketId));
      
      const basket = await this.getBasket(bp.basketId);
      if (basket) {
        for (const item of basket.items) {
          await db.insert(schema.financeBookAllocations).values({
            studentId: basket.studentId,
            bookId: item.bookId,
            basketId: basket.id,
            status: "allocated",
          });
          try {
            await this.adjustStock(item.bookId, item.quantity, "allocation", `Allocated to student via payment ${paymentId}`);
          } catch (e) {
          }
        }
      }
    }

    return payment;
  }

  async rejectPayment(paymentId: string): Promise<schema.BookPayment> {
    const [payment] = await db.update(schema.bookPayments).set({ status: "failed" }).where(eq(schema.bookPayments.id, paymentId)).returning();
    const bps = await db.select().from(schema.basketPayments).where(eq(schema.basketPayments.paymentId, paymentId));
    for (const bp of bps) {
      await db.update(schema.childBookBaskets).set({ status: "pending" }).where(eq(schema.childBookBaskets.id, bp.basketId));
    }
    return payment;
  }

  async getAllocations(classId?: string): Promise<any[]> {
    const allocs = await db.select().from(schema.financeBookAllocations);
    const result = [];
    for (const alloc of allocs) {
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, alloc.studentId));
      const book = await this.getBook(alloc.bookId);
      if (classId && student?.classId !== classId) continue;
      let cls;
      if (student?.classId) {
        [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, student.classId));
      }
      result.push({ ...alloc, student: student ? { ...student, class: cls } : undefined, book });
    }
    return result;
  }

  async confirmReceipt(allocationId: string): Promise<schema.FinanceBookAllocation> {
    const [updated] = await db.update(schema.financeBookAllocations)
      .set({ status: "received", receivedAt: new Date() })
      .where(eq(schema.financeBookAllocations.id, allocationId))
      .returning();
    return updated;
  }

  async getUsers(): Promise<schema.User[]> {
    return db.select().from(schema.users);
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async getUserById(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [created] = await db.insert(schema.users).values(user).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<schema.InsertUser>): Promise<schema.User | undefined> {
    const [updated] = await db.update(schema.users).set(user).where(eq(schema.users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }
}

export const storage = new DatabaseStorage();
