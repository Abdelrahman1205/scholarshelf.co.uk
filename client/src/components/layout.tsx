import { useLocation } from "wouter";
import {
  BookOpen, GraduationCap, Users, Settings, LogOut, LayoutDashboard,
  Package, Layers, Key, CreditCard, BoxSelect, UserPlus, ShoppingCart,
  Link as LinkIcon, History, ClipboardList, Menu, X, ChevronRight
} from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  admin: {
    label: "School Admin",
    color: "text-blue-600",
    navItems: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Books", href: "/admin/books", icon: BookOpen },
      { label: "Book Levels", href: "/admin/levels", icon: Layers },
      { label: "Classes", href: "/admin/classes", icon: GraduationCap },
      { label: "Students", href: "/admin/students", icon: Users },
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

function isNavActive(href: string, location: string): boolean {
  if (href === "/admin" || href === "/teacher" || href === "/parent") {
    return location === href;
  }
  return location.startsWith(href);
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Support both legacy "admin" and new "school_admin" role
  const effectiveRole = user?.role === "school_admin" ? "admin" : user?.role;
  const config = effectiveRole ? roleConfig[effectiveRole] : null;

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

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-5 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <span className="font-heading font-bold text-lg tracking-tight block leading-tight">EduBook</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">School Books</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-3">
          {config?.label || "Navigation"}
        </div>
        {config?.navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, location);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", item.href);
                window.dispatchEvent(new PopStateEvent("popstate"));
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
      </nav>

      <div className="p-3 border-t border-border/60 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="text-sm flex-1 min-w-0">
            <div className="font-medium truncate" data-testid="text-user-name">{user?.name}</div>
            <div className="text-xs text-muted-foreground capitalize" data-testid="text-user-role">{user?.role}</div>
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
      <aside className="w-64 bg-card border-r border-border/60 hidden md:flex flex-col fixed inset-y-0 left-0 z-30">
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
        {/* Mobile header */}
        <header className="h-14 bg-card border-b border-border/60 flex items-center justify-between px-4 md:hidden sticky top-0 z-20">
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
