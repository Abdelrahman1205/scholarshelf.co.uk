import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, GraduationCap, Users, Settings, LogOut, LayoutDashboard,
  Package, Layers, Key, CreditCard, BoxSelect, UserPlus, ShoppingCart,
  Link as LinkIcon, History, ClipboardList, Menu, ChevronRight,
  ShieldAlert, ArrowLeft
} from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getQueryFn } from "@/lib/queryClient";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Settings;
  match?: string[];
}

const roleConfig: Record<string, { label: string; color: string; navItems: NavItem[] }> = {
  owner: {
    label: "BytHub Platform Owner",
    color: "text-amber-600",
    navItems: [
      { label: "Owner Dashboard", href: "/admin/owner", icon: LayoutDashboard },
      { label: "Schools", href: "/admin/schools", icon: Settings },
      { label: "Pending Setups", href: "/admin/pending-setups", icon: ClipboardList },
      { label: "Admin Invites", href: "/admin/admin-invites", icon: UserPlus },
      { label: "Email Status", href: "/admin/email-status", icon: Key },
      { label: "Activity Logs", href: "/admin/activity", icon: History },
      { label: "Settings", href: "/admin/owner-settings", icon: Settings },
    ],
  },
  // Support mode: owner operating inside a specific school
  owner_support: {
    label: "Support Mode",
    color: "text-amber-600",
    navItems: [
      { label: "School Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Books", href: "/admin/books", icon: BookOpen },
      { label: "Book Levels", href: "/admin/levels", icon: Layers },
      { label: "Classes", href: "/admin/classes", icon: GraduationCap },
      { label: "Students", href: "/admin/students", icon: Users },
      { label: "Parents", href: "/admin/parents", icon: Users },
      { label: "Linking Codes", href: "/admin/codes", icon: Key },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Allocations", href: "/admin/allocations", icon: BoxSelect },
      { label: "Extra Requests", href: "/admin/requests", icon: ClipboardList },
      { label: "Users", href: "/admin/users", icon: UserPlus },
    ],
  },
  admin: {
    label: "School Admin",
    color: "text-blue-600",
    navItems: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Books", href: "/admin/books", icon: BookOpen },
      { label: "Book Levels", href: "/admin/levels", icon: Layers },
      { label: "Classes", href: "/admin/classes", icon: GraduationCap },
      { label: "Students", href: "/admin/students", icon: Users },
      { label: "Parents", href: "/admin/parents", icon: Users },
      { label: "Linking Codes", href: "/admin/codes", icon: Key },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Allocations", href: "/admin/allocations", icon: BoxSelect },
      { label: "Extra Requests", href: "/admin/requests", icon: ClipboardList },
      { label: "Users", href: "/admin/users", icon: UserPlus },
    ],
  },
  teacher: {
    label: "Teacher",
    color: "text-emerald-600",
    navItems: [
      { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
      { label: "Book Distribution", href: "/teacher/distribution", icon: Package },
      { label: "Extra Requests", href: "/teacher/requests", icon: ClipboardList },
    ],
  },
  parent: {
    label: "Parent",
    color: "text-violet-600",
    navItems: [
      { label: "Dashboard", href: "/parent", icon: LayoutDashboard },
      { label: "Link Child", href: "/parent/link", icon: LinkIcon },
      { label: "Book Baskets", href: "/parent/baskets", icon: ShoppingCart },
      { label: "Payments", href: "/parent/payments", icon: CreditCard },
    ],
  },
};

