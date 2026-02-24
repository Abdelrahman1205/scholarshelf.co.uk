# EduBook: Finance & Accounting Integration Report

## 1. Project Overview
**EduBook** is a functional school book management system currently handling inventory, student-parent linking, and manual bank transfer verification. This report outlines the current state and the required "Finance Bit" for the next phase of development.

---

## 2. Current Functional State
*   **Inventory**: Full CRUD with barcode scanning (ISBN) and Open Library API integration.
*   **Academic Structure**: 11 classes (Baraem to GCSE) with "Book Level" bundling.
*   **User Roles**: Admin, Teacher, Parent with session-based RBAC.
*   **Payment Flow**: 
    1. Parent generates a basket.
    2. System generates a unique reference (e.g., `EDU-2026-X8Y`).
    3. Parent performs manual bank transfer.
    4. Admin manually confirms receipt in the dashboard.
    5. Inventory is auto-allocated upon confirmation.

---

## 3. Required Finance Integration (The "Finance Bit")

### A. Automated Bank Reconciliation
*   **Objective**: Replace manual admin verification with automated matching.
*   **Proposed Integration**: Connect to a Banking API (e.g., Plaid, TrueLayer, or local bank webhooks).
*   **Requirement**: The system must poll the bank account for incoming transfers matching the `Unique Reference Number` and auto-mark the payment as "Confirmed."

### B. Expense & Procurement Tracking
*   **New Module**: "Purchasing/Procurement."
*   **Features**:
    *   Log vendor invoices for book purchases.
    *   Track "Cost Price" vs. "Selling Price" for profit/loss reporting.
    *   Manage school-wide shipping and handling costs.

### C. Financial Reporting Dashboard
*   **New Module**: "Finance Analytics."
*   **Key Metrics**:
    *   **Total Revenue**: Cumulative confirmed payments.
    *   **Accounts Receivable**: Total value of "Pending" baskets.
    *   **Inventory Value**: Current stock levels multiplied by cost price.
    *   **Profit/Loss**: Difference between procurement costs and sales revenue.
    *   **Export**: Generate CSV/PDF reports for school accountants.

### D. Digital Receipts & Invoicing
*   **Feature**: Automated PDF generation.
*   **Requirement**: Once a payment is confirmed, the parent should be able to download a formal tax-compliant invoice/receipt from their portal.

---

## 4. Technical Specifications for Integration
*   **Database**: PostgreSQL (Current schema includes `book_payments`, `basket_payments`, and `finance_book_allocations`).
*   **Backend**: Node.js/Express.
*   **Frontend**: React (Tailwind v4).
*   **Finance Schema Expansion**: Need to add `vendor_invoices`, `book_costs`, and `financial_logs` tables.

---

## 5. Security & Compliance
*   **Data Privacy**: Financial records must be encrypted at rest.
*   **Audit Trail**: Every financial state change (Pending -> Confirmed) must log the timestamp and the performing user/system ID.
