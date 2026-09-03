import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Database, BookOpen, GraduationCap, Users, Settings, LogOut, LayoutDashboard,
  Package, Layers, Key, CreditCard, BoxSelect, UserPlus, ShoppingCart,
  Link as LinkIcon, History, ClipboardList, Menu, X,
  ShieldAlert, ArrowLeft, MessageSquare, Palette, BarChart2, BarChart3, Bell, Globe, Activity,
  Image as ImageIcon, ShieldCheck, FileSpreadsheet,
} from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { contextLabel } from "@shared/contexts";
import { getQueryFn } from "@/lib/queryClient";
import { applyBrandingToDocument } from "@/lib/branding";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Settings;
  match?: string[];
  group?: string;
}

interface NotificationItem {
  key: string;
  label: string;
  count: number;
  href: string;
  severity: "info" | "warning" | "success";
}

interface NotificationSummary {
  totalUnread: number;
  items: NotificationItem[];
}

const roleConfig: Record<string, { label: string; navItems: NavItem[] }> = {
  owner: {
    label: "Platform",
    navItems: [
      { label: "Dashboard", href: "/admin/owner", icon: LayoutDashboard },
      { label: "Schools", href: "/admin/schools", icon: Settings },
      { label: "Pending Setups", href: "/admin/pending-setups", icon: ClipboardList },
      { label: "Admin Invites", href: "/admin/admin-invites", icon: UserPlus },
      { label: "Email Status", href: "/admin/email-status", icon: Key },
      { label: "Activity Logs", href: "/admin/activity", icon: History },
      { label: "Settings", href: "/admin/owner-settings", icon: Settings },
      { label: "System Health", href: "/admin/system-health", icon: Activity },
      { label: "DB Console", href: "/admin/db-console", icon: Database },
    ],
  },
  owner_support: {
    label: "School",
    navItems: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Books", href: "/admin/books", icon: BookOpen },
      { label: "Bundles", href: "/admin/levels", icon: Layers },
      { label: "Classes", href: "/admin/classes", icon: GraduationCap },
      { label: "Families", href: "/admin/families", icon: Users },
      { label: "New Enrollment", href: "/admin/family-enroll", icon: UserPlus },
      { label: "Parent Invites", href: "/admin/codes", icon: Key },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Collection Sheet", href: "/admin/collection-sheet", icon: ClipboardList },
      { label: "Reconciliation", href: "/admin/reconciliation", icon: ShieldAlert },
      { label: "Allocations", href: "/admin/allocations", icon: BoxSelect },
      { label: "Extra Requests", href: "/admin/requests", icon: ClipboardList },
      { label: "Communications", href: "/admin/communications", icon: MessageSquare },
      { label: "Reports", href: "/admin/reports", icon: BarChart2 },
      { label: "Users", href: "/admin/users", icon: UserPlus },
      { label: "Branding", href: "/admin/branding", icon: Palette },
    ],
  },
  admin: {
    label: "School Admin",
    navItems: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, group: "Overview" },
      { label: "Families", href: "/admin/families", icon: Users, group: "School Data" },
      { label: "New Enrollment", href: "/admin/family-enroll", icon: UserPlus, group: "School Data" },
      { label: "Classes", href: "/admin/classes", icon: GraduationCap, group: "School Data" },
      { label: "Books", href: "/admin/books", icon: BookOpen, group: "Books & Stock" },
      { label: "Bundles", href: "/admin/levels", icon: Layers, group: "Books & Stock" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, group: "Orders" },
      { label: "Collection Sheet", href: "/admin/collection-sheet", icon: ClipboardList, group: "Orders" },
      { label: "Reconciliation", href: "/admin/reconciliation", icon: ShieldAlert, group: "Orders" },
      { label: "Allocations", href: "/admin/allocations", icon: BoxSelect, group: "Orders" },
      { label: "Extra Requests", href: "/admin/requests", icon: ClipboardList, group: "Orders" },
      { label: "Communications", href: "/admin/communications", icon: MessageSquare, group: "Communication" },
      { label: "Parent Invites", href: "/admin/codes", icon: Key, group: "Communication" },
      { label: "Reports", href: "/admin/reports", icon: BarChart2, group: "Insights" },
      { label: "Users", href: "/admin/users", icon: UserPlus, group: "Admin" },
      { label: "Branding", href: "/admin/branding", icon: Palette, group: "Admin" },
    ],
  },
  it_personnel: {
    label: "IT Control",
    navItems: [
      { label: "Website Control", href: "/admin/website", icon: LayoutDashboard },
      { label: "Page Sections", href: "/admin/website-content", icon: Globe },
      { label: "Media Library", href: "/admin/media", icon: ImageIcon },
      { label: "Branding", href: "/admin/branding", icon: Palette },
    ],
  },
  teacher: {
    label: "Teacher",
    navItems: [
      { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
      { label: "Book Distribution", href: "/teacher/distribution", icon: Package },
      { label: "Extra Requests", href: "/teacher/requests", icon: ClipboardList },
      { label: "Messages", href: "/teacher/messages", icon: MessageSquare },
    ],
  },
  finance: {
    label: "Finance",
    navItems: [
      { label: "Dashboard", href: "/finance", icon: LayoutDashboard },
      { label: "Payment Review", href: "/finance/payments", icon: CreditCard },
      { label: "Stripe Payment Data", href: "/finance/stripe", icon: FileSpreadsheet },
      { label: "Reports", href: "/finance/reports", icon: BarChart3 },
    ],
  },
  parent: {
    label: "Parent Portal",
    navItems: [
      { label: "Dashboard", href: "/parent", icon: LayoutDashboard },
      { label: "Link Child", href: "/parent/link", icon: LinkIcon },
      { label: "Book Baskets", href: "/parent/baskets", icon: ShoppingCart },
      { label: "Payments", href: "/parent/payments", icon: CreditCard },
      { label: "Messages", href: "/parent/messages", icon: MessageSquare },
    ],
  },
};

