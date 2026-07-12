/**
 * admin.tsx — thin router shell
 *
 * The actual section components live in ./admin/* — one file per section.
 * This file only decides which section to render based on the `section` prop.
 */
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { normalizeRole, navigateTo } from "./admin/shared";

// Retired routes → their family-first replacements (spec §10 redirects).
const RETIRED_SECTION_REDIRECTS: Record<string, string> = {
  parents: "/admin/families",
};

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
import { FamilyEnrollmentSection }  from "./admin/family-enrollment";
import { DbConsoleSection }        from "./admin/db-console";
import { SystemHealthSection }     from "./admin/system-health";
import { ItDashboardSection }      from "./admin/it-dashboard";
import { WebsiteSection }           from "./admin/website";
import { MediaLibrarySection }      from "./admin/media-library";

// Re-export UserDetailPanel so any external import still works
export { UserDetailPanel };

export default function AdminPage({ section }: { section: string }) {
  const { user } = useAuth();
  const normalizedRole = normalizeRole(user?.role);
  const requesterIsOwner = normalizeRole(user?.role) === "platform_owner";
  const inSupportMode = requesterIsOwner && (user as any)?.supportMode?.active;
  const isItPersonnel = normalizedRole === "it_personnel";

  // Redirect retired routes to their replacements before rendering anything.
  const redirectTo = RETIRED_SECTION_REDIRECTS[section];
  useEffect(() => {
    if (redirectTo) navigateTo(redirectTo);
  }, [redirectTo]);
  if (redirectTo) return null;

  const sections: Record<string, ReactNode> = {
    website:            <ItDashboardSection />,
    "website-content":  <WebsiteSection />,
    media:              <MediaLibrarySection />,
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
    "family-enroll":    <FamilyEnrollmentSection />,
    "db-console":       <DbConsoleSection />,
    "system-health":    <SystemHealthSection />,
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
    "db-console", "system-health",
  ]);

  let resolvedSection = section;

  const itAllowedSections = new Set(["website", "website-content", "media", "branding"]);
  // The public-website control surface belongs to IT (and platform owners for
  // support). School admins run EduBook operations, not the website — so even a
  // direct URL to a website section is redirected to their dashboard.
  const websiteSections = new Set(["website", "website-content"]);

  if (isItPersonnel) {
    if (section === "dashboard" || !itAllowedSections.has(section)) {
      resolvedSection = "website";
    }
  } else if (websiteSections.has(section) && !requesterIsOwner) {
    resolvedSection = "dashboard";
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
