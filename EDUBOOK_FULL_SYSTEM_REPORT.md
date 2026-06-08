# EduBook — Full System Report
### Every Feature, Function, and Technical Detail

---

## 1. System Overview

**EduBook** is a full-stack web application built to manage the complete lifecycle of school textbook distribution. It connects three groups of users — Administrators, Teachers, and Parents — in a single, role-controlled platform.

**Problem it solves:**
- Schools lose revenue when books are handed out before payment is confirmed
- Staff waste hours cross-checking paper lists, bank statements, and book stock
- Parents have no clear way to know what to buy, how much to pay, or when books are ready

**How it solves it:**
- No book can be handed out without a confirmed payment — the system enforces this automatically
- All stock, payments, and distributions are tracked in real time
- Parents get a guided, self-service experience with clear instructions

---

## 2. User Roles & Access Control

The system uses **Role-Based Access Control (RBAC)**. Every user has exactly one role, and each role has hard boundaries.

| Role | Access Level |
|------|-------------|
| **Admin** | Full system control — all 9 tabs, all data |
| **Teacher** | Class-specific view — can only see their assigned class and confirm book handover |
| **Parent** | Child-specific view — can only see their own children, baskets, and payments |

**Authentication details:**
- Session-based login using HTTP-only encrypted cookies
- Passwords stored as **bcrypt hashes** (industry standard, never stored as plain text)
- Sessions stored in PostgreSQL (survives server restarts)
- All API routes protected — unauthenticated requests return 401 Unauthorized
- Wrong-role requests return 403 Forbidden

**Default demo accounts:**
- `admin` / `admin123`
- `teacher` / `teacher123`
- `parent` / `parent123`

---

## 3. Admin Console — 9 Tabs

### Tab 1: Users
**Purpose:** Manage all system accounts.

**Features:**
- View a list of all users (name, username, email, role badge)
- **Create new accounts** for teachers, parents, or additional admins
- **Edit any account** — update name, username, email, role, or reset password
- **Delete accounts** with a confirmation dialog to prevent accidental deletions
- Passwords are bcrypt-hashed automatically on creation and update
- Passwords are never exposed in the UI or API responses

---

### Tab 2: Classes
**Purpose:** Manage the school's academic structure.

**Features:**
- View all classes with their academic year and assigned teacher
- **Create classes** with name and academic year (e.g. "2025–2026")
- **Edit classes** — update name, year, or re-assign teacher
- **Delete classes** with confirmation
- **Assign a teacher** to each class from a dropdown of teacher accounts
- Pre-configured for the school's 11 specific classes:
  براعم, تمهيدي أ, تمهيدي ب, أول, ثاني, ثالث, رابع, خامس, سادس, Pre GCSE, GCSE

---

### Tab 3: Students
**Purpose:** Manage student records.

**Features:**
- View all students with their name, class, and unique student code
- **Create students** — assign them to a class
- **Edit students** — update name or class assignment
- **Delete students** with confirmation
- Each student is automatically assigned a unique **Student Code** (e.g. `STU-A3B9`) on creation
- Student code can be used to identify the student in the parent linking flow

---

### Tab 4: Books
**Purpose:** Manage the school's book catalogue.

**Features:**
- View all books with title, author, ISBN, price, and stock level
- **Create books** manually with full details
- **ISBN Barcode Scanning** — click "Scan ISBN" to activate the device camera and scan any book's barcode
- **Automated Book Lookup** — after scanning, the system queries the Open Library API to auto-fill the book's title and author
- **Edit books** — update any field including price and stock thresholds
- **Delete books** with confirmation
- Books have an **Active/Inactive** toggle to exclude discontinued titles without deleting them
- Each book has:
  - `stockQuantity` — current units in stock
  - `lowStockThreshold` — triggers a low-stock alert when stock falls below this number
  - `reorderQuantity` — suggested order quantity
  - `price` — selling price shown to parents

---

### Tab 5: Inventory
**Purpose:** Track and adjust physical stock levels.

**Features:**
- View a full **transaction history** of every stock movement, including:
  - Type: Purchase, Return, Damage, Allocation, Adjustment
  - Before and after quantities
  - Reason text
  - Timestamp
- **Add stock manually** for any book (e.g. new delivery arrived)
- Stock is automatically decremented when a payment is confirmed (allocation)
- Low-stock books are highlighted with a warning

---

### Tab 6: Book Levels
**Purpose:** Group books into bundles per academic level.

**Features:**
- Create named "Book Levels" (e.g. "Year 3 Core Bundle")
- **Add books to a level** with a specified quantity per book
- **Remove books from a level**
- **Assign a Book Level to a Class** — once assigned, any student in that class will have those books in their basket
- One class can have multiple book levels assigned
- Ensures every student in the same class gets exactly the right books

