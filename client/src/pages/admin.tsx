import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus,
  Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight,
  QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users,
  Package, TrendingUp, TrendingDown, ClipboardList, CheckCircle2, Clock,
  XCircle, Eye, History, BarChart2, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ─── NAVIGATION HELPER ─────────────────────────────────────────
function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ─── DASHBOARD ─────────────────────────────────────────────────
function DashboardSection() {
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<any>({
    queryKey: ["/api/admin/dashboard-summary"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: activity = [], isLoading: activityLoading, error: activityError } = useQuery<any[]>({
    queryKey: ["/api/admin/recent-activity"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Greeting based on time of day
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  // Setup checklist items
  const setupItems = summary
    ? [
        { label: "School profile completed", done: summary.setupChecklist.schoolProfileCompleted, href: "/admin/users" },
        { label: "Classes created", done: summary.setupChecklist.classesCreated, href: "/admin/classes", count: summary.totalClasses },
        { label: "Books added", done: summary.setupChecklist.booksAdded, href: "/admin/books", count: summary.totalBooks },
        { label: "Book bundles created", done: summary.setupChecklist.bookBundlesCreated, href: "/admin/levels", count: summary.totalBookLevels },
        { label: "Bundles assigned to classes", done: summary.setupChecklist.bundlesAssignedToClasses, href: "/admin/levels" },
        { label: "Students added", done: summary.setupChecklist.studentsAdded, href: "/admin/students", count: summary.totalStudents },
        { label: "Parent codes generated", done: summary.setupChecklist.parentCodesGenerated, href: "/admin/codes", count: summary.totalLinkingCodes },
        { label: "Parents linked", done: summary.setupChecklist.parentsLinked, href: "/admin/codes" },
        { label: "Payment setup reviewed", done: summary.setupChecklist.paymentSetupReviewed, href: "/admin/payments" },
      ]
    : [];

  const setupDone = setupItems.filter((i) => i.done).length;
  const setupTotal = setupItems.length;
  const setupPercent = setupTotal > 0 ? Math.round((setupDone / setupTotal) * 100) : 0;

  // Stat cards — 11 required
  const stats = summary
    ? [
        {
          label: "Total Books", value: summary.totalBooks,
          icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", href: "/admin/books",
        },
        {
          label: "Low Stock Books", value: summary.lowStockBooks,
          icon: AlertTriangle,
          color: summary.lowStockBooks > 0 ? "text-amber-600" : "text-emerald-600",
          bg: summary.lowStockBooks > 0 ? "bg-amber-50" : "bg-emerald-50",
          href: "/admin/books",
        },
        {
          label: "Total Students", value: summary.totalStudents,
          icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", href: "/admin/students",
        },
        {
          label: "Parents Linked", value: summary.parentsLinked,
          icon: UserPlus, color: "text-violet-600", bg: "bg-violet-50", href: "/admin/codes",
        },
        {
          label: "Parent Codes Not Sent", value: summary.parentCodesNotSent,
          icon: Key,
          color: summary.parentCodesNotSent > 0 ? "text-orange-600" : "text-emerald-600",
          bg: summary.parentCodesNotSent > 0 ? "bg-orange-50" : "bg-emerald-50",
          href: "/admin/codes",
        },
        {
          label: "Pending Payments", value: summary.pendingPayments,
          icon: Clock,
          color: summary.pendingPayments > 0 ? "text-orange-600" : "text-emerald-600",
          bg: summary.pendingPayments > 0 ? "bg-orange-50" : "bg-emerald-50",
          href: "/admin/payments",
        },
        {
          label: "Payments Submitted", value: summary.paymentsSubmitted,
          icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50", href: "/admin/payments",
        },
        {
          label: "Payments Verified", value: summary.paymentsVerified,
          icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", href: "/admin/payments",
        },
        {
          label: "Ready for Distribution", value: summary.readyForDistribution,
          icon: Package, color: "text-indigo-600", bg: "bg-indigo-50", href: "/admin/allocations",
        },
        {
          label: "Teacher Confirmations Pending", value: summary.teacherConfirmationsPending,
          icon: ClipboardList,
          color: summary.teacherConfirmationsPending > 0 ? "text-blue-600" : "text-emerald-600",
          bg: summary.teacherConfirmationsPending > 0 ? "bg-blue-50" : "bg-emerald-50",
          href: "/admin/allocations",
        },
        {
          label: "Extra Copy Requests Pending", value: summary.extraCopyRequestsPending,
          icon: PackageSearch,
          color: summary.extraCopyRequestsPending > 0 ? "text-rose-600" : "text-emerald-600",
          bg: summary.extraCopyRequestsPending > 0 ? "bg-rose-50" : "bg-emerald-50",
          href: "/admin/requests",
        },
      ]
    : [];

  // Main action cards — every one routes to an existing section
  const actions = [
    {
      label: "Add Book",
      description: "Add a new book to your school catalogue",
      icon: BookOpen,
      href: "/admin/books",
      color: "text-blue-600",
      bg: "bg-blue-50",
      enabled: true,
    },
    {
      label: "Create Book Bundle",
      description: "Group books into a level bundle for classes",
      icon: Layers,
      href: "/admin/levels",
      color: "text-violet-600",
      bg: "bg-violet-50",
      enabled: true,
    },
    {
      label: "Add Student",
      description: "Enrol a new student and assign to a class",
      icon: Users,
      href: "/admin/students",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      enabled: true,
    },
    {
      label: "Generate Parent Codes",
      description: "Create linking codes for parents to connect",
      icon: Key,
      href: "/admin/codes",
      color: "text-orange-600",
      bg: "bg-orange-50",
      enabled: true,
    },
    {
      label: "Review Payments",
      description: "Verify and confirm parent payment submissions",
      icon: CreditCard,
      href: "/admin/payments",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      enabled: true,
    },
    {
      label: "View Teacher Requests",
      description: "Review and approve extra copy requests",
      icon: ClipboardList,
      href: "/admin/requests",
      color: "text-rose-600",
      bg: "bg-rose-50",
      enabled: true,
    },
    {
      label: "Manage Allocations",
      description: "Track book distribution and teacher confirmations",
      icon: BoxSelect,
      href: "/admin/allocations",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      enabled: true,
    },
    {
      label: "View Reports",
      description: "Detailed analytics and reporting — coming soon",
      icon: BarChart2,
      href: "",
      color: "text-gray-400",
      bg: "bg-gray-50",
      enabled: false,
      disabledReason: "Coming soon",
    },
  ];

  // Warnings / attention items
  const warnings = summary
    ? [
        ...(summary.lowStockBooks > 0
          ? [{ type: "warning" as const, msg: `${summary.lowStockBooks} book${summary.lowStockBooks !== 1 ? "s" : ""} running low on stock — reorder soon`, href: "/admin/books" }]
          : []),
        ...(summary.pendingPayments > 0
          ? [{ type: "warning" as const, msg: `${summary.pendingPayments} payment${summary.pendingPayments !== 1 ? "s" : ""} awaiting your verification`, href: "/admin/payments" }]
          : []),
        ...(summary.extraCopyRequestsPending > 0
          ? [{ type: "info" as const, msg: `${summary.extraCopyRequestsPending} extra copy request${summary.extraCopyRequestsPending !== 1 ? "s" : ""} from teachers pending review`, href: "/admin/requests" }]
          : []),
        ...(summary.parentCodesNotSent > 0
          ? [{ type: "info" as const, msg: `${summary.parentCodesNotSent} parent linking code${summary.parentCodesNotSent !== 1 ? "s" : ""} generated but not yet used`, href: "/admin/codes" }]
          : []),
        ...(summary.teacherConfirmationsPending > 0
          ? [{ type: "info" as const, msg: `${summary.teacherConfirmationsPending} book allocation${summary.teacherConfirmationsPending !== 1 ? "s" : ""} awaiting teacher confirmation of receipt`, href: "/admin/allocations" }]
          : []),
      ]
    : [];

  // Activity log labels
  function formatActivity(log: any): string {
    const labels: Record<string, string> = {
      login_success: "User signed in",
      login_failed: "Failed sign-in attempt",
      login_rate_limited: "Login rate-limited (suspicious activity)",
      parent_registered: "New parent registered",
      invite_created: "User invited to the system",
      payment_confirmed: "Payment confirmed",
      payment_rejected: "Payment rejected",
      book_allocated: "Books allocated to student",
    };
    return labels[log.action] || log.action.replace(/_/g, " ");
  }

  // ── Loading skeleton ──
  if (summaryLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-28 bg-muted/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array(9).fill(0).map((_, i) => (
            <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array(11).fill(0).map((_, i) => (
            <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (summaryError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dashboard failed to load</AlertTitle>
          <AlertDescription>
            Could not fetch dashboard data from the server. Please refresh the page or contact support if this persists.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-summary"] })}>
          Retry Loading Dashboard
        </Button>
      </div>
    );
  }

  const schoolLabel = user?.schoolId ? `School ${user.schoolId}` : "Demo School";

  return (
    <div className="space-y-6">

      {/* ── 1. Welcome Header ── */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              {greeting}, {user?.name?.split(" ")[0] || "Admin"} 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {user?.name || "School Admin"} · {schoolLabel} · EduBook Setup &amp; Operations Control Centre
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium">System operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Setup Progress Checklist ── */}
      {setupTotal > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  School Setup Progress
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {setupDone === setupTotal
                    ? "All steps complete — your school is fully configured."
                    : `${setupDone} of ${setupTotal} steps complete. Click any incomplete step to continue.`}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-sm font-semibold px-3",
                  setupPercent === 100
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : setupPercent >= 50
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                )}
              >
                {setupPercent}%
              </Badge>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  setupPercent === 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${setupPercent}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-0">
            {setupItems.map((item, i) => (
              <button
                key={i}
                onClick={() => item.href && navigateTo(item.href)}
                disabled={item.done}
                className={cn(
                  "flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border transition-all text-left group",
                  item.done
                    ? "bg-emerald-50/70 border-emerald-200/60 text-emerald-700 cursor-default"
                    : "bg-amber-50/60 border-amber-200/70 text-amber-800 hover:bg-amber-100/80 hover:border-amber-300 cursor-pointer"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                )}
                <span className="flex-1 font-medium leading-tight">{item.label}</span>
                {(item as any).count !== undefined && (
                  <Badge variant="outline" className="text-xs ml-auto bg-white/60">
                    {(item as any).count}
                  </Badge>
                )}
                {!item.done && (
                  <ChevronRight className="h-3.5 w-3.5 text-amber-400/70 group-hover:text-amber-600 transition-colors flex-shrink-0" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 3. Key Statistics ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">
          Key Statistics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => navigateTo(s.href)}
                className="text-left group"
              >
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-150 group-hover:border-primary/25 cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105",
                          s.bg
                        )}
                      >
                        <Icon className={cn("h-5 w-5", s.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-medium truncate leading-tight">{s.label}</p>
                        <p className={cn("text-xl font-bold font-heading leading-tight", s.color)}>{s.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. Main Action Cards ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            if (!a.enabled) {
              return (
                <div
                  key={a.label}
                  title={a.disabledReason}
                  className="opacity-50 cursor-not-allowed"
                >
                  <Card className="border-border/50 border-dashed h-full">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", a.bg)}>
                        <Icon className={cn("h-5 w-5", a.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-muted-foreground">{a.label}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{a.disabledReason}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            }
            return (
              <button
                key={a.label}
                onClick={() => navigateTo(a.href)}
                className="text-left group"
              >
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-150 group-hover:border-primary/25 cursor-pointer h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105",
                        a.bg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", a.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{a.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 5 & 6. Warnings + Recent Activity (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Warnings / Attention Panel */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warnings.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-emerald-700">All clear!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No issues require your attention right now.
                </p>
              </div>
            ) : (
              warnings.map((w, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(w.href)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg border text-left hover:brightness-95 transition-all group",
                    w.type === "warning"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-blue-200 bg-blue-50/60"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4 flex-shrink-0 mt-0.5",
                      w.type === "warning" ? "text-amber-500" : "text-blue-500"
                    )}
                  />
                  <span className="text-sm flex-1 leading-snug">{w.msg}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activityLoading ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activityError ? (
              <Alert variant="destructive" className="border-red-200 bg-red-50/60">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not load recent activity</AlertTitle>
                <AlertDescription>
                  The activity feed is temporarily unavailable. You can continue using setup and operations tools.
                </AlertDescription>
              </Alert>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <History className="h-10 w-10 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Activity will appear here as the system is used.
                </p>
              </div>
            ) : (
              activity.slice(0, 8).map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0"
                >
                  <div className="h-2 w-2 rounded-full bg-primary/30 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize leading-tight">{formatActivity(log)}</p>
                    {log.target && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{log.target}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 7. Navigation links to next workflows ── */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Navigate to Workflows
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Books", href: "/admin/books" },
            { label: "Book Bundles", href: "/admin/levels" },
            { label: "Classes", href: "/admin/classes" },
            { label: "Students", href: "/admin/students" },
            { label: "Parent Codes", href: "/admin/codes" },
            { label: "Payments", href: "/admin/payments" },
            { label: "Allocations", href: "/admin/allocations" },
            { label: "Teacher Requests", href: "/admin/requests" },
            { label: "Users", href: "/admin/users" },
          ].map((link) => (
            <button
              key={link.href}
              onClick={() => navigateTo(link.href)}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-background border border-border/60 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    pending: { class: "bg-amber-100 text-amber-700 border-amber-200", label: "Pending" },
    completed: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Completed" },
    failed: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    approved: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Approved" },
    rejected: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    allocated: { class: "bg-blue-100 text-blue-700 border-blue-200", label: "Allocated" },
    received: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Received" },
    absent: { class: "bg-gray-100 text-gray-700 border-gray-200", label: "Absent" },
  };
  const c = config[status] || { class: "bg-gray-100 text-gray-700", label: status };
  return <Badge variant="outline" className={`${c.class} text-xs font-medium`}>{c.label}</Badge>;
}

// ─── USERS ─────────────────────────────────────────────────────
function UsersSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "teacher", email: "" });

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setAddOpen(false); resetForm(); toast({ title: "User created successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/users/${selectedUser?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setEditOpen(false); toast({ title: "User updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/users/${selectedUser?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setDeleteOpen(false); toast({ title: "User deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() { setForm({ username: "", password: "", name: "", role: "teacher", email: "" }); }

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage admin, teacher, and parent accounts.</p>
        </div>
        <Button data-testid="button-add-user" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search users..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : u.role === "teacher" ? "secondary" : "outline"}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setForm({ username: u.username || "", password: "", name: u.name || "", role: u.role || "teacher", email: u.email || "" }); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedUser(u); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{search ? "No matching users" : "No users found"}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new teacher or parent account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ms. Sarah Ahmed" /></div>
            <div className="grid gap-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. sarah" /></div>
            <div className="grid gap-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter password" /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sarah@school.edu" /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div className="grid gap-2"><Label>New Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              const payload: any = { name: form.name, username: form.username, email: form.email, role: form.role };
              if (form.password) payload.password = form.password;
              updateMutation.mutate(payload);
            }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedUser?.name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── CLASSES ───────────────────────────────────────────────────
function ClassesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [form, setForm] = useState({ name: "", academicYear: "2025-2026", teacherId: "" });

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });
  const teachers = users.filter((u: any) => u.role === "teacher");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/classes", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setAddOpen(false); toast({ title: "Class created" }); setForm({ name: "", academicYear: "2025-2026", teacherId: "" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/classes/${selectedClass?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setEditOpen(false); toast({ title: "Class updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/classes/${selectedClass?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setDeleteOpen(false); toast({ title: "Class deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage school classes and teacher assignments.</p>
        </div>
        <Button onClick={() => { setForm({ name: "", academicYear: "2025-2026", teacherId: "" }); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Class
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((cls: any) => (
              <TableRow key={cls.id}>
                <TableCell className="font-medium">{cls.name}</TableCell>
                <TableCell className="text-muted-foreground">{cls.academicYear || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{users.find((u: any) => u.id === cls.teacherId)?.name || "Not assigned"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClass(cls); setForm({ name: cls.name || "", academicYear: cls.academicYear || "2025-2026", teacherId: cls.teacherId || "none" }); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedClass(cls); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No classes found. Add your first class above.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add New Class</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Academic Year</Label><Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder="Select teacher (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ ...form, teacherId: form.teacherId === "none" || !form.teacherId ? null : form.teacherId })} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Academic Year</Label><Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ ...form, teacherId: form.teacherId === "none" || !form.teacherId ? null : form.teacherId })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedClass?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── STUDENTS ──────────────────────────────────────────────────
function StudentsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", classId: "" });

  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c]));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/students", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setAddOpen(false); setForm({ name: "", classId: "" }); toast({ title: "Student added" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/students/${selectedStudent?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setEditOpen(false); toast({ title: "Student updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/students/${selectedStudent?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setDeleteOpen(false); toast({ title: "Student deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const filtered = students.filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student records and class assignments.</p>
        </div>
        <Button onClick={() => { setForm({ name: "", classId: "" }); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Student
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search students..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Student Code</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((student: any) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">{student.studentCode || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{classMap[student.classId]?.name || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(student); setForm({ name: student.name || "", classId: student.classId || "" }); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedStudent(student); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{search ? "No matching students" : "No students yet. Add your first student above."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>{classes.map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add Student"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>{classes.map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Student</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{selectedStudent?.name}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── BOOKS ─────────────────────────────────────────────────────
function BooksSection() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 });
  const [stockForm, setStockForm] = useState({ quantity: 0, type: "purchase", reason: "" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isbnLooking, setIsbnLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });

  async function lookupIsbn(isbn: string) {
    setIsbnLooking(true);
    try {
      const res = await fetch(`/api/isbn-lookup/${encodeURIComponent(isbn)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, isbn: data.isbn || prev.isbn, title: data.title || prev.title, author: data.author || prev.author, description: data.description || prev.description }));
        toast({ title: "Book Found", description: `"${data.title}" auto-filled.` });
      } else {
        setForm((prev) => ({ ...prev, isbn }));
        toast({ title: "ISBN Scanned", description: "Book not found in database — please fill in manually." });
      }
    } catch {
      setForm((prev) => ({ ...prev, isbn }));
    } finally { setIsbnLooking(false); }
  }

  async function startScanner() {
    setScannerError(null); setScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5Qr;
        await html5Qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 300, height: 150 } } as any,
          (decodedText) => { const isbn = decodedText.trim().replace(/[^0-9X]/gi, ""); stopScanner(); if (!addOpen) setAddOpen(true); lookupIsbn(isbn); }, () => {});
      } catch (err: any) { setScannerError(err?.message || "Could not access camera."); setScannerOpen(false); }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScannerOpen(false);
  }

  useEffect(() => { return () => { if (scannerRef.current) { try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {} } }; }, []);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/books", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setAddOpen(false); resetForm(); toast({ title: "Book added" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/books/${selectedBook?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setEditOpen(false); toast({ title: "Book updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/books/${selectedBook?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setDeleteOpen(false); toast({ title: "Book deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const stockMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/books/${selectedBook?.id}/stock`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setStockOpen(false); toast({ title: "Stock updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() { setForm({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 }); }

  const filtered = books.filter((b: any) => b.title?.toLowerCase().includes(search.toLowerCase()) || b.author?.toLowerCase().includes(search.toLowerCase()) || b.isbn?.toLowerCase().includes(search.toLowerCase()));

  const bookFormFields = (
    <>
      {isbnLooking && <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md"><Loader2 className="h-4 w-4 animate-spin" /> Looking up book details...</div>}
      <div className="grid gap-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
        <div className="grid gap-2"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Price (£)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Stock Quantity</Label><Input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Low Stock Threshold</Label><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 10 })} /></div>
        <div className="grid gap-2"><Label>Reorder Quantity</Label><Input type="number" value={form.reorderQuantity} onChange={(e) => setForm({ ...form, reorderQuantity: parseInt(e.target.value) || 50 })} /></div>
      </div>
      <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your book catalogue and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetForm(); startScanner(); }}><ScanBarcode className="w-4 h-4 mr-2" /> Scan</Button>
          <Button onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Book</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search by title, author, or ISBN..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((book: any) => {
              const isLow = (book.stockQuantity || 0) <= (book.lowStockThreshold || 10);
              return (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell className="text-muted-foreground">{book.author || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{book.isbn || "—"}</TableCell>
                  <TableCell>£{parseFloat(book.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={isLow ? "text-amber-600 font-semibold" : ""}>{book.stockQuantity || 0}</span>
                    {isLow && <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell><Badge variant={book.isActive ? "default" : "secondary"} className={book.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>{book.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" title="Adjust Stock" onClick={() => { setSelectedBook(book); setStockForm({ quantity: 0, type: "purchase", reason: "" }); setStockOpen(true); }}>
                      <Package className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedBook(book); setForm({ title: book.title || "", author: book.author || "", isbn: book.isbn || "", price: book.price || "", description: book.description || "", isActive: book.isActive ?? true, stockQuantity: book.stockQuantity || 0, lowStockThreshold: book.lowStockThreshold || 10, reorderQuantity: book.reorderQuantity || 50 }); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedBook(book); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{search ? "No matching books" : "No books yet. Add your first book above."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Scan Book Barcode</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div id="barcode-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]" />
            {scannerError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{scannerError}</div>}
            <Button variant="outline" className="w-full" onClick={stopScanner}><X className="w-4 h-4 mr-2" /> Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add Book"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedBook?.title}</DialogTitle>
            <DialogDescription>Current stock: {selectedBook?.stockQuantity || 0}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={stockForm.type} onValueChange={(v) => setStockForm({ ...stockForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase (add stock)</SelectItem>
                  <SelectItem value="return">Return (add stock)</SelectItem>
                  <SelectItem value="damage">Damage (reduce stock)</SelectItem>
                  <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Quantity</Label><Input type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid gap-2"><Label>Reason (optional)</Label><Input value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => stockMutation.mutate(stockForm)} disabled={stockMutation.isPending}>{stockMutation.isPending ? "Updating..." : "Update Stock"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Book</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{selectedBook?.title}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── BOOK LEVELS ───────────────────────────────────────────────
function BookLevelsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [addItemForm, setAddItemForm] = useState({ bookId: "", quantity: 1 });
  const [assignForm, setAssignForm] = useState({ classId: "", bookLevelId: "" });
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: levels = [] } = useQuery<any[]>({ queryKey: ["/api/book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classBookLevels = [] } = useQuery<any[]>({ queryKey: ["/api/class-book-levels"], queryFn: getQueryFn({ on401: "throw" }) });

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddOpen(false); setForm({ name: "", description: "" }); toast({ title: "Book level created" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { levelId: string; bookId: string; quantity: number }) => apiRequest("POST", `/api/book-levels/${data.levelId}/items`, { bookId: data.bookId, quantity: data.quantity }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddItemForm({ bookId: "", quantity: 1 }); toast({ title: "Book added to level" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/book-level-items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); toast({ title: "Book removed from level" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/class-book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); setAssignOpen(false); toast({ title: "Level assigned to class" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Book Levels</h1>
          <p className="text-muted-foreground text-sm mt-1">Create book bundles and assign them to classes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignOpen(true)}><GraduationCap className="w-4 h-4 mr-2" /> Assign to Class</Button>
          <Button onClick={() => { setForm({ name: "", description: "" }); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> New Level</Button>
        </div>
      </div>

      {/* Assigned classes */}
      {classBookLevels.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Class Assignments</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {classBookLevels.map((cbl: any) => (
                <Badge key={cbl.id} variant="outline" className="py-1 px-3">
                  {cbl.class?.name || "?"} → {cbl.bookLevel?.name || "?"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {levels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-muted-foreground">No Book Levels</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a book level to group books into bundles for classes.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create First Level</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {levels.map((level: any) => (
            <LevelCard key={level.id} level={level} expanded={expandedLevel === level.id}
              onToggle={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}
              books={books} addItemForm={addItemForm} setAddItemForm={setAddItemForm}
              addItemMutation={addItemMutation} removeItemMutation={removeItemMutation} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>New Book Level</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 3 Books" /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={() => createLevelMutation.mutate(form)} disabled={createLevelMutation.isPending}>{createLevelMutation.isPending ? "Creating..." : "Create Level"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Assign Level to Class</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={assignForm.classId} onValueChange={(v) => setAssignForm({ ...assignForm, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Book Level</Label>
              <Select value={assignForm.bookLevelId} onValueChange={(v) => setAssignForm({ ...assignForm, bookLevelId: v })}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{levels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => assignMutation.mutate(assignForm)} disabled={assignMutation.isPending}>{assignMutation.isPending ? "Assigning..." : "Assign"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LevelCard({ level, expanded, onToggle, books, addItemForm, setAddItemForm, addItemMutation, removeItemMutation }: any) {
  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["/api/book-levels", level.id, "items"],
    queryFn: async () => { const res = await fetch(`/api/book-levels/${level.id}/items`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
    enabled: expanded,
  });

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{level.name}</CardTitle>
            {level.description && <CardDescription className="mt-1">{level.description}</CardDescription>}
          </div>
          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          {items.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.book?.title || "Unknown"}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>£{parseFloat(item.book?.price || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeItemMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No books in this level yet.</p>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Add Book</Label>
              <Select value={addItemForm.bookId} onValueChange={(v) => setAddItemForm({ ...addItemForm, bookId: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select book" /></SelectTrigger>
                <SelectContent>{books.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Label className="text-xs">Qty</Label>
              <Input type="number" min="1" className="h-9" value={addItemForm.quantity} onChange={(e) => setAddItemForm({ ...addItemForm, quantity: parseInt(e.target.value) || 1 })} />
            </div>
            <Button size="sm" className="h-9" onClick={() => addItemMutation.mutate({ levelId: level.id, bookId: addItemForm.bookId, quantity: addItemForm.quantity })} disabled={!addItemForm.bookId || addItemMutation.isPending}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── LINKING CODES ─────────────────────────────────────────────
function LinkingCodesSection() {
  const { toast } = useToast();
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ studentId: "", parentEmail: "" });

  const { data: codes = [] } = useQuery<any[]>({ queryKey: ["/api/linking-codes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });

  const generateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/students/${data.studentId}/linking-code`, { parentEmail: data.parentEmail }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] }); setGenOpen(false); toast({ title: "Linking code generated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Linking Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate parent-student linking codes.</p>
        </div>
        <Button onClick={() => { setGenForm({ studentId: "", parentEmail: "" }); setGenOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Generate Code
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code: any) => (
              <TableRow key={code.id}>
                <TableCell className="font-mono font-semibold text-primary">{code.code}</TableCell>
                <TableCell>{code.student?.name || "Unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{code.parentEmail}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={code.isUsed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {code.isUsed ? "Used" : "Available"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No linking codes generated yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Generate Linking Code</DialogTitle><DialogDescription>Create a code for a parent to link to their child.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Student</Label>
              <Select value={genForm.studentId} onValueChange={(v) => setGenForm({ ...genForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Parent Email</Label><Input type="email" value={genForm.parentEmail} onChange={(e) => setGenForm({ ...genForm, parentEmail: e.target.value })} placeholder="parent@example.com" /></div>
          </div>
          <DialogFooter><Button onClick={() => generateMutation.mutate(genForm)} disabled={generateMutation.isPending || !genForm.studentId || !genForm.parentEmail}>{generateMutation.isPending ? "Generating..." : "Generate Code"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PAYMENTS ──────────────────────────────────────────────────
function PaymentsSection() {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"], queryFn: getQueryFn({ on401: "throw" }) });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/confirm`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); setDetailOpen(false); toast({ title: "Payment confirmed & books allocated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/reject`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); setDetailOpen(false); toast({ title: "Payment rejected" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and manage parent payment confirmations.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.paymentReference}</TableCell>
                <TableCell className="text-muted-foreground">{p.parentIdentifier}</TableCell>
                <TableCell className="font-medium">£{parseFloat(p.totalAmount || "0").toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground capitalize">{(p.paymentMethod || "").replace(/_/g, " ")}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPayment(p); setDetailOpen(true); }}><Eye className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payments yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {selectedPayment && (
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription>Reference: {selectedPayment.paymentReference}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{selectedPayment.parentIdentifier}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-primary">£{parseFloat(selectedPayment.totalAmount || "0").toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Method:</span> <span className="capitalize">{(selectedPayment.paymentMethod || "").replace(/_/g, " ")}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selectedPayment.status} /></div>
              </div>
              {selectedPayment.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {selectedPayment.notes}</div>}
            </div>
            {selectedPayment.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => rejectMutation.mutate(selectedPayment.id)} disabled={rejectMutation.isPending}>Reject</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmMutation.mutate(selectedPayment.id)} disabled={confirmMutation.isPending}>
                  {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm & Allocate
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ─── ALLOCATIONS ───────────────────────────────────────────────
function AllocationsSection() {
  const { data: allocations = [] } = useQuery<any[]>({ queryKey: ["/api/allocations"], queryFn: getQueryFn({ on401: "throw" }) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Allocations</h1>
        <p className="text-muted-foreground text-sm mt-1">Track book allocations and teacher confirmations.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.student?.name || "Unknown"}</TableCell>
                <TableCell>{a.book?.title || "Unknown"}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.receivedAt ? new Date(a.receivedAt).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
            {allocations.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No allocations yet. Confirm a payment to create allocations.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── EXTRA COPY REQUESTS ───────────────────────────────────────
function ExtraRequestsSection() {
  const { toast } = useToast();
  const { data: requests = [] } = useQuery<any[]>({ queryKey: ["/api/extra-requests"], queryFn: getQueryFn({ on401: "throw" }) });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extra-requests/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/extra-requests"] }); toast({ title: "Request approved" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extra-requests/${id}/reject`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/extra-requests"] }); toast({ title: "Request rejected" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const reasonLabels: Record<string, string> = {
    NEW_STUDENT: "New Student",
    DAMAGED_IN_CLASS: "Damaged in Class",
    LOST_REPLACEMENT: "Lost Replacement",
    SHORTAGE: "Shortage",
    OTHER: "Other",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Extra Copy Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Review teacher requests for additional book copies.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.teacher?.name || "Unknown"}</TableCell>
                <TableCell>{r.class?.name || "—"}</TableCell>
                <TableCell>{r.book?.title || "Unknown"}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{reasonLabels[r.reason] || r.reason}</Badge></TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "pending" && (
                    <>
                      <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => rejectMutation.mutate(r.id)} disabled={rejectMutation.isPending}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No extra copy requests.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── MAIN ADMIN PAGE ───────────────────────────────────────────
export default function AdminPage({ section }: { section: string }) {
  const sections: Record<string, React.ReactNode> = {
    dashboard: <DashboardSection />,
    books: <BooksSection />,
    levels: <BookLevelsSection />,
    classes: <ClassesSection />,
    students: <StudentsSection />,
    codes: <LinkingCodesSection />,
    payments: <PaymentsSection />,
    allocations: <AllocationsSection />,
    requests: <ExtraRequestsSection />,
    users: <UsersSection />,
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {sections[section] || <DashboardSection />}
    </div>
  );
}
