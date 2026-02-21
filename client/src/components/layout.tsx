import { useLocation } from "wouter";
import { BookOpen, GraduationCap, Users, Settings, LogOut, UserCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: React.ReactNode;
}

const roleConfig: Record<string, { label: string; icon: typeof Settings; navItems: { label: string; href: string }[] }> = {
  admin: {
    label: "Administrator",
    icon: Settings,
    navItems: [{ label: "Dashboard", href: "/admin" }],
  },
  teacher: {
    label: "Teacher",
    icon: GraduationCap,
    navItems: [{ label: "Dashboard", href: "/teacher" }],
  },
  parent: {
    label: "Parent",
    icon: Users,
    navItems: [{ label: "Dashboard", href: "/parent" }],
  },
};

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const config = user ? roleConfig[user.role] : null;
  const RoleIcon = config?.icon || Settings;

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

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <BookOpen className="h-6 w-6 text-primary mr-2" />
          <span className="font-heading font-bold text-xl tracking-tight">EduBook</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
            {config?.label || "Navigation"}
          </div>
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-primary/10 text-primary">
            <RoleIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{config?.label} Portal</span>
          </div>
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
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
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:hidden">
          <div className="flex items-center">
            <BookOpen className="h-6 w-6 text-primary mr-2" />
            <span className="font-heading font-bold text-lg">EduBook</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout-mobile">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