---

### Tab 7: Linking Codes
**Purpose:** Securely connect parents to their children's profiles.

**Features:**
- View all generated linking codes with student name, class, parent email, and status (Pending / Linked)
- **Search** by student name, code, or parent email
- **Add Student & Send Code** — a single form that:
  1. Creates the student record
  2. Assigns them to a class
  3. Generates a unique 7-character alphanumeric linking code (e.g. `A7B-9X2Z`)
  4. Records the parent's email against the code
- **QR Code generation** — every linking code has a QR code that can be displayed on screen or downloaded as a PNG
- **Resend code** — generate a fresh code for the same student if the parent lost it
- Codes expire after 3 months if unused
- Each code can only be used once — once linked, it is marked as "Used"

---

### Tab 8: Payments
**Purpose:** Financial oversight and payment verification.

**Features:**
- **Revenue summary cards** at the top:
  - Total number of payments
  - Total pending amount (£) — money claimed but not yet verified
  - Total confirmed revenue (£) — money fully verified and books allocated
- **Filter buttons** — view All / Pending / Confirmed / Rejected payments instantly
- Full payment table showing: Date, Parent email, Reference code, Amount, Payment method, External System ID, Status
- **Click any row** to open a full detail dialog showing every field:
  - Parent identifier
  - Amount
  - Payment method
  - Status badge
  - Initiated timestamp
  - Confirmed timestamp
  - EduBook reference code
  - External System ID (from AntiGravity integration)
  - Notes from external system
- **Confirm payment** — marks as confirmed, automatically allocates books to the student, and decrements stock
- **Reject payment** — marks as rejected, returns the basket to "Pending" so the parent can re-attempt
- Confirmation can be done from the table row buttons or inside the detail dialog
- Toast notifications confirm every action

---

### Tab 9: Allocations
**Purpose:** Track which books are allocated to which students and monitor handover.

**Features:**
- View all book allocations with: student name, book title, status, allocation date, and receipt date
- Status: **Allocated** (payment confirmed, awaiting handover) or **Received** (teacher confirmed handover)
- This tab is the bridge between the financial flow and the physical classroom handover

---

## 4. Teacher Portal

**Purpose:** Enable teachers to confirm physical book distribution in the classroom.

**Features:**
- Upon login, the teacher's **assigned class is automatically selected** (based on class configuration)
- If not assigned to a class, a class selector dropdown is shown
- View a list of all students in the selected class
- For each student, see their book allocation status
- **One-click "Mark as Received"** — records that the student physically received their books
- The exact **date and time** of handover is automatically recorded
- Visual progress indicator showing how many students in the class have received their books
- Teachers **cannot see other classes' data** — they are limited strictly to their own class
- Teachers **cannot see financial data** — no access to payment amounts or parent information

---

## 5. Parent Portal

**Purpose:** Self-service platform for parents to manage their children's books and payments.

### Tab 1: Baskets
**Features:**
- View all book baskets for linked children
- Each basket shows:
  - Child's name and class
  - Itemised list of required books with quantities, unit prices, and totals
  - Grand total
- **"Proceed to Payment"** button for pending baskets
- **Payment dialog** opens and shows:
  - Child's name and class
  - Total amount due
  - School bank details (Sort Code, Account Number, Account Name)
  - A unique **Payment Reference** (e.g. `EDU-M2B7K-X9R3`) generated automatically
  - A prominent warning to use the exact reference when transferring
- Parent confirms they have made the transfer by clicking **"I've Made the Transfer"**
- The payment is recorded as "Pending" — awaiting admin verification
- Previously processed baskets are shown in a "Processed Orders" section
- **Create Book Basket** button for any linked child who doesn't have a basket yet

### Tab 2: Link Child
**Features:**
- Enter a linking code manually (e.g. `A7B-9X2Z`) to connect a child
- **QR Code scanning** via the device camera — point camera at the school's printed QR code
- Camera scanner can be closed at any time
- Error messages if camera permission is denied
- List of all currently linked children with their name, class, and student code
- Quick "Create Book Basket" button from the linked children list

### Tab 3: Payment History
**Features:**
- Full history of all past payment submissions
- Shows: Date, Amount, Payment Method, Reference Code, Status
- Status shown with colour-coded badges: Pending (amber), Confirmed (green), Rejected (red)

---

## 6. Payment Integration Layer

**Purpose:** Ready-to-activate connection to an external school management system's payment API.

**Current state:** Built and ready — activates automatically when API credentials are provided.

**How it works:**

