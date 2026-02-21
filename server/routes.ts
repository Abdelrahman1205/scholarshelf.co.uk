import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { storage } from "./storage";

function generateLinkingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    if (i === 3) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePaymentReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EDU-${ts}-${rand}`;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.session.role!)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === AUTH ===
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      res.json({ id: user.id, username: user.username, name: user.name, role: user.role, email: user.email });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role, email: user.email });
  });

  // === BOOKS ===
  app.get("/api/books", requireAuth, async (_req, res) => {
    const books = await storage.getBooks();
    res.json(books);
  });

  app.post("/api/books", requireRole("admin"), async (req, res) => {
    try {
      const book = await storage.createBook(req.body);
      res.status(201).json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/books/:id", requireRole("admin"), async (req, res) => {
    try {
      const book = await storage.updateBook(req.params.id, req.body);
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/books/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteBook(req.params.id);
    res.status(204).send();
  });

  app.get("/api/books/low-stock", requireRole("admin"), async (_req, res) => {
    const books = await storage.getLowStockBooks();
    res.json(books);
  });

  app.get("/api/books/by-isbn/:isbn", requireAuth, async (req, res) => {
    const book = await storage.getBookByIsbn(req.params.isbn);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  });

  // === INVENTORY ===
  app.post("/api/books/:id/stock", requireRole("admin"), async (req, res) => {
    try {
      const { quantity, type, reason } = req.body;
      const book = await storage.adjustStock(req.params.id, quantity, type, reason);
      res.json(book);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/inventory-transactions", requireRole("admin"), async (_req, res) => {
    const txns = await storage.getInventoryTransactions();
    res.json(txns);
  });

  // === CLASSES ===
  app.get("/api/classes", requireAuth, async (_req, res) => {
    const classes = await storage.getClasses();
    res.json(classes);
  });

  app.post("/api/classes", requireRole("admin"), async (req, res) => {
    try {
      const cls = await storage.createClass(req.body);
      res.status(201).json(cls);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === STUDENTS ===
  app.get("/api/students", requireRole("admin", "teacher"), async (_req, res) => {
    const students = await storage.getStudents();
    res.json(students);
  });

  app.post("/api/students", requireRole("admin"), async (req, res) => {
    try {
      const student = await storage.createStudent(req.body);
      res.status(201).json(student);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === BOOK LEVELS ===
  app.get("/api/book-levels", requireRole("admin"), async (_req, res) => {
    const levels = await storage.getBookLevels();
    res.json(levels);
  });

  app.post("/api/book-levels", requireRole("admin"), async (req, res) => {
    try {
      const level = await storage.createBookLevel(req.body);
      res.status(201).json(level);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/book-levels/:id", requireRole("admin"), async (req, res) => {
    const level = await storage.updateBookLevel(req.params.id, req.body);
    if (!level) return res.status(404).json({ message: "Book level not found" });
    res.json(level);
  });

  app.delete("/api/book-levels/:id", requireRole("admin"), async (req, res) => {
    await storage.deleteBookLevel(req.params.id);
    res.status(204).send();
  });

  app.get("/api/book-levels/:id/items", requireRole("admin"), async (req, res) => {
    const items = await storage.getBookLevelItems(req.params.id);
    res.json(items);
  });

  app.post("/api/book-levels/:id/items", requireRole("admin"), async (req, res) => {
    try {
      const item = await storage.addBookLevelItem({ ...req.body, bookLevelId: req.params.id });
      res.status(201).json(item);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/book-level-items/:id", requireRole("admin"), async (req, res) => {
    await storage.removeBookLevelItem(req.params.id);
    res.status(204).send();
  });

  // === CLASS BOOK LEVELS ===
  app.get("/api/class-book-levels", requireRole("admin"), async (_req, res) => {
    const cbls = await storage.getClassBookLevels();
    res.json(cbls);
  });

  app.post("/api/class-book-levels", requireRole("admin"), async (req, res) => {
    try {
      const cbl = await storage.assignClassBookLevel(req.body);
      res.status(201).json(cbl);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === LINKING CODES ===
  app.get("/api/linking-codes", requireRole("admin"), async (_req, res) => {
    const codes = await storage.getLinkingCodes();
    res.json(codes);
  });

  app.post("/api/students/:id/linking-code", requireRole("admin"), async (req, res) => {
    try {
      const { parentEmail } = req.body;
      const code = generateLinkingCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const linkingCode = await storage.createLinkingCode({
        studentId: req.params.id,
        code,
        parentEmail,
        expiresAt,
      });
      res.status(201).json(linkingCode);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === PARENT ENDPOINTS ===
  app.post("/api/parent/link-child", requireRole("parent"), async (req, res) => {
    try {
      const { code, parentIdentifier } = req.body;
      const result = await storage.useLinkingCode(code, parentIdentifier);
      if (!result) return res.status(404).json({ message: "Invalid or already used linking code" });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/children", requireRole("parent"), async (req, res) => {
    const parentIdentifier = req.query.parentIdentifier as string;
    if (!parentIdentifier) return res.status(400).json({ message: "parentIdentifier required" });
    const children = await storage.getParentChildren(parentIdentifier);
    res.json(children);
  });

  app.post("/api/parent/children/:id/basket", requireRole("parent"), async (req, res) => {
    try {
      const { parentIdentifier } = req.body;
      const basket = await storage.generateBasket(req.params.id, parentIdentifier);
      res.status(201).json(basket);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/baskets", requireRole("parent"), async (req, res) => {
    const parentIdentifier = req.query.parentIdentifier as string;
    if (!parentIdentifier) return res.status(400).json({ message: "parentIdentifier required" });
    const baskets = await storage.getBaskets(parentIdentifier);
    res.json(baskets);
  });

  app.post("/api/parent/payments", requireRole("parent"), async (req, res) => {
    try {
      const { basketIds, parentIdentifier, paymentMethod } = req.body;
      const baskets = [];
      let total = 0;
      for (const id of basketIds) {
        const basket = await storage.getBasket(id);
        if (!basket) return res.status(404).json({ message: `Basket ${id} not found` });
        baskets.push(basket);
        total += parseFloat(basket.totalAmount);
      }

      const reference = generatePaymentReference();
      const payment = await storage.createPayment({
        parentIdentifier,
        totalAmount: total.toFixed(2),
        paymentMethod: paymentMethod || "bank_transfer",
        paymentReference: reference,
        status: "pending",
      }, basketIds);

      res.status(201).json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/parent/payments", requireRole("parent"), async (req, res) => {
    const parentIdentifier = req.query.parentIdentifier as string;
    if (!parentIdentifier) return res.status(400).json({ message: "parentIdentifier required" });
    const payments = await storage.getPayments(parentIdentifier);
    res.json(payments);
  });

  // === ADMIN PAYMENTS ===
  app.get("/api/admin/payments", requireRole("admin"), async (_req, res) => {
    const payments = await storage.getPayments();
    res.json(payments);
  });

  app.post("/api/admin/payments/:id/confirm", requireRole("admin"), async (req, res) => {
    try {
      const payment = await storage.confirmPayment(req.params.id);
      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/payments/:id/reject", requireRole("admin"), async (req, res) => {
    try {
      const payment = await storage.rejectPayment(req.params.id);
      res.json(payment);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ALLOCATIONS ===
  app.get("/api/allocations", requireRole("admin", "teacher"), async (req, res) => {
    const classId = req.query.classId as string | undefined;
    const allocations = await storage.getAllocations(classId);
    res.json(allocations);
  });

  app.post("/api/allocations/:id/confirm-receipt", requireRole("teacher"), async (req, res) => {
    try {
      const allocation = await storage.confirmReceipt(req.params.id);
      res.json(allocation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === ALL BASKETS (admin) ===
  app.get("/api/admin/baskets", requireRole("admin"), async (_req, res) => {
    const baskets = await storage.getBaskets();
    res.json(baskets);
  });

  return httpServer;
}