function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function isNavActive(href: string, location: string): boolean {
  if (href === "/admin" || href === "/teacher" || href === "/parent" || href === "/finance") {
    return location === href;
  }
  return location.startsWith(href);
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, exitSupportMode, switchContext, isExitingSupport, isSwitchingContext } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastNotificationCount = useRef(0);

  const isOwner = user?.primaryRole === "owner" || user?.primaryRole === "platform_admin" || user?.role === "owner" || user?.role === "platform_admin";
  const inSupportMode = isOwner && user?.supportMode?.active;
  const availableContexts = user?.availableContexts || [];
  const activeContext = user?.activeContext || user?.role;

  const effectiveRole = inSupportMode
    ? "owner_support"
    : isOwner
      ? "owner"
      : activeContext === "school_admin" || activeContext === "admin"
        ? "admin"
        : activeContext;
  const isItPersonnelContext = activeContext === "it_personnel";

  const config = effectiveRole ? roleConfig[effectiveRole] : null;

  const shouldFetchSetupStatus = effectiveRole === "admin";
  const { data: setupStatus } = useQuery<any>({
    queryKey: ["/api/admin/setup-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: shouldFetchSetupStatus,
    staleTime: 30_000,
  });

  const adminSetupComplete = !!setupStatus?.operationalSetupCompleted && !!setupStatus?.schoolActive;

  const shouldFetchBranding = !isItPersonnelContext && (effectiveRole === "admin" || effectiveRole === "owner_support" || effectiveRole === "teacher" || effectiveRole === "parent" || effectiveRole === "finance");
  const { data: schoolBranding } = useQuery<any>({
    queryKey: ["/api/school/branding"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: shouldFetchBranding,
    staleTime: 60_000,
  });

  const { data: notificationSummary } = useQuery<NotificationSummary>({
    queryKey: ["/api/notifications/summary"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!shouldFetchBranding) {
      applyBrandingToDocument(null);
      return;
    }
    applyBrandingToDocument(schoolBranding || null);
  }, [shouldFetchBranding, schoolBranding]);

  useEffect(() => {
    const currentCount = notificationSummary?.totalUnread || 0;
    if (lastNotificationCount.current > 0 && currentCount > lastNotificationCount.current) {
      const delta = currentCount - lastNotificationCount.current;
      toast({
        title: "New notification",
        description: delta === 1
          ? "You have 1 new platform notification."
          : `You have ${delta} new platform notifications.`,
      });
    }
    lastNotificationCount.current = currentCount;
  }, [notificationSummary?.totalUnread, toast]);

  const navItems = (() => {
    if (!config) return [] as NavItem[];
    if (effectiveRole !== "admin") return config.navItems;

    const setupItem: NavItem = {
      label: adminSetupComplete ? "Setup Summary" : "Continue Setup",
      href: "/admin/setup",
      icon: Settings,
      // Joins "Overview" at the top while onboarding; joins "Admin" at the
      // bottom once complete — avoids a duplicate group header.
      group: adminSetupComplete ? "Admin" : "Overview",
    };

    return adminSetupComplete
      ? [...config.navItems, setupItem]
      : [setupItem, ...config.navItems];
  })();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const totalNotifications = notificationSummary?.totalUnread || 0;
  const notificationItems = notificationSummary?.items || [];
  const primaryNotificationHref = notificationItems[0]?.href;

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  async function handleExitSupport() {
    await exitSupportMode();
    navigateTo("/admin/owner");
  }

  async function handleSwitchContext(context: string, defaultPath: string) {
    await switchContext(context);
    navigateTo(defaultPath);
  }

  // Close mobile nav on location change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo / School branding */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-sidebar-border flex-shrink-0">
        {schoolBranding?.logoUrl ? (
          <img
            src={schoolBranding.logoUrl}
            alt="School logo"
            className="h-8 w-8 rounded-md object-contain flex-shrink-0 ring-1 ring-white/10"
          />
        ) : (
          <div className="h-8 w-8 rounded-md bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-4 w-4 text-sidebar-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-sidebar-accent-foreground truncate leading-tight">
            {schoolBranding?.schoolName || "ScholarShelf"}
          </div>
          <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest leading-tight mt-0.5">
            {inSupportMode ? "Support Mode" : "Book Management"}
          </div>
        </div>
      </div>

      {/* Support mode indicator */}
      {inSupportMode && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-amber-500/15 border border-amber-500/25">
          <div className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">Supporting</div>
          <div className="text-xs font-semibold text-amber-200 truncate mt-0.5">
            {user?.supportMode?.schoolName}
          </div>
        </div>
      )}

      {/* Context switcher for multi-role users */}
      {!inSupportMode && availableContexts.length > 1 && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-md bg-sidebar-accent border border-sidebar-border space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">View as</div>
          <div className="flex flex-col gap-1">
            {availableContexts.map((context) => {
              const selected = context.key === activeContext;
              return (
                <button
                  key={context.key}
                  disabled={selected || isSwitchingContext}
                  onClick={() => void handleSwitchContext(context.key, context.defaultPath)}
                  className={cn(
                    "text-left text-xs px-2 py-1.5 rounded transition-colors",
                    selected
                      ? "bg-sidebar-primary/20 text-sidebar-primary font-semibold"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/80"
                  )}
                >
                  {selected ? `✓ ${context.label}` : context.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-3 space-y-px overflow-y-auto">
        {/* Single top label only when items are NOT grouped (non-admin roles) */}
        {config && !navItems.some((i) => i.group) && (
          <div className="px-3 mb-2 text-[10px] uppercase tracking-widest font-medium text-sidebar-foreground/40">
            {config.label}
          </div>
        )}
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, location);
          const prevGroup = idx > 0 ? navItems[idx - 1].group : undefined;
          const showGroupHeader = item.group && item.group !== prevGroup;
          return (
            <div key={item.href}>
              {showGroupHeader && (
                <div className={cn(
                  "px-3 mb-0.5 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40",
                  idx > 0 && "mt-2.5"
                )}>
                  {item.group}
                </div>
              )}
              <a
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(item.href);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors duration-100",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {active && totalNotifications > 0 && notificationItems.find(n => n.href === item.href) && (
                  <span className="ml-auto text-[10px] font-bold bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground px-1.5 py-0.5 rounded-full">
                    {notificationItems.find(n => n.href === item.href)?.count}
                  </span>
                )}
              </a>
            </div>
          );
        })}

        {/* Back to platform (support mode) */}
        {inSupportMode && (
          <button
            onClick={handleExitSupport}
            disabled={isExitingSupport}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-amber-400 hover:bg-amber-500/10 w-full mt-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            <span>{isExitingSupport ? "Exiting…" : "Back to Platform"}</span>
          </button>
        )}
      </nav>

      {/* Notification summary (if any) */}
      {totalNotifications > 0 && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-md bg-sidebar-accent border border-sidebar-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium flex items-center gap-1">
              <Bell className="h-3 w-3" /> Alerts
            </span>
            <span className="text-[10px] font-bold bg-sidebar-primary/30 text-sidebar-primary px-1.5 py-0.5 rounded-full">
              {totalNotifications > 99 ? "99+" : totalNotifications}
            </span>
          </div>
          {notificationItems.slice(0, 3).map((item) => (
            <button
              key={item.key}
              onClick={() => navigateTo(item.href)}
              className="w-full text-left flex items-center justify-between gap-2 py-1 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
            >
              <span className="truncate">{item.label}</span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0",
                item.severity === "warning" ? "bg-amber-500/20 text-amber-400"
                  : item.severity === "success" ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-blue-500/20 text-blue-400"
              )}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md group">
          <div className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
            inSupportMode
              ? "bg-amber-500/20 text-amber-400"
              : "bg-sidebar-primary/25 text-sidebar-primary"
          )}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-sidebar-accent-foreground truncate" data-testid="text-user-name">
              {user?.name}
            </div>
            <div className="text-[10px] text-sidebar-foreground/50 capitalize truncate" data-testid="text-user-role">
              {inSupportMode ? "Support" : contextLabel(activeContext || "")}
            </div>
          </div>
          <button
            onClick={() => navigateTo("/security")}
            data-testid="button-security"
            className="h-7 w-7 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-sidebar-primary hover:bg-sidebar-primary/10 transition-colors flex-shrink-0"
            title="Security & 2FA"
            aria-label="Security and two-factor authentication"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleLogout}
            data-testid="button-logout"
            className="h-7 w-7 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Support mode banner */}
      {inSupportMode && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">
              Support Mode — {user?.supportMode?.schoolName || "School"}
            </span>
          </div>
          <button
            onClick={handleExitSupport}
            disabled={isExitingSupport}
            className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3 w-3" />
            {isExitingSupport ? "Exiting…" : "Exit"}
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "w-60 hidden md:flex flex-col fixed inset-y-0 left-0 z-30",
        inSupportMode && "top-9"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 flex flex-col min-h-screen md:ml-60",
        inSupportMode && "pt-9"
      )}>
        {/* Mobile top bar */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:hidden sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              {schoolBranding?.logoUrl ? (
                <img src={schoolBranding.logoUrl} alt="Logo" className="h-6 w-6 object-contain rounded" />
              ) : (
                <BookOpen className="h-5 w-5 text-primary" />
              )}
              <span className="font-semibold text-sm truncate max-w-[160px]">
                {schoolBranding?.schoolName || "ScholarShelf"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {totalNotifications > 0 && (
              <button
                onClick={() => primaryNotificationHref && navigateTo(primaryNotificationHref)}
                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              </button>
            )}
            <button
              onClick={handleLogout}
              data-testid="button-logout-mobile"
              className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
