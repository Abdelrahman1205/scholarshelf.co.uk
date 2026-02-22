# EduBook: Business Pitch Technical Report

## 1. Executive Summary
EduBook is a comprehensive, full-stack school book management and distribution platform. It digitizes the entire lifecycle of textbook management—from inventory procurement to parent payments and final classroom distribution.

## 2. Core Stakeholder Modules

### A. Administrative Console (The Brain)
*   **Inventory Management**: Full catalog control with real-time stock tracking, low-stock alerts, and automated reorder threshold monitoring.
*   **User Management**: Role-based access control (RBAC) for Admins, Teachers, and Parents.
*   **Academic Structure**: Management of school levels, classes (fully localized: براعم through GCSE), and student profiles.
*   **Book Bundling**: Logic for grouping books into "Book Levels" assigned to specific academic years/classes.
*   **Financial Oversight**: Real-time payment verification dashboard for bank transfer references and payment status tracking.

### B. Teacher Portal (The Last Mile)
*   **Class Selection**: Automatic filtering to show only students in the teacher's assigned class.
*   **Digital Distribution Receipt**: One-click confirmation of physical book handover to students, providing a clear audit trail.
*   **Real-time Stats**: Visual progress bars showing distribution completion percentages for their class.

### C. Parent Portal (The Experience)
*   **Child Linking**: Secure linking mechanism using unique, school-generated codes or QR codes.
*   **Automated Baskets**: One-click generation of required book lists based on the child's class assignment.
*   **Seamless Payments**: Integrated bank transfer flow with auto-generated unique payment references for easy reconciliation.

## 3. Key Technical Features
*   **Barcode Integration**: Built-in ISBN scanning via device camera for rapid book entry and lookup.
*   **QR Code Support**: Instant parent-child linking via generated QR codes.
*   **Session-Based Security**: Secure authentication using industry-standard bcrypt hashing and encrypted session management.
*   **Responsive Design**: Modern, mobile-first interface built with Tailwind CSS v4 and shadcn/ui.

## 4. Technical Architecture
*   **Frontend**: React 19 / Vite / TanStack Query (for high-speed data fetching).
*   **Backend**: Express 5 on Node.js (High-performance API layer).
*   **Database**: PostgreSQL with Drizzle ORM (Type-safe, relational data integrity).
*   **Deployment**: Cloud-ready architecture with low infrastructure overhead.

## 5. Value Proposition
*   **Efficiency**: Reduces manual paperwork by 90%.
*   **Accuracy**: Eliminates manual entry errors via barcode scanning.
*   **Transparency**: Provides parents with clear pricing and schools with instant financial reports.
