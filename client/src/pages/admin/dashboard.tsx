import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, Layers, Key, CreditCard, Users, GraduationCap, UserPlus,
  ClipboardList, CheckCircle2, ArrowRight, Package, AlertTriangle,
  ShoppingCart, BarChart2, History,
} from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { navigateTo } from "./shared";

// ─── DASHBOARD (Overview) — ScholarShelf redesign ───────────────────────────
function DashboardSection() {
  const { user } = useAuth();

  const { data: summary, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/dashboard-summary"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/recent-activity"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = (user?.name || "").split(" ")[0] || "there";

  const checklist = summary?.setupChecklist;
  const checklistItems = checklist
    ? [
        { key: "schoolProfileComplete", label: "School profile", done: checklist.schoolProfileComplete },
        { key: "classesCreated", label: "Classes created", done: checklist.classesCreated },
        { key: "booksAdded", label: "Books added", done: checklist.booksAdded },
        { key: "bookLevelsCreated", label: "Book levels", done: checklist.bookLevelsCreated },
        { key: "bookLevelsAssignedToClasses", label: "Levels assigned", done: checklist.bookLevelsAssignedToClasses },
        { key: "studentsAdded", label: "Students added", done: checklist.studentsAdded },
        { key: "parentCodesGenerated", label: "Parent invites sent", done: checklist.parentCodesGenerated },
        { key: "parentsLinked", label: "Parents linked", done: checklist.parentsLinked },
        { key: "brandingDesignConfigured", label: "Branding configured", done: checklist.brandingDesignConfigured },
        { key: "paymentSetupReviewed", label: "Payment setup", done: checklist.paymentSetupReviewed },
        { key: "operationalSetupComplete", label: "Operational setup", done: checklist.operationalSetupComplete },
      ]
    : [];
  const doneCount = checklistItems.filter((i) => i.done).length;
  const setupComplete = checklistItems.length > 0 && doneCount === checklistItems.length;
  const setupPct = checklistItems.length ? Math.round((doneCount / checklistItems.length) * 100) : 0;

  const actionLabels: Record<string, string> = {
    payment_confirmed: "Payment confirmed",
    payment_ready_for_collection: "Payment ready for collection",
    payment_collected: "Payment collected",
    payment_rejected: "Payment rejected",
    login_success: "User signed in",
    logout: "User signed out",
    invite_created: "Invite created",
    invite_accepted: "Invite accepted",
    parent_child_linked: "Parent linked to child",
    linking_code_rotated: "Linking code rotated",
    website_section_published: "Website section published",
  };
  const labelFor = (a: string) => actionLabels[a] || a.replace(/_/g, " ");

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">Loading overview…</div>;
  }
  if (error || !summary) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Couldn't load your dashboard. Refresh to try again.
      </div>
    );
  }

  const hero = [
    {
      label: "Active Students",
      value: summary.totalStudents ?? 0,
      icon: Users,
      sub: `Across ${summary.totalClasses ?? 0} ${summary.totalClasses === 1 ? "class" : "classes"}`,
      accent: false,
    },
    {
      label: "Ready for Distribution",
      value: summary.readyForDistribution ?? 0,
      icon: Package,
      sub: `${summary.teacherConfirmationsPending ?? 0} awaiting teacher confirmation`,
      accent: false,
    },
    {
      label: "Pending Payments",
      value: summary.pendingPayments ?? 0,
      icon: CreditCard,
      sub: `${summary.paymentsSubmitted ?? 0} submitted · ${summary.paymentsVerified ?? 0} verified`,
      accent: (summary.pendingPayments ?? 0) > 0,
      action: { label: "Review", href: "/admin/payments" },
    },
  ];

  const kpis = [
    { label: "Total Books", value: summary.totalBooks ?? 0, icon: BookOpen, href: "/admin/books" },
    { label: "Low Stock", value: summary.lowStockBooks ?? 0, icon: AlertTriangle, href: "/admin/books", warn: (summary.lowStockBooks ?? 0) > 0 },
    { label: "Parents Linked", value: summary.parentsLinked ?? 0, icon: Users, href: "/admin/parents" },
    { label: "Students Without Invites", value: summary.parentCodesNotSent ?? 0, icon: Key, href: "/admin/codes", warn: (summary.parentCodesNotSent ?? 0) > 0 },
    { label: "Extra Requests", value: summary.extraCopyRequestsPending ?? 0, icon: ClipboardList, href: "/admin/requests" },
    { label: "Bundles", value: summary.totalBookLevels ?? 0, icon: Layers, href: "/admin/levels" },
  ];

  const quickActions = [
    { label: "Add Book", desc: "Catalogue a new title", icon: BookOpen, href: "/admin/books" },
    { label: "Add Student", desc: "Enrol and assign a class", icon: GraduationCap, href: "/admin/students" },
    { label: "Invite Parent", desc: "Send a linking code", icon: UserPlus, href: "/admin/codes" },
    { label: "Review Payments", desc: "Verify submissions", icon: CreditCard, href: "/admin/payments" },
    { label: "Manage Allocations", desc: "Track distribution", icon: ShoppingCart, href: "/admin/allocations" },
    { label: "View Reports", desc: "Operational metrics", icon: BarChart2, href: "/admin/reports" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">{greeting}, {firstName}. Here's your operational summary for today.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground font-mono w-fit">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Last synced: just now
        </span>
      </div>

      {/* Setup progress (only while incomplete) */}
      {checklistItems.length > 0 && !setupComplete && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-foreground">Finish setting up your school</h2>
              <p className="text-sm text-muted-foreground">{doneCount} of {checklistItems.length} steps complete</p>
            </div>
            <button onClick={() => navigateTo("/admin/setup")} className="text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline">
              Continue setup <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-4">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${setupPct}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {checklistItems.map((item) => (
              <div key={item.key} className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                item.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/30 text-muted-foreground"
              )}>
                {item.done ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <span className="h-4 w-4 rounded-full border border-current shrink-0" />}
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {hero.map((c) => (
          <div key={c.label} className={cn(
            "rounded-2xl border p-5 relative overflow-hidden",
            c.accent ? "border-destructive/30 bg-destructive/[0.03]" : "border-border bg-card"
          )}>
            <div className="flex items-start justify-between">
              <span className={cn("text-[11px] font-mono font-semibold uppercase tracking-wider", c.accent ? "text-destructive" : "text-muted-foreground")}>{c.label}</span>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", c.accent ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary")}>
                <c.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-4xl font-bold tracking-tight text-foreground mt-3">{Number(c.value).toLocaleString()}</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{c.sub}</span>
              {c.action && (
                <button onClick={() => navigateTo(c.action!.href)} className="text-xs font-medium text-primary hover:underline">{c.action.label}</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <button key={k.label} onClick={() => navigateTo(k.href)} className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-muted/20 transition">
            <div className="flex items-center gap-1.5 mb-2">
              <k.icon className={cn("w-3.5 h-3.5", k.warn ? "text-amber-600" : "text-muted-foreground")} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">{k.label}</span>
            </div>
            <div className={cn("text-2xl font-bold", k.warn ? "text-amber-600" : "text-foreground")}>{Number(k.value).toLocaleString()}</div>
          </button>
        ))}
      </div>

      {/* Recent activity + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Recent Activity</h2>
            <button onClick={() => navigateTo("/admin/reports")} className="text-xs font-medium text-primary hover:underline">View reports</button>
          </div>
          {activity.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No recent activity yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {activity.slice(0, 8).map((log: any, i: number) => (
                <div key={log.id ?? i} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                      <History className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground truncate">{labelFor(log.action)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono shrink-0 ml-3">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="space-y-1">
              {quickActions.map((a) => (
                <button key={a.label} onClick={() => navigateTo(a.href)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition text-left group">
                  <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                    <a.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-foreground">System operational</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">All services reporting normal. {setupComplete ? "Your school is fully configured." : "Complete setup to unlock all features."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DashboardSection };
