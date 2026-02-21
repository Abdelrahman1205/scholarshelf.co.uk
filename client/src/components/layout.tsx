import { Link, useLocation } from "wouter";
import { BookOpen, GraduationCap, Users, LayoutDashboard, Settings, UserCircle } from "lucide-react";
import { Button } from "./ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { label: "Admin", href: "/admin", icon: Settings },
    { label: "Teacher", href: "/teacher", icon: GraduationCap },
    { label: "Parent", href: "/parent", icon: Users },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <BookOpen className="h-6 w-6 text-primary mr-2" />
          <span className="font-heading font-bold text-xl tracking-tight">EduBook</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
            Role Views (Mockup)
          </div>
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start ${isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
              JD
            </div>
            <div className="text-sm">
              <div className="font-medium">Demo User</div>
              <div className="text-xs text-muted-foreground">Switch roles above</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:hidden">
          <div className="flex items-center">
            <BookOpen className="h-6 w-6 text-primary mr-2" />
            <span className="font-heading font-bold text-lg">EduBook</span>
          </div>
          <Button variant="ghost" size="icon">
            <UserCircle className="h-5 w-5" />
          </Button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