### PUSH Flow (EduBook → External System)
When a parent initiates a payment, EduBook automatically calls the external API with:
- The EduBook payment reference
- Student name and class
- Parent email
- Total amount (GBP)
- Itemised book list

The external system returns its own `payment_id` which is stored against the EduBook payment record.

### PULL Flow (External System → EduBook via Webhook)
The external system calls `POST /api/webhooks/payment-update` to notify EduBook of a payment outcome:
- `status: "completed"` → auto-confirms the payment and allocates books instantly
- `status: "failed"` → auto-rejects and returns basket to pending

**Security:** Webhook calls are verified using HMAC-SHA256 signature on the request body.

**Activation:** Add two environment variables — `EXTERNAL_PAYMENT_API_URL` and `EXTERNAL_PAYMENT_API_KEY`. No code changes needed.

**Integration spec document:** `EXTERNAL_API_INTEGRATION_SPEC.md` — complete technical document for the other development team.

---

## 7. Security Features

| Feature | Implementation |
|---------|----------------|
| Password hashing | bcrypt with 10 salt rounds |
| Session management | express-session with PostgreSQL store |
| Session cookies | HTTP-only, preventing JavaScript access |
| Role enforcement | Every API route checks role before responding |
| Webhook verification | HMAC-SHA256 signature check |
| Input validation | Zod schemas on all API inputs |
| Data isolation | Parents can only query their own email's data |

---

## 8. Database Structure

16 tables in PostgreSQL:

| Table | Purpose |
|-------|---------|
| `users` | All accounts (admin, teacher, parent) |
| `classes` | School classes with teacher assignment |
| `students` | Student records with class assignment |
| `books` | Book catalogue with stock and pricing |
| `book_levels` | Named bundles of books |
| `book_level_items` | Individual books within a level |
| `class_book_levels` | Which level is assigned to which class |
| `child_linking_codes` | Secure codes for parent-child linking |
| `parent_children` | Confirmed parent-to-student links |
| `child_book_baskets` | A student's required book list |
| `basket_items` | Individual items within a basket |
| `book_payments` | Payment records with status tracking |
| `basket_payments` | Links baskets to payments (many-to-one) |
| `finance_book_allocations` | Books reserved for students after payment |
| `book_inventory_transactions` | Full audit log of every stock movement |

---

## 9. Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 |
| Build tool | Vite |
| Routing | Wouter |
| Data fetching | TanStack React Query |
| UI components | shadcn/ui |
| Styling | Tailwind CSS v4 |
| Fonts | Outfit (headings) + Inter (body) |
| QR generation | qrcode.react |
| Barcode scanning | html5-qrcode |
| Backend | Express 5 on Node.js |
| Language | TypeScript (full-stack) |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Schema validation | Zod + drizzle-zod |
| Password hashing | bcrypt |
| Session store | connect-pg-simple |

---

## 10. Key Business Rules Enforced by the System

1. **No books without payment** — `confirmPayment()` is the only way to trigger allocation
2. **No double-spending** — linking codes can only be used once
3. **No stock going below zero** — the system throws an error if allocation would cause negative stock
4. **No unauthorised access** — every route is protected; parents only see their children's data
5. **Payment references are unique** — generated with timestamp + random component, stored with a database uniqueness constraint
6. **Stock is always accurate** — every movement (purchase, return, allocation, damage) is logged with before/after quantities
7. **Baskets reset on rejection** — if a payment is rejected, baskets return to "Pending" so the parent can re-submit

---

## 11. Files & Code Structure

```
/
├── client/src/
│   ├── pages/
│   │   ├── admin.tsx        — All 9 admin tabs (1,700 lines)
│   │   ├── teacher.tsx      — Teacher dashboard
│   │   ├── parent.tsx       — Parent portal (baskets, linking, history)
│   │   └── login.tsx        — Login page with demo account shortcuts
│   ├── components/
│   │   └── layout.tsx       — Sidebar layout with user info and logout
│   └── hooks/
│       └── use-auth.ts      — Authentication hook
├── server/
│   ├── index.ts             — Express setup, session middleware
│   ├── routes.ts            — All API endpoints
│   ├── storage.ts           — All database queries
│   └── paymentIntegration.ts — External API integration layer
├── shared/
│   └── schema.ts            — All database table definitions and types
├── EXTERNAL_API_INTEGRATION_SPEC.md  — API spec for integration partners
├── FINANCE_INTEGRATION_REPORT.md     — Finance integration roadmap
├── BUSINESS_PITCH_REPORT.md          — Business pitch document
└── SCREENSHOT_GUIDE.md               — Screenshot guide for pitch
```
