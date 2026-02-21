# EduBook - School Book Management System

## Overview
A comprehensive school book management and distribution platform that handles the entire lifecycle of textbooks within educational institutions. Connects three groups: school staff (admin), teachers, and parents.

## Recent Changes
- 2026-02-21: Initial build with full-stack architecture. Database schema, API routes, and all three role-based dashboards implemented.

## Architecture
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui components + wouter routing
- **Backend**: Express 5 on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query
- **Styling**: Custom design system with Outfit (headings) + Inter (body) fonts

## Key Files
- `shared/schema.ts` - All database table definitions (11 tables)
- `server/storage.ts` - Database storage layer with all CRUD operations
- `server/routes.ts` - All API endpoints
- `client/src/pages/admin.tsx` - Admin dashboard (6 tabs: Books, Inventory, Levels, Codes, Payments, Allocations)
- `client/src/pages/teacher.tsx` - Teacher portal (class selector, receipt confirmation)
- `client/src/pages/parent.tsx` - Parent portal (baskets, link child, payment history)
- `client/src/components/layout.tsx` - Shared sidebar layout

## Database Tables
classes, students, books, book_levels, book_level_items, class_book_levels, child_linking_codes, parent_children, child_book_baskets, basket_items, book_payments, basket_payments, finance_book_allocations, book_inventory_transactions

## Core Flow
1. Admin creates books → bundles into book levels → assigns to classes
2. Admin creates students and generates linking codes (emailed to parents)
3. Parent uses linking code to connect to child
4. Parent generates book basket (auto-populated from class assignment)
5. Parent submits payment (bank transfer with auto-generated reference)
6. Admin confirms payment → books allocated to student → stock adjusted
7. Teacher confirms physical receipt of books per student

## User Preferences
- No authentication system (standalone, role-switching via sidebar)
- Parent identified by email stored in localStorage
- Linking codes auto-emailed to parents (email integration planned)
