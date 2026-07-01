/**
 * admin.tsx — thin router shell
 *
 * The actual section components live in ./admin/* — one file per section.
 * This file only decides which section to render based on the `section` prop.
 */
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { normalizeRole } from "./admin/shared";

// ─── Section components ────────────────────────────────────────────────────
import { DashboardSection }        from "./admin/dashboard";
import { SetupSection }             from "./admin/setup";
import {
  OwnerDashboardSection,
  OwnerPendingSetupsSection,
  OwnerAdminInvitesSection,
  OwnerEmailStatusSection,
  OwnerActivitySection,
  OwnerSettingsSection,
  OwnerSchoolDetailsSection,
  SchoolsSection,
}                                   from "./admin/owner";
import { UserDetailPanel, UsersSection } from "./admin/users";
import { ParentsSection }           from "./admin/parents";
import { ClassesSection }           from "./admin/classes";
import { StudentsSection }          from "./admin/students";
import { BooksSection }             from "./admin/books";
import { BookLevelsSection }        from "./admin/book-levels";
import { LinkingCodesSection }      from "./admin/linking-codes";
import { PaymentsSection }          from "./admin/payments";
import { AllocationsSection, ExtraRequestsSection } from "./admin/allocations";
import { CommunicationsSection }    from "./admin/communications";
import { BrandingSection }          from "./admin/branding";
import { ReportsSection }           from "./admin/reports";
import { FamiliesSection }          from "./admin/families";
import { DbConsoleSection }        from "./admin/db-console";
import { ItDashboardSection }      from "./admin/it-dashboard";

// Re-export UserDetailPanel so any external import still works
export { UserDetailPanel };

export default function AdminPage({ section }: { section: string }) {
  const { user } = useAuth();
  const normalizedRole = normalizeRole(user?.role);
  const requesterIsOwner = normalizeRole(user?.role) === "platform_owner";
  const inSupportMode = requesterIsOwner && (user as any)?.supportMode?.active;
  const isItPersonnel = normalizedRole === "it_personnel";

  const sections: Record<string, ReactNode> = {
    website:            <ItDashboardSection />,
    owner:              <OwnerDashboardSection />,
    schools:            <SchoolsSection />,
    "school-details":   <OwnerSchoolDetailsSection />,
    "pending-setups":   <OwnerPendingSetupsSection />,
    "admin-invites":    <OwnerAdminInvitesSection />,
    "email-status":     <OwnerEmailStatusSection />,
    activity:           <OwnerActivitySection />,
    "owner-settings":   <OwnerSettingsSection />,
    setup:              <SetupSection />,
    dashboard:          <DashboardSection />,
    books:              <BooksSection />,
    levels:             <BookLevelsSection />,
    classes:            <ClassesSection />,
    students:           <StudentsSection />,
    parents:            <ParentsSection />,
    families:           <FamiliesSection />,
    "db-console":       <DbConsoleSection />,
    codes:              <LinkingCodesSection />,
    payments:           <PaymentsSection />,
    allocations:        <AllocationsSection />,
    requests:           <ExtraRequestsSection />,
    communications:     <CommunicationsSection />,
    users:              <UsersSection />,
    branding:           <BrandingSection />,
    reports:            <ReportsSection />,
  };

  const ownerOnlySections = new Set([
    "owner", "schools", "school-details", "pending-setups",
    "admin-invites", "email-status", "activity", "owner-settings",
  ]);

  let resolvedSection = section;

  const itAllowedSections = new Set(["website", "communications", "branding"]);

  if (isItPersonnel) {
    if (section === "dashboard" || !itAllowedSections.has(section)) {
      resolvedSection = "website";
    }
  }

  if (ownerOnlySections.has(section) && !requesterIsOwner) {
    resolvedSection = "dashboard";
  }

  if (requesterIsOwner && !inSupportMode && !ownerOnlySections.has(section)) {
    resolvedSection = "owner";
  }

  if (inSupportMode && ownerOnlySections.has(section)) {
    resolvedSection = "dashboard";
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {sections[resolvedSection] || (isItPersonnel ? <ItDashboardSection /> : <DashboardSection />)}
    </div>
  );
}