function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function isNavActive(href: string, location: string): boolean {
  if (href === "/admin" || href === "/teacher" || href === "/parent") {
    return location === href;
  }
  return location.startsWith(href);
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, exitSupportMode, switchContext, isExitingSupport, isSwitchingContext } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOwner = user?.primaryRole === "owner" || user?.primaryRole === "platform_admin" || user?.role === "owner" || user?.role === "platform_admin";
  const inSupportMode = isOwner && user?.supportMode?.active;
  const availableContexts = user?.availableContexts || [];
  const activeContext = user?.activeContext || user?.role;

  // Determine effective role for nav config
  const effectiveRole = inSupportMode
    ? "owner_support"
    : isOwner
      ? "owner"
      : activeContext === "school_admin" || activeContext === "admin"
        ? "admin"
        : activeContext;

  const config = effectiveRole ? roleConfig[effectiveRole] : null;

  const shouldFetchSetupStatus = effectiveRole === "admin";
  const { data: setupStatus } = useQuery<any>({
    queryKey: ["/api/admin/setup-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: shouldFetchSetupStatus,
    staleTime: 30_000,
  });

  const adminSetupComplete = !!setupStatus?.operationalSetupCompleted && !!setupStatus?.schoolActive;

  const navItems = (() => {
    if (!config) return [] as NavItem[];
    if (effectiveRole !== "admin") return config.navItems;

    const setupItem: NavItem = {
      label: adminSetupComplete ? "Setup Summary" : "Continue Setup",
      href: "/admin/setup",
      icon: Settings,
    };

    return adminSetupComplete
      ? [...config.navItems, setupItem]
      : [setupItem, ...config.navItems];
  })();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

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

  const SupportBanner = () => {
    if (!inSupportMode) return null;
    return (
      <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-md z-50">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            Support Mode: Viewing {user?.supportMode?.schoolName || "School"}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="bg-white/20 hover:bg-white/30 text-white border-white/30 flex-shrink-0"
          onClick={handleExitSupport}
          disabled={isExitingSupport}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {isExitingSupport ? "Exiting..." : "Exit Support Mode"}
        </Button>
      </div>
    );
  };

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-5 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <span className="font-heading font-bold text-lg tracking-tight block leading-tight">EduBook</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {inSupportMode ? "Support Mode" : "School Books"}
          </span>
        </div>
      </div>

      {/* Support mode school indicator in sidebar */}
      {inSupportMode && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <div className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold">Supporting</div>
          <div className="text-sm font-medium text-amber-800 truncate">{user?.supportMode?.schoolName}</div>
        </div>
      )}

      {!inSupportMode && availableContexts.length > 1 && (
        <div className="mx-3 mt-3 px-3 py-3 rounded-lg bg-muted/40 border border-border/60 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Current view</div>
          <div className="flex flex-wrap gap-2">
            {availableContexts.map((context) => {
              const selected = context.key === activeContext;
              return (
                <Button
                  key={context.key}
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="h-8"
                  disabled={selected || isSwitchingContext}
                  onClick={() => void handleSwitchContext(context.key, context.defaultPath)}
                >
                  {selected ? `${context.label}` : `Switch to ${context.label}`}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-3">
          {config?.label || "Navigation"}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, location);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(item.href);
                setMobileOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")} />
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="h-3 w-3 ml-auto text-primary/50" />}
            </a>
          );
        })}

        {/* Exit support mode link at bottom of nav */}
        {inSupportMode && (
          <button
            onClick={handleExitSupport}
            disabled={isExitingSupport}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-amber-600 hover:bg-amber-50 w-full mt-4"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{isExitingSupport ? "Exiting..." : "Back to Platform"}</span>
          </button>
        )}
      </nav>

      <div className="p-3 border-t border-border/60 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0",
            inSupportMode ? "bg-amber-100 text-amber-700" : "bg-primary/15 text-primary"
          )}>
            {initials}
          </div>
          <div className="text-sm flex-1 min-w-0">
            <div className="font-medium truncate" data-testid="text-user-name">{user?.name}</div>
            <div className="text-xs text-muted-foreground capitalize" data-testid="text-user-role">
              {inSupportMode ? "Support Operator" : isOwner ? "owner (protected)" : activeContext}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className={cn(
        "w-64 bg-card border-r border-border/60 hidden md:flex flex-col fixed inset-y-0 left-0 z-30",
        inSupportMode && "border-r-amber-300"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border flex flex-col shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-screen md:ml-64">
        {/* Support mode banner — always visible at top */}
        <SupportBanner />

        {/* Mobile header */}
        <header className={cn(
          "h-14 bg-card border-b border-border/60 flex items-center justify-between px-4 md:hidden sticky top-0 z-20",
          inSupportMode && "border-b-amber-300"
        )}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-heading font-bold text-lg">EduBook</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout-mobile" className="h-9 w-9">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
