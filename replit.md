# EduBook - School Book Management System

## Overview
A comprehensive school book management and distribution platform that handles the entire lifecycle of textbooks within educational institutions. Connects three groups: school staff (admin), teachers, and parents.

## Recent Changes
- 2026-05-02: Payment system overhauled — fixed paidAt bug, added externalPaymentId/externalPaymentStatus/notes columns, rebuilt admin PaymentsTab with revenue summary cards, filtering, detail dialog, and external ID column
- 2026-05-02: Created server/paymentIntegration.ts — clean plug-in layer for external school management system API (PUSH + webhook PULL flows)
- 2026-05-02: Added POST /api/webhooks/payment-update — external system can auto-confirm/reject payments via webhook with HMAC-SHA256 signature verification
- 2026-05-02: Added GET /api/admin/integration-status — shows whether external integration is active
- 2026-05-02: Created EXTERNAL_API_INTEGRATION_SPEC.md — full API spec for AntiGravity team
- 2026-02-22: Added Users management tab (admin can create/edit/delete teacher, parent, admin accounts)
- 2026-02-22: Added teacher-to-class assignment (teacherId on classes, teacher dropdown in class management)
- 2026-02-22: Teacher dashboard auto-selects assigned class on login
- 2026-02-22: Added Classes and Students management tabs with full CRUD
- 2026-02-21: Added role-based authentication with login/logout, session management, and protected routes
- 2026-02-21: Initial build with full-stack architecture. Database schema, API routes, and all three role-based dashboards implemented.

## Architecture
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui components + wouter routing
- **Backend**: Express 5 on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: bcrypt password hashing + express-session + connect-pg-simple session store
- **State Management**: TanStack React Query
- **Styling**: Custom design system with Outfit (headings) + Inter (body) fonts

## Key Files
- `shared/schema.ts` - All database table definitions (users + 11 domain tables)
- `server/storage.ts` - Database storage layer with all CRUD operations
- `server/routes.ts` - All API endpoints with role-based middleware
- `server/index.ts` - Express setup with session middleware
- `client/src/hooks/use-auth.ts` - Auth hook (login/logout/session)
- `client/src/pages/login.tsx` - Login page with demo account buttons
- `client/src/pages/admin.tsx` - Admin dashboard (9 tabs: Users, Classes, Students, Books, Inventory, Levels, Codes, Payments, Allocations)
- `client/src/pages/teacher.tsx` - Teacher portal (class selector, receipt confirmation)
- `client/src/pages/parent.tsx` - Parent portal (baskets, link child, payment history)
- `client/src/components/layout.tsx` - Shared sidebar layout with user info + logout

## Database Tables
users, classes, students, books, book_levels, book_level_items, class_book_levels, child_linking_codes, parent_children, child_book_baskets, basket_items, book_payments, basket_payments, finance_book_allocations, book_inventory_transactions

## Authentication
- Session-based auth using express-session + PostgreSQL session store
- Roles: admin, teacher, parent
- Default demo accounts: admin/admin123, teacher/teacher123, parent/parent123
- All API routes protected with requireAuth/requireRole middleware
- Parent flows use session user's email instead of localStorage

## Core Flow
1. Admin creates books → bundles into book levels → assigns to classes
2. Admin creates students and generates linking codes (emailed to parents)
3. Parent uses linking code to connect to child
4. Parent generates book basket (auto-populated from class assignment)
5. Parent submits payment (bank transfer with auto-generated reference)
6. Admin confirms payment → books allocated to student → stock adjusted
7. Teacher confirms physical receipt of books per student

## User Preferences
- Linking codes auto-emailed to parents (email integration planned)
