import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus,
  Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight,
  QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users,
  Package, TrendingUp, TrendingDown, ClipboardList, CheckCircle2, Clock,
  XCircle, Eye, History, BarChart2, Settings, MessageSquare, ArrowLeft,
  Archive, RefreshCw, Printer
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
import { Html5Qrcode } from "html5-qrcode";
import JsBarcode from "jsbarcode";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ─── NAVIGATION HELPER ─────────────────────────────────────────
function navigateTo(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Safely format school display text — never expose raw UUIDs */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function formatSchoolDisplay(item: { schoolCode?: string | null; schoolName?: string | null; schoolId?: string | null }): string {
  const code = item.schoolCode;
  const name = item.schoolName;
  if (code && !UUID_RE.test(code)) {
    return `${name && !UUID_RE.test(name) ? name : "School"} (${code})`;
  }
  if (name && !UUID_RE.test(name)) return name;
  return "Not available";
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
        { key: "schoolProfileComplete", label: "School profile complete", done: summary.setupChecklist.schoolProfileComplete, href: "/admin/users" },
        { key: "classesCreated", label: "Classes created", done: summary.setupChecklist.classesCreated, href: "/admin/classes", count: summary.totalClasses },
        { key: "booksAdded", label: "Books added", done: summary.setupChecklist.booksAdded, href: "/admin/books", count: summary.totalBooks },
        { key: "bookLevelsCreated", label: "Book levels created", done: summary.setupChecklist.bookLevelsCreated, href: "/admin/levels", count: summary.totalBookLevels },
        { key: "bookLevelsAssignedToClasses", label: "Book levels assigned to classes", done: summary.setupChecklist.bookLevelsAssignedToClasses, href: "/admin/levels?tab=assignments" },
        { key: "studentsAdded", label: "Students added", done: summary.setupChecklist.studentsAdded, href: "/admin/students", count: summary.totalStudents },
        { key: "parentCodesGenerated", label: "Parent codes generated", done: summary.setupChecklist.parentCodesGenerated, href: "/admin/codes", count: summary.totalLinkingCodes },
        { key: "parentsLinked", label: "Parents linked", done: summary.setupChecklist.parentsLinked, href: "/admin/parents" },
        { key: "brandingDesignConfigured", label: "Branding & design configured", done: summary.setupChecklist.brandingDesignConfigured, href: "/admin/branding" },
        { key: "paymentSetupReviewed", label: "Payment setup reviewed", done: summary.setupChecklist.paymentSetupReviewed, href: "/admin/payments" },
        { key: "operationalSetupComplete", label: "Operational setup complete", done: summary.setupChecklist.operationalSetupComplete, href: "/admin/setup" },
      ]
    : [];

  const setupDependencyMap: Record<string, string | null> = {
    schoolProfileComplete: null,
    classesCreated: "schoolProfileComplete",
    booksAdded: "classesCreated",
    bookLevelsCreated: "booksAdded",
    bookLevelsAssignedToClasses: "bookLevelsCreated",
    studentsAdded: "bookLevelsAssignedToClasses",
    parentCodesGenerated: "studentsAdded",
    parentsLinked: "parentCodesGenerated",
    brandingDesignConfigured: "parentsLinked",
    paymentSetupReviewed: "brandingDesignConfigured",
    operationalSetupComplete: "paymentSetupReviewed",
  };

  const stepByKey = new Map(setupItems.map((item: any) => [item.key, item]));
  const enrichedSetupItems = setupItems.map((item: any) => {
    const prerequisite = setupDependencyMap[item.key];
    const blockedBy = prerequisite && !(stepByKey.get(prerequisite)?.done) ? prerequisite : null;
    return {
      ...item,
      blockedBy,
      blockedReason: blockedBy ? `Complete ${stepByKey.get(blockedBy)?.label?.toLowerCase() || "previous step"} first.` : null,
    };
  });

  const setupDone = enrichedSetupItems.filter((i: any) => i.done).length;
  const setupTotal = enrichedSetupItems.length;
  const setupPercent = summary?.setupProgress?.percent ?? (setupTotal > 0 ? Math.round((setupDone / setupTotal) * 100) : 0);

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

  const schoolDisplayName = summary?.school?.name || "School";
  const schoolDisplayCode = summary?.school?.code || null;
  const schoolRoleLabel = "School Admin";
  const schoolLabel = schoolDisplayCode ? `${schoolDisplayName} (${schoolDisplayCode})` : schoolDisplayName;

  const canCreateBookLevels = !!summary?.setupChecklist?.booksAdded;
  const canAddStudents = !!summary?.setupChecklist?.classesCreated;
  const canGenerateParentCodes = !!summary?.setupChecklist?.studentsAdded;
  const canReviewPayments = !!summary?.setupChecklist?.paymentSetupReviewed;
  const canManageAllocations = !!summary?.setupChecklist?.booksAdded && !!summary?.setupChecklist?.studentsAdded && (summary?.paymentsSubmitted ?? 0) > 0;

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
      label: "Create Book Level",
      description: "Group books into school book levels",
      icon: Layers,
      href: "/admin/levels",
      color: "text-violet-600",
      bg: "bg-violet-50",
      enabled: canCreateBookLevels,
      disabledReason: "Add books before creating book levels.",
    },
    {
      label: "Add Student",
      description: "Enrol a new student and assign to a class",
      icon: Users,
      href: "/admin/students",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      enabled: canAddStudents,
      disabledReason: "Create classes before adding students.",
    },
    {
      label: "Generate Parent Codes",
      description: "Create linking codes for parents to connect",
      icon: Key,
      href: "/admin/codes",
      color: "text-orange-600",
      bg: "bg-orange-50",
      enabled: canGenerateParentCodes,
      disabledReason: "Add students before generating parent codes.",
    },
    {
      label: "Review Payments",
      description: "Verify and confirm parent payment submissions",
      icon: CreditCard,
      href: "/admin/payments",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      enabled: canReviewPayments,
      disabledReason: "Complete setup prerequisites before processing live payments.",
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
      enabled: canManageAllocations,
      disabledReason: "Add books, students, and payment orders before managing allocations.",
    },
    {
      label: "View Reports",
      description: "View operational metrics, inventory, payments, and distribution reports",
      icon: BarChart2,
      href: "/admin/reports",
      color: "text-gray-600",
      bg: "bg-gray-50",
      enabled: true,
    },
  ];

  // Warnings / attention items
  const warnings = summary
    ? [
        ...(summary.lowStockBooks > 0
          ? [{ type: "warning" as const, msg: `${summary.lowStockBooks} book${summary.lowStockBooks !== 1 ? "s" : ""} running low on stock — reorder soon`, href: "/admin/books" }]
          : []),
        ...(summary.pendingPayments > 0
          ? [{ type: "warning" as const, msg: `${summary.pendingPayments} payment reference${summary.pendingPayments !== 1 ? "s" : ""} awaiting review`, href: "/admin/payments" }]
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
              {user?.name || "School Admin"} · {schoolLabel} · {schoolRoleLabel}
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

      {setupPercent < 100 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Your school setup is not complete yet.</AlertTitle>
          <AlertDescription>
            Complete the remaining setup steps before inviting parents or processing payments.
          </AlertDescription>
        </Alert>
      )}

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
            {enrichedSetupItems.map((item: any, i: number) => (
              <button
                key={i}
                onClick={() => item.href && navigateTo(item.href)}
                disabled={item.done || !!item.blockedBy}
                title={item.blockedReason || undefined}
                className={cn(
                  "flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border transition-all text-left group",
                  item.done
                    ? "bg-emerald-50/70 border-emerald-200/60 text-emerald-700 cursor-default"
                    : item.blockedBy
                      ? "bg-muted/60 border-border text-muted-foreground cursor-not-allowed"
                      : "bg-amber-50/60 border-amber-200/70 text-amber-800 hover:bg-amber-100/80 hover:border-amber-300 cursor-pointer"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : item.blockedBy ? (
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                )}
                <span className="flex-1 leading-tight">
                  <span className="font-medium block">{item.label}</span>
                  {item.blockedReason && !item.done && (
                    <span className="text-xs text-muted-foreground">{item.blockedReason}</span>
                  )}
                </span>
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
            { label: "Book Levels", href: "/admin/levels" },
            { label: "Classes", href: "/admin/classes" },
            { label: "Students", href: "/admin/students" },
            { label: "Parents", href: "/admin/parents" },
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
    awaiting_reference: { class: "bg-amber-100 text-amber-700 border-amber-200", label: "Awaiting Reference" },
    reference_submitted: { class: "bg-blue-100 text-blue-700 border-blue-200", label: "Reference Submitted" },
    confirmed: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Payment Confirmed" },
    completed: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Completed" },
    ready_for_collection: { class: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "Ready for Collection" },
    collected: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Collected" },
    cancelled: { class: "bg-gray-100 text-gray-500 border-gray-200", label: "Cancelled" },
    rejected: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    failed: { class: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
    needs_review: { class: "bg-orange-100 text-orange-700 border-orange-200", label: "Needs Review" },
    approved: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Approved" },
    allocated: { class: "bg-blue-100 text-blue-700 border-blue-200", label: "Allocated" },
    received: { class: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Received" },
    absent: { class: "bg-gray-100 text-gray-700 border-gray-200", label: "Absent" },
  };
  const c = config[status] || { class: "bg-gray-100 text-gray-700", label: status };
  return <Badge variant="outline" className={`${c.class} text-xs font-medium`}>{c.label}</Badge>;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function normalizeRole(role: string | null | undefined) {
  if (!role) return "unknown";
  if (role === "admin") return "school_admin";
  if (role === "owner" || role === "platform_admin" || role === "platform_owner") return "platform_owner";
  return role;
}

function roleLabel(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  if (normalized === "platform_owner") return "Platform Owner";
  if (normalized === "school_admin") return "School Admin";
  if (normalized === "teacher") return "Teacher";
  if (normalized === "parent") return "Parent";
  return normalized.replace(/_/g, " ");
}

function isProtectedPlatformOwner(role: string | null | undefined) {
  return normalizeRole(role) === "platform_owner";
}

const BRANDING_PERMISSION_OPTIONS = [
  { key: "BRANDING_VIEW", label: "View branding" },
  { key: "BRANDING_MANAGE", label: "Manage branding" },
  { key: "BRANDING_UPLOAD_LOGO", label: "Upload logo" },
  { key: "BRANDING_UPDATE_THEME", label: "Update theme" },
  { key: "BRANDING_RESET_DEFAULT", label: "Reset defaults" },
];

function SetupSection() {
  const { toast } = useToast();

  const { data: setup, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/setup-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/setup-complete", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Setup completed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const inviteStatusLabel: Record<string, string> = {
    not_invited: "Not invited",
    pending: "Invite pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
  };

  const setupStatusLabel: Record<string, string> = {
    school_created: "School created",
    pending_admin_invite: "Pending admin invite",
    pending_admin_acceptance: "Pending admin acceptance",
    admin_accepted: "Admin accepted",
    operational_setup_in_progress: "Setup in progress",
    operational_setup_complete: "Operational setup complete",
    complete: "Complete",
    active: "Active",
  };

  const canGoDashboard = !!setup?.firstAdminAccepted && (setup?.setupStatus === "operational_setup_in_progress" || setup?.setupStatus === "operational_setup_complete" || setup?.setupStatus === "complete" || setup?.setupStatus === "active");
  const setupComplete = !!setup?.operationalSetupCompleted && !!setup?.schoolActive;
  const firstInvitePending = setup?.firstAdminInviteStatus === "pending";
  const readyForOperationalCompletion = !!setup?.readyForOperationalCompletion;

  const setupChecklistOrder = [
    { key: "schoolProfileComplete", label: "School profile complete" },
    { key: "classesCreated", label: "Classes created" },
    { key: "booksAdded", label: "Books added" },
    { key: "bookLevelsCreated", label: "Book levels created" },
    { key: "bookLevelsAssignedToClasses", label: "Book levels assigned to classes" },
    { key: "studentsAdded", label: "Students added" },
    { key: "parentCodesGenerated", label: "Parent codes generated" },
    { key: "parentsLinked", label: "Parents linked" },
    { key: "paymentSetupReviewed", label: "Payment setup reviewed" },
    { key: "operationalSetupComplete", label: "Operational setup complete" },
  ];

  const checklistSteps = setupChecklistOrder.map((step) => ({
    ...step,
    done: !!setup?.checklist?.[step.key],
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Continue School Setup</h1>
          <p className="text-muted-foreground text-sm mt-1">Finish the remaining onboarding steps for your school tenant.</p>
        </div>
        {canGoDashboard && (
          <Button onClick={() => navigateTo("/admin")} variant="outline">Go to Dashboard</Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">School</p>
            <p className="text-lg font-semibold mt-1">{setup?.school?.name || "School setup"}</p>
            <p className="text-sm text-muted-foreground mt-1">{setup?.school?.code || "Awaiting school details"}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">Status: {(setup?.schoolStatus || setup?.school?.status || "pending_setup").replace(/_/g, " ")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Setup status</p>
            <p className="text-lg font-semibold mt-1">{setupStatusLabel[setup?.setupStatus || ""] || "Pending"}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{(setup?.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">First admin invite</p>
            <p className="text-lg font-semibold mt-1">{setup?.firstAdminEmail || setup?.invite?.email || "Not invited"}</p>
            <p className="text-sm text-muted-foreground mt-1">{inviteStatusLabel[setup?.firstAdminInviteStatus || "not_invited"] || "Not invited"}</p>
          </CardContent>
        </Card>
      </div>

      {setup && (
        <Alert className={setupComplete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          {setupComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
          <AlertTitle>{setupComplete ? "Setup complete" : firstInvitePending ? "Waiting for invite acceptance" : "Setup in progress"}</AlertTitle>
          <AlertDescription>{setup.nextStep}</AlertDescription>
        </Alert>
      )}

      {firstInvitePending && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle>Waiting for admin to accept invite</AlertTitle>
          <AlertDescription>
            The first School Admin invitation is still pending. Ask the owner to resend the invite from the Schools page if needed.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
          <CardDescription>
            {setup?.setupProgress
              ? `${setup.setupProgress.done} of ${setup.setupProgress.total} steps complete (${setup.setupProgress.percent}%).`
              : "Track the handoff from school creation to full operational readiness."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading setup progress...</p>}
          {checklistSteps.map((step) => (
            <div key={step.label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium">{step.label}</span>
              <Badge variant="outline" className={step.done ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                {step.done ? "Done" : "Pending"}
              </Badge>
            </div>
          ))}

          {!!setup?.missingSteps?.length && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Missing steps</AlertTitle>
              <AlertDescription>{setup.missingSteps.join(" · ")}</AlertDescription>
            </Alert>
          )}

          {!!setup?.completionRules?.length && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Completion rules</p>
              <div className="space-y-1">
                {setup.completionRules.map((rule: string) => (
                  <p key={rule} className="text-sm text-muted-foreground">• {rule}</p>
                ))}
              </div>
            </div>
          )}

          {!setupComplete && (
            <div className="pt-2 flex flex-wrap gap-2">
              <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || !setup?.firstAdminAccepted || !readyForOperationalCompletion}>
                {completeMutation.isPending ? "Completing..." : "Mark Setup Complete"}
              </Button>
              {!readyForOperationalCompletion && (
                <p className="text-xs text-muted-foreground self-center">Complete all prerequisite setup steps first.</p>
              )}
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] })}>
                Refresh Status
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerDashboardSection() {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/owner/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: schoolsData } = useQuery<any>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schools = Array.isArray(schoolsData) ? schoolsData : (schoolsData?.items || []);
  const schoolLabelById = new Map<string, string>(
    schools.map((school: any) => [school.id, `${school.name || "School"}${school.code ? ` (${school.code})` : ""}`]),
  );

  const formatTargetLabel = (item: any): string => {
    if (item?.targetLabel) return item.targetLabel;
    const rawTarget = String(item?.target || "");
    if (rawTarget.startsWith("school:")) {
      const schoolId = rawTarget.slice("school:".length);
      return schoolLabelById.get(schoolId) || "School";
    }
    return rawTarget || "Platform";
  };

  if (isLoading) {
    return <Card className="border-border/50 shadow-sm"><CardContent className="py-10 text-center text-muted-foreground">Loading owner dashboard...</CardContent></Card>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Owner dashboard unavailable</AlertTitle>
        <AlertDescription>{(error as Error)?.message || "Please try again."}</AlertDescription>
      </Alert>
    );
  }

  const cards = [
    { label: "Total schools", value: data?.totalSchools },
    { label: "Pending setup schools", value: data?.pendingSetupSchools },
    { label: "Pending admin invite", value: data?.pendingAdminInviteSchools },
    { label: "Pending admin acceptance", value: data?.pendingAdminAcceptanceSchools },
    { label: "Setup in progress", value: data?.setupInProgressSchools },
    { label: "Active schools", value: data?.activeSchools },
    { label: "Suspended schools", value: data?.suspendedSchools },
    { label: "Pending first admin invites", value: data?.pendingInvites },
    { label: "Expired first admin invites", value: data?.expiredInvites },
    { label: "Schools needing attention", value: data?.schoolsNeedingAttention },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">BytHub Platform Owner</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform onboarding and school lifecycle control center outside Support Mode.</p>
        </div>
        <Button variant="outline" onClick={() => navigateTo("/admin/schools")}>Manage Schools</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value ?? "Not available"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Recent setup and support activity</CardTitle>
          <CardDescription>Latest owner-level onboarding and support actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recentActivity || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No recent setup/support activity available.</p>
          )}
          {(data?.recentActivity || []).map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium capitalize">{String(item.action || "activity").replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatTargetLabel(item)}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerPendingSetupsSection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/pending-setups"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading pending setups...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load pending setups</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Pending Setups</h1>
        <p className="text-muted-foreground text-sm mt-1">Schools that are not fully onboarded yet.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Setup Status</TableHead>
              <TableHead>Invite Status</TableHead>
              <TableHead>First Admin Email</TableHead>
              <TableHead>Recommended Action</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items || []).map((item: any) => (
              <TableRow key={item.schoolId}>
                <TableCell className="font-medium">{item.schoolName}</TableCell>
                <TableCell>{item.schoolCode}</TableCell>
                <TableCell className="capitalize">{String(item.setupStatus || "").replace(/_/g, " ")}</TableCell>
                <TableCell className="capitalize">{String(item.firstAdminInviteStatus || "").replace(/_/g, " ")}</TableCell>
                <TableCell>{item.firstAdminEmail || "Not invited"}</TableCell>
                <TableCell>{item.recommendedNextAction}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(item.schoolId)}`)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
            {(data?.items || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No pending setups.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerAdminInvitesSection() {
  const { toast } = useToast();
  const { data: schools = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => apiRequest("POST", `/api/owner/invites/${inviteId}/resend`),
    onSuccess: async (response) => {
      const payload = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      if (payload.inviteLink && (payload.manualInviteLinkAllowed || import.meta.env.DEV || !payload.emailSent)) {
        navigator.clipboard.writeText(payload.inviteLink).catch(() => {});
      }
      toast({
        title: "Invite resent",
        description: payload.emailSent
          ? "Invite email sent."
          : "Email sending is not configured. Copy the invite link and send manually.",
      });
    },
    onError: (err: any) => toast({ title: "Resend failed", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => apiRequest("POST", `/api/owner/invites/${inviteId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      toast({ title: "Invite revoked" });
    },
    onError: (err: any) => toast({ title: "Revoke failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading invites...</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Admin Invites</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor and manage first School Admin invites.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>First Admin Email</TableHead>
              <TableHead>Invite Status</TableHead>
              <TableHead>Setup Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school: any) => (
              <TableRow key={school.id}>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.firstAdminEmail || "Not invited"}</TableCell>
                <TableCell className="capitalize">{String(school.firstAdminInviteStatus || "not_invited").replace(/_/g, " ")}</TableCell>
                <TableCell className="capitalize">{String(school.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!school.latestInviteId || resendMutation.isPending}
                    onClick={() => school.latestInviteId && resendMutation.mutate(school.latestInviteId)}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!school.latestInviteId || revokeMutation.isPending || school.firstAdminInviteStatus === "accepted"}
                    onClick={() => school.latestInviteId && revokeMutation.mutate(school.latestInviteId)}
                  >
                    Revoke
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
            {schools.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No schools available.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerEmailStatusSection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/email-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading email status...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load email status</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Email Status</h1>
        <p className="text-muted-foreground text-sm mt-1">Invite delivery and manual fallback monitoring.</p>
      </div>

      <Alert className={data?.emailConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        {data?.emailConfigured ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        <AlertTitle>Email configured: {data?.emailConfigured ? "Yes" : "No"}</AlertTitle>
        <AlertDescription>{data?.message}</AlertDescription>
      </Alert>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Recent first-admin invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recentInvites || []).length === 0 && <p className="text-sm text-muted-foreground">No invite activity available.</p>}
          {(data?.recentInvites || []).map((invite: any) => (
            <div key={invite.inviteId} className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{invite.schoolName}</p>
                <p className="text-xs text-muted-foreground mt-1">{invite.email} · {String(invite.status || "pending").replace(/_/g, " ")}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(invite.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerActivitySection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/activity"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: schoolsData } = useQuery<any>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schools = Array.isArray(schoolsData) ? schoolsData : (schoolsData?.items || []);
  const schoolLabelById = new Map<string, string>(
    schools.map((school: any) => [school.id, `${school.name || "School"}${school.code ? ` (${school.code})` : ""}`]),
  );

  const formatTarget = (item: any): string => {
    if (item?.targetLabel) return item.targetLabel;

    const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : null;
    const metadataSchoolName = metadata?.schoolName || metadata?.name || metadata?.school?.name;
    if (metadataSchoolName) return metadataSchoolName;

    const rawTarget = String(item?.target || "");
    if (rawTarget.startsWith("school:")) {
      const schoolId = rawTarget.slice("school:".length);
      return schoolLabelById.get(schoolId) || "School";
    }

    return rawTarget || "Platform";
  };

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading activity logs...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load activity logs</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Owner-level audit events for onboarding and support actions.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items || []).map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="capitalize">{String(item.action || "").replace(/_/g, " ")}</TableCell>
                <TableCell>{formatTarget(item)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.actorUserId || "System"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</TableCell>
              </TableRow>
            ))}
            {(data?.items || []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No activity available.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerSettingsSection() {
  const { data } = useQuery<any>({
    queryKey: ["/api/owner/email-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Owner Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-level owner controls and protected account state.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Platform profile</CardTitle>
          <CardDescription>Read-only owner-level settings in this build.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Organisation:</span> BytHub</p>
          <p><span className="font-medium">Support email configured:</span> {data?.emailConfigured ? "Yes" : "No"}</p>
          <p><span className="font-medium">Invite expiry:</span> 7 days</p>
          <p><span className="font-medium">Owner account:</span> Protected from standard role-change and delete flows</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerSchoolDetailsSection() {
  const params = new URLSearchParams(window.location.search);
  const schoolId = params.get("schoolId") || "";

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/schools/detail", schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/owner/schools/${encodeURIComponent(schoolId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load school details");
      return res.json();
    },
    enabled: !!schoolId,
  });

  if (!schoolId) {
    return <Alert><AlertTitle>No school selected</AlertTitle><AlertDescription>Select a school from the Schools page.</AlertDescription></Alert>;
  }

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading school details...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load school details</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">School details, setup lifecycle, and first admin status.</p>
        </div>
        <Button variant="outline" onClick={() => navigateTo("/admin/schools")}>Back to Schools</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">School code</p><p className="text-lg font-semibold mt-1">{data.code}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">School status</p><p className="text-lg font-semibold mt-1 capitalize">{String(data.status || "pending_setup").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Setup status</p><p className="text-lg font-semibold mt-1 capitalize">{String(data.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">First admin email</p><p className="text-sm font-medium mt-1">{data.firstAdminEmail || "Not invited"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Invite status</p><p className="text-sm font-medium mt-1 capitalize">{String(data.firstAdminInviteStatus || "not_invited").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Updated</p><p className="text-sm font-medium mt-1">{formatDateTime(data.updatedAt)}</p></CardContent></Card>
      </div>
    </div>
  );
}

function SchoolsSection() {
  const { toast } = useToast();
  const { enterSupportMode, isEnteringSupport } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [inviteSummary, setInviteSummary] = useState<{ schoolName: string; inviteLink: string; emailSent: boolean; manualInviteLinkAllowed?: boolean } | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    status: "pending_setup",
    firstAdminName: "",
    firstAdminEmail: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    notes: "",
  });

  async function handleEnterSupport(schoolId: string) {
    try {
      await enterSupportMode(schoolId);
      toast({ title: "Support mode activated" });
      navigateTo("/admin");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const { data: schools = [] } = useQuery<any[]>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const schoolResponse = await apiRequest("POST", "/api/owner/schools", data.school);
      const school = await schoolResponse.json();
      let invite: any = null;
      if (data.firstAdminName && data.firstAdminEmail) {
        const inviteResponse = await apiRequest("POST", `/api/owner/schools/${school.id}/invite-admin`, {
          adminName: data.firstAdminName,
          adminEmail: data.firstAdminEmail,
        });
        invite = await inviteResponse.json();
      }
      return { school, invite };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setAddOpen(false);
      if (result.invite) {
        setInviteSummary({
          schoolName: result.school.name,
          inviteLink: result.invite.inviteLink,
          emailSent: result.invite.emailSent,
          manualInviteLinkAllowed: result.invite.manualInviteLinkAllowed,
        });
      }
      if (result.invite?.inviteLink && (result.invite.manualInviteLinkAllowed || import.meta.env.DEV || !result.invite.emailSent)) {
        navigator.clipboard.writeText(result.invite.inviteLink).catch(() => {});
      }
      toast({
        title: "School created",
        description: result.invite
          ? result.invite.emailSent
            ? "The first School Admin invitation has been sent."
            : "Invitation email was not sent; the setup link was copied for manual sharing."
          : "School created in pending setup. Send the first admin invite when ready.",
      });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/owner/schools/${selectedSchool?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setEditOpen(false);
      toast({ title: "School updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/owner/schools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      toast({ title: "School deleted" });
    },
    onError: (err: any) => toast({ title: "Delete blocked", description: err.message, variant: "destructive" }),
  });

  const inviteAdminMutation = useMutation({
    mutationFn: ({ schoolId, adminName, adminEmail }: { schoolId: string; adminName: string; adminEmail: string }) =>
      apiRequest("POST", `/api/owner/schools/${schoolId}/invite-admin`, { adminName, adminEmail }),
    onSuccess: async (response) => {
      const payload = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setInviteSummary({
        schoolName: payload.school?.name || "School",
        inviteLink: payload.inviteLink,
        emailSent: payload.emailSent,
        manualInviteLinkAllowed: payload.manualInviteLinkAllowed,
      });
      toast({
        title: "Invite sent",
        description: payload.emailSent
          ? "First School Admin invite was sent."
          : "Email is not configured; copy and share the secure invite link.",
      });
    },
    onError: (err: any) => toast({ title: "Invite failed", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({
      name: "",
      code: "",
      status: "pending_setup",
      firstAdminName: "",
      firstAdminEmail: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      notes: "",
    });
  }

  function badgeClass(status: string) {
    if (status === "active") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "pending_setup") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
    return "";
  }

  function setupBadge(status: string) {
    if (status === "complete" || status === "active" || status === "operational_setup_complete") {
      return { label: "Complete", cls: badgeClass("active") };
    }
    if (status === "operational_setup_in_progress" || status === "admin_accepted") {
      return { label: "Setup in progress", cls: badgeClass("pending_setup") };
    }
    if (status === "pending_admin_acceptance") {
      return { label: "Pending admin acceptance", cls: badgeClass("pending_setup") };
    }
    if (status === "pending_admin_invite" || status === "school_created") {
      return { label: "Pending admin invite", cls: badgeClass("pending_setup") };
    }
    return { label: status || "Unknown", cls: badgeClass("pending_setup") };
  }

  function inviteStatusLabel(status: string | null | undefined) {
    if (!status || status === "not_invited") return "Not invited";
    if (status === "pending") return "Invite pending";
    if (status === "accepted") return "Accepted";
    if (status === "expired") return "Expired";
    if (status === "revoked") return "Revoked";
    return status;
  }

  const filtered = schools.filter((school: any) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      school.name?.toLowerCase().includes(q) ||
      school.code?.toLowerCase().includes(q) ||
      school.contactEmail?.toLowerCase().includes(q)
    );

    const setup = String(school.setupStatus || "");
    const invite = String(school.firstAdminInviteStatus || "");
    const schoolStatus = String(school.status || "");
    const matchesFilter = statusFilter === "all"
      ? true
      : statusFilter === "pending_setup"
        ? schoolStatus === "pending_setup"
        : statusFilter === "pending_admin_invite"
          ? setup === "pending_admin_invite" || setup === "school_created" || invite === "not_invited"
          : statusFilter === "pending_admin_acceptance"
            ? setup === "pending_admin_acceptance" || invite === "pending" || invite === "expired"
            : statusFilter === "setup_in_progress"
              ? setup === "admin_accepted" || setup === "operational_setup_in_progress"
              : statusFilter === "active"
                ? schoolStatus === "active"
                : statusFilter === "suspended"
                  ? schoolStatus === "suspended"
                  : true;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage school tenants, lifecycle status, and contact details.</p>
        </div>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add School
        </Button>
      </div>

      {inviteSummary && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>First School Admin invite prepared for {inviteSummary.schoolName}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {inviteSummary.emailSent
                ? "The invite email was sent successfully."
                : "The invite email was not sent, so the secure setup link is ready for manual delivery."}
            </p>
            {(inviteSummary.manualInviteLinkAllowed || import.meta.env.DEV || !inviteSummary.emailSent) && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSummary.inviteLink).then(() => {
                      toast({ title: "Invite link copied" });
                    }).catch(() => {
                      toast({ title: "Copy failed", description: inviteSummary.inviteLink, variant: "destructive" });
                    });
                  }}
                >
                  Copy setup link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInviteSummary(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search schools..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending_setup">Pending setup</SelectItem>
            <SelectItem value="pending_admin_invite">Pending admin invite</SelectItem>
            <SelectItem value="pending_admin_acceptance">Pending admin acceptance</SelectItem>
            <SelectItem value="setup_in_progress">Setup in progress</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Setup</TableHead>
              <TableHead>First Admin</TableHead>
              <TableHead>Invite Status</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Admins</TableHead>
              <TableHead>Teachers</TableHead>
              <TableHead>Parents</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Books</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((school: any) => (
              <TableRow key={school.id}>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell className="text-muted-foreground">{school.code}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={badgeClass(school.status)}>{school.status || "unknown"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={setupBadge(school.setupStatus).cls}>
                    {setupBadge(school.setupStatus).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{school.firstAdminEmail || "Not invited"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={badgeClass(school.firstAdminInviteStatus === "accepted" ? "active" : school.firstAdminInviteStatus === "pending" ? "pending_setup" : "suspended")}>
                    {inviteStatusLabel(school.firstAdminInviteStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{school.contactEmail || "Not available"}</TableCell>
                <TableCell>{school.counts?.admins ?? 0}</TableCell>
                <TableCell>{school.counts?.teachers ?? 0}</TableCell>
                <TableCell>{school.counts?.parents ?? 0}</TableCell>
                <TableCell>{school.counts?.students ?? 0}</TableCell>
                <TableCell>{school.counts?.books ?? 0}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}
                  >
                    View
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={inviteAdminMutation.isPending}
                    onClick={() => {
                      const adminName = school.firstAdminName || window.prompt("First School Admin full name:") || "";
                      const adminEmail = school.firstAdminEmail || window.prompt("First School Admin email:") || "";
                      if (!adminName || !adminEmail) return;
                      inviteAdminMutation.mutate({ schoolId: school.id, adminName, adminEmail });
                    }}
                  >
                    {school.firstAdminInviteStatus === "pending" ? "Resend" : "Invite Admin"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}
                  >
                    Setup Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isEnteringSupport}
                    onClick={() => handleEnterSupport(school.id)}
                  >
                    {isEnteringSupport ? "Entering..." : "Support"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSchool(school);
                      setForm({
                        name: school.name || "",
                        code: school.code || "",
                        status: school.status || "pending_setup",
                        firstAdminName: "",
                        firstAdminEmail: "",
                        contactEmail: school.contactEmail || "",
                        contactPhone: school.contactPhone || "",
                        address: school.address || "",
                        notes: school.notes || "",
                      });
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSchool(school);
                      updateMutation.mutate({ status: school.status === "suspended" ? "active" : "suspended" });
                    }}
                  >
                    {school.status === "suspended" ? "Activate" : "Suspend"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`Delete school ${school.name}? This only works if no related data exists.`)) {
                        deleteMutation.mutate(school.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">{search ? "No matching schools" : "No schools found"}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add School</DialogTitle>
            <DialogDescription>Create a new tenant, then invite the first School Admin to continue setup.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2"><Label>School Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>School Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. HILLTOP-PRIMARY" /></div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Status will be created as Pending Setup by default.</div>
            <div className="grid gap-2">
              <Label>First School Admin Name (optional)</Label>
              <Input value={form.firstAdminName} onChange={(e) => setForm({ ...form, firstAdminName: e.target.value })} placeholder="Full name of the first School Admin" />
            </div>
            <div className="grid gap-2">
              <Label>First School Admin Email (optional)</Label>
              <Input type="email" value={form.firstAdminEmail} onChange={(e) => setForm({ ...form, firstAdminEmail: e.target.value })} placeholder="admin@school.edu" />
            </div>
            <div className="grid gap-2"><Label>Contact Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({
              school: {
                name: form.name,
                code: form.code,
                contactEmail: form.contactEmail || null,
                contactPhone: form.contactPhone || null,
                address: form.address || null,
                notes: form.notes || null,
              },
              firstAdminName: form.firstAdminName,
              firstAdminEmail: form.firstAdminEmail,
            })} disabled={createMutation.isPending || !form.name || !form.code}>
              {createMutation.isPending ? "Creating..." : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>Update school identity, lifecycle status, and owner notes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2"><Label>School Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>School Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_setup">Pending setup</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Contact Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending || !form.name || !form.code}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── USERS ─────────────────────────────────────────────────────
function UsersSection() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const requesterIsOwner = normalizeRole(currentUser?.role) === "platform_owner";
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "" });
  const [inviteRole, setInviteRole] = useState("teacher");
  const [brandingPermissions, setBrandingPermissions] = useState<string[]>([]);

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/admin/users"], queryFn: getQueryFn({ on401: "throw" }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invites", { email: data.email, role: data.role }),
    onSuccess: () => {
      setAddOpen(false);
      resetForm();
      toast({ title: "Invite sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/users/${selectedUser?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); setEditOpen(false); toast({ title: "User updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/users/${selectedUser?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); setDeleteOpen(false); toast({ title: "User deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() {
    setForm({ username: "", password: "", name: "", email: "" });
    setInviteRole("teacher");
    setBrandingPermissions([]);
  }

  const selectedUserIsIT = normalizeRole(selectedUser?.role) === "it_personnel";

  function toggleBrandingPermission(permission: string, checked: boolean) {
    setBrandingPermissions((current) => {
      if (checked) {
        if (current.includes(permission)) return current;
        return [...current, permission];
      }
      return current.filter((item) => item !== permission);
    });
  }

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).filter((u: any) => schoolFilter === "all" ? true : u.schoolId === schoolFilter);

  const schoolOptions = Array.from(new Map(
    users
      .filter((u: any) => !!u.schoolId)
      .map((u: any) => [
        u.schoolId,
        {
          value: u.schoolId,
          label: formatSchoolDisplay(u),
        },
      ]),
  ).values());

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage admin, teacher, and parent accounts.</p>
        </div>
        <Button data-testid="button-add-user" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Invite Staff
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search users..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {requesterIsOwner && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {schoolOptions.map((school: any) => (
                <SelectItem key={school.value} value={school.value}>{school.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Linked Children</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
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
                  <Badge variant={isProtectedPlatformOwner(u.role) ? "default" : normalizeRole(u.role) === "teacher" ? "secondary" : "outline"}>
                    {roleLabel(u.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={u.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                    {u.status || "unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatSchoolDisplay(u)}</TableCell>
                <TableCell>{u.linkedChildrenCount ?? 0}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDateTime(u.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDateTime(u.lastLoginAt)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {!isProtectedPlatformOwner(u.role) && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedUser(u);
                      setForm({ username: u.username || "", password: "", name: u.name || "", email: u.email || "" });
                      setBrandingPermissions(Array.isArray(u.brandingPermissions) ? u.brandingPermissions : []);
                      setEditOpen(true);
                    }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {currentUser?.id !== u.id && !isProtectedPlatformOwner(u.role) && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedUser(u); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{search ? "No matching users" : "No users found"}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>Send an invitation email so the staff member can set up their own account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sarah@school.edu" /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="school_admin">School Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ email: form.email, role: inviteRole })} disabled={createMutation.isPending || !form.email}>
              {createMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Role changes are restricted to secure onboarding workflows.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div className="grid gap-2"><Label>New Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            {currentUser?.id === selectedUser?.id ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Role locked</AlertTitle>
                <AlertDescription>You cannot change your own admin role.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Role changes disabled</AlertTitle>
                <AlertDescription>Use invite and onboarding workflows to assign parent, teacher, or admin roles safely.</AlertDescription>
              </Alert>
            )}
            {requesterIsOwner && selectedUserIsIT && (
              <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Branding Permissions</p>
                  <p className="text-xs text-muted-foreground">Choose what this IT user can do in school branding.</p>
                </div>
                <div className="grid gap-2">
                  {BRANDING_PERMISSION_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={brandingPermissions.includes(option.key)}
                        onChange={(event) => toggleBrandingPermission(option.key, event.target.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              const payload: any = { name: form.name, username: form.username, email: form.email };
              if (form.password) payload.password = form.password;
              if (requesterIsOwner && selectedUserIsIT) {
                payload.brandingPermissions = brandingPermissions;
              }
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

function ParentsSection() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  const endpoint = (() => {
    const params = new URLSearchParams();
    if (schoolFilter !== "all") params.set("schoolId", schoolFilter);
    const query = params.toString();
    return query ? `/api/admin/parents?${query}` : "/api/admin/parents";
  })();

  const {
    data: parents = [],
    isLoading,
    isError,
    error,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/parents", schoolFilter],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load parents");
      return res.json();
    },
  });

  const filtered = parents.filter((p: any) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ? true
      : statusFilter === "linked" ? (p.linkedChildrenCount ?? 0) > 0
      : statusFilter === "unlinked" ? (p.linkedChildrenCount ?? 0) === 0
      : statusFilter === "pending-signup" ? p.parentStatus === "invited"
      : statusFilter === "invite-pending" ? p.signupStatus === "Invite pending"
      : statusFilter === "unpaid" ? (p.unpaidBasketsCount ?? 0) > 0
      : statusFilter === "awaiting-collection" ? (p.paidAwaitingCollectionCount ?? 0) > 0
      : statusFilter === "completed-handover" ? p.collectionStatus === "completed"
      : p.parentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const schools = Array.from(new Map(
    parents
      .filter((p: any) => !!p.schoolId)
      .map((p: any) => [
        p.schoolId,
        {
          value: p.schoolId,
          label: formatSchoolDisplay(p),
        },
      ]),
  ).values()).sort((a: any, b: any) => a.label.localeCompare(b.label));

  const totalLinkedChildren = parents.reduce((acc, p: any) => acc + (p.linkedChildrenCount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Parents</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor parent accounts, child links, and payment readiness.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Parents: {parents.length}</Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Linked Children: {totalLinkedChildren}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search parents..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {normalizeRole(currentUser?.role) === "platform_owner" && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map((school: any) => (
                <SelectItem key={school.value} value={school.value}>{school.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="linked">Linked parents</SelectItem>
            <SelectItem value="unlinked">Unlinked parents</SelectItem>
            <SelectItem value="pending-signup">Pending signup</SelectItem>
            <SelectItem value="invite-pending">Invite pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="unpaid">Unpaid baskets/orders</SelectItem>
            <SelectItem value="awaiting-collection">Paid awaiting collection</SelectItem>
            <SelectItem value="completed-handover">Completed handover</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">Loading parent accounts...</CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load parents</AlertTitle>
          <AlertDescription>{(error as Error)?.message || "Please try again."}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border-border/50 shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Linked Children</TableHead>
                <TableHead>Linked Student Names</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead>Signup/Invite</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((parent: any) => (
                <TableRow key={parent.id}>
                  <TableCell className="font-medium">{parent.name || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground">{parent.email || "Not available"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={parent.parentStatus === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                      {parent.parentStatus || "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatSchoolDisplay(parent)}</TableCell>
                  <TableCell>{parent.linkedChildrenCount ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(parent.linkedStudents || []).length > 0
                      ? parent.linkedStudents.map((s: any) => s.name).filter(Boolean).join(", ")
                      : "Not available"}
                  </TableCell>
                  <TableCell>{parent.completedPaymentsCount ?? 0}/{parent.paymentsCount ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.lastPaymentAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{parent.signupStatus || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{parent.collectionStatus || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">{search || statusFilter !== "all" ? "No matching parents found" : "No parent accounts found"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
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
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedClass(cls); setDeleteOpen(true); }}>
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
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedStudent(student); setDeleteOpen(true); }}>
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
  const { user } = useAuth();
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
  const [barcodeBook, setBarcodeBook] = useState<any>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanNotFound, setScanNotFound] = useState(false);

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

  // Render barcode when dialog opens
  useEffect(() => {
    if (barcodeOpen && barcodeBook?.bookCode && barcodeRef.current) {
      try { JsBarcode(barcodeRef.current, barcodeBook.bookCode, { format: "CODE128", width: 2, height: 80, displayValue: true, fontSize: 14, margin: 10 }); } catch {}
    }
  }, [barcodeOpen, barcodeBook]);

  async function handleScanInput(code: string) {
    if (!code.trim()) return;
    setScanNotFound(false); setScanResult(null);
    try {
      const res = await fetch(`/api/books/scan/${encodeURIComponent(code.trim())}`, { credentials: "include" });
      if (res.ok) { const book = await res.json(); setScanResult(book); setScanNotFound(false); }
      else { setScanNotFound(true); }
    } catch { setScanNotFound(true); }
  }

  function printBarcode(book: any) {
    const svg = document.querySelector("#barcode-print-area svg");
    if (!svg) return;
    const schoolLabel = (user as any)?.schoolName || (user as any)?.schoolCode || "";
    const win = window.open("", "_blank", "width=420,height=350");
    if (!win) return;
    win.document.write(`<html><head><title>Barcode - ${book.title}</title><style>body{text-align:center;font-family:sans-serif;padding:20px;margin:0}.school{font-size:11px;color:#888;margin-bottom:2px}.title{font-size:15px;font-weight:bold;margin:4px 0 2px}.author{font-size:12px;color:#666;margin:0 0 8px}.code{font-size:11px;color:#555;font-family:monospace;margin-top:6px}@media print{body{padding:8px}}</style></head><body>${schoolLabel ? `<p class="school">${schoolLabel}</p>` : ""}<p class="title">${book.title}</p>${book.author ? `<p class="author">${book.author}</p>` : ""}${svg.outerHTML}<p class="code">${book.bookCode}</p><script>window.print();window.close();</script></body></html>`);
    win.document.close();
  }

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

  const filtered = books.filter((b: any) => b.title?.toLowerCase().includes(search.toLowerCase()) || b.author?.toLowerCase().includes(search.toLowerCase()) || b.isbn?.toLowerCase().includes(search.toLowerCase()) || b.bookCode?.toLowerCase().includes(search.toLowerCase()));

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search by title, author, ISBN, or book code..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="relative max-w-xs">
          <ScanBarcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Scan or type book code..." className="pl-9 bg-card font-mono" value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { handleScanInput(scanInput); } }} />
        </div>
      </div>
      {scanResult && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Book Found</AlertTitle>
          <AlertDescription className="text-emerald-700">
            <strong>{scanResult.title}</strong> by {scanResult.author || "Unknown"} — Stock: {scanResult.stockQuantity || 0} — Code: <span className="font-mono">{scanResult.bookCode}</span>
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => { setScanResult(null); setScanInput(""); }}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}
      {scanNotFound && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>No book matches code "{scanInput}". <Button variant="ghost" size="sm" onClick={() => { setScanNotFound(false); setScanInput(""); }}>Dismiss</Button></AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Book Code</TableHead>
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
                  <TableCell className="text-sm font-mono">
                    {book.bookCode ? (
                      <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1 font-mono text-xs" onClick={() => { setBarcodeBook(book); setBarcodeOpen(true); }}>{book.bookCode}</Button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
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
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedBook(book); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{search ? "No matching books" : "No books yet. Add your first book above."}</TableCell></TableRow>
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

      {/* Barcode View/Print Dialog */}
      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Book Barcode (CODE128)</DialogTitle>
            <DialogDescription>{barcodeBook?.title}{barcodeBook?.author ? ` — ${barcodeBook.author}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 py-4" id="barcode-print-area">
            {(user as any)?.schoolName && <p className="text-xs text-muted-foreground">{(user as any).schoolName}</p>}
            {barcodeBook?.bookCode && <svg ref={barcodeRef} />}
            <p className="text-sm font-mono font-medium">{barcodeBook?.bookCode}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeOpen(false)}>Close</Button>
            <Button onClick={() => printBarcode(barcodeBook)}><Printer className="w-4 h-4 mr-2" /> Print Label</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <p className="text-muted-foreground text-sm mt-1">Create book levels and assign them to classes.</p>
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
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => removeItemMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
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
  const [reviewNote, setReviewNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"], queryFn: getQueryFn({ on401: "throw" }) });

  const resetDialog = () => { setDetailOpen(false); setReviewNote(""); };

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/confirm`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Payment confirmed & books allocated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/reject`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Payment rejected — parent can resubmit" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const needsReviewMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/needs-review`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Payment flagged for review" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const readyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/ready-for-collection`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Order marked ready for collection" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const collectedMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/collected`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Order marked as collected" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/cancel`, { reviewNote: reviewNote.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); resetDialog(); toast({ title: "Order cancelled" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const anyMutationPending = confirmMutation.isPending || rejectMutation.isPending || needsReviewMutation.isPending || readyMutation.isPending || collectedMutation.isPending || cancelMutation.isPending;
  const isReviewActionable = (status: string) => ["reference_submitted", "needs_review"].includes(status);
  const isFulfilmentActionable = (status: string) => ["confirmed", "ready_for_collection"].includes(status);
  const isActionable = (status: string) => isReviewActionable(status) || isFulfilmentActionable(status);
  const filteredPayments = statusFilter === "all" ? payments : payments.filter((p: any) => p.status === statusFilter);
  const actionableCount = payments.filter((p: any) => isActionable(p.status)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Payment Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review parent payment references submitted via external payment apps.
          {actionableCount > 0 && <span className="ml-2 text-blue-600 font-medium">{actionableCount} awaiting review</span>}
        </p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Filter by status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({payments.length})</SelectItem>
            <SelectItem value="awaiting_reference">Awaiting Reference</SelectItem>
            <SelectItem value="reference_submitted">Reference Submitted</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="ready_for_collection">Ready for Collection</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Order Ref</TableHead>
              <TableHead>Payment Ref #</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.map((p: any) => (
              <TableRow key={p.id} className={isActionable(p.status) ? "bg-blue-50/40" : undefined}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.paymentReference}</TableCell>
                <TableCell className="font-mono text-sm font-medium">{p.paymentReferenceNumber || <span className="text-muted-foreground italic">Not submitted</span>}</TableCell>
                <TableCell className="text-muted-foreground">{p.parentIdentifier}</TableCell>
                <TableCell className="font-medium">£{parseFloat(p.totalAmount || "0").toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.paymentReferenceSubmittedAt ? new Date(p.paymentReferenceSubmittedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPayment(p); setReviewNote(""); setDetailOpen(true); }}>
                    {isActionable(p.status) ? <ClipboardList className="w-4 h-4 text-blue-600" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredPayments.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {statusFilter === "all" ? "No payments yet." : `No payments with status "${statusFilter.replace(/_/g, " ")}".`}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDetailOpen(true); }}>
        {selectedPayment && (
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Payment Review</DialogTitle>
              <DialogDescription>Order: {selectedPayment.paymentReference}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Key details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{selectedPayment.parentIdentifier}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-primary">£{parseFloat(selectedPayment.totalAmount || "0").toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selectedPayment.status} /></div>
                <div><span className="text-muted-foreground">Created:</span> <span>{selectedPayment.paidAt ? new Date(selectedPayment.paidAt).toLocaleDateString() : "—"}</span></div>
              </div>

              {/* External payment reference */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">External Payment Reference</p>
                {selectedPayment.paymentReferenceNumber ? (
                  <>
                    <p className="font-mono text-lg font-bold">{selectedPayment.paymentReferenceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {selectedPayment.paymentReferenceSubmittedAt ? new Date(selectedPayment.paymentReferenceSubmittedAt).toLocaleString() : "—"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Parent has not submitted a reference yet.</p>
                )}
              </div>

              {/* Previous review info (if already reviewed) */}
              {selectedPayment.paymentReviewedAt && (
                <div className="rounded-lg border border-dashed p-3 space-y-1 bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Previous Review</p>
                  <p className="text-sm">
                    Reviewed {new Date(selectedPayment.paymentReviewedAt).toLocaleString()}
                    {selectedPayment.paymentReviewedBy && <span className="text-muted-foreground"> by {selectedPayment.paymentReviewedBy}</span>}
                  </p>
                  {selectedPayment.paymentReviewNote && (
                    <p className="text-sm"><span className="text-muted-foreground">Note:</span> {selectedPayment.paymentReviewNote}</p>
                  )}
                </div>
              )}

              {/* Parent notes */}
              {selectedPayment.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Parent notes:</span> {selectedPayment.notes}</div>
              )}

              {/* Review note input — only for actionable statuses */}
              {isActionable(selectedPayment.status) && (
                <div className="space-y-2">
                  <Label>Review Note (optional)</Label>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a note about this review decision..."
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Payment review actions — for reference_submitted / needs_review */}
            {isReviewActionable(selectedPayment.status) && (
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="warning"
                  onClick={() => needsReviewMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                  Flag for Review
                </Button>
                <Button variant="destructive"
                  onClick={() => rejectMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                  {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Reject
                </Button>
                <Button variant="success"
                  onClick={() => confirmMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                  {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirm & Allocate
                </Button>
              </DialogFooter>
            )}

            {/* Fulfilment actions — for confirmed / ready_for_collection */}
            {isFulfilmentActionable(selectedPayment.status) && (
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="destructive"
                  onClick={() => cancelMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                  Cancel Order
                </Button>
                {selectedPayment.status === "confirmed" && (
                  <Button variant="default"
                    onClick={() => readyMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                    {readyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Mark Ready for Collection
                  </Button>
                )}
                <Button variant="success"
                  onClick={() => collectedMutation.mutate(selectedPayment.id)} disabled={anyMutationPending}>
                  {collectedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Mark Collected
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
                      <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => rejectMutation.mutate(r.id)} disabled={rejectMutation.isPending}>
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

// ─── COMMUNICATIONS OVERSIGHT ─────────────────────────────────
function CommunicationsSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ── Thread list query
  const { data: threads = [], isLoading: threadsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/communications", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await apiRequest("GET", `/api/admin/communications${params}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  // ── Thread detail query
  const { data: threadDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/admin/communications", selectedThreadId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/communications/${selectedThreadId}`);
      return res.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: selectedThreadId ? 8000 : false,
  });

  // ── Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ threadId, status, reason }: { threadId: string; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/communications/${threadId}/status`, { status, reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thread status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communications"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    },
  });

  // ── Filter threads by search
  const filteredThreads = threads.filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.subject || "").toLowerCase().includes(q) ||
      (t.parentName || "").toLowerCase().includes(q) ||
      (t.teacherName || "").toLowerCase().includes(q) ||
      (t.studentName || "").toLowerCase().includes(q)
    );
  });

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "closed": return "secondary";
      case "archived": return "outline";
      default: return "default";
    }
  };

  // ── Detail view
  if (selectedThreadId) {
    const thread = threadDetail?.thread;
    const messages = threadDetail?.messages || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to threads
          </Button>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : thread ? (
          <>
            {/* Thread metadata */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{thread.subject || "No Subject"}</CardTitle>
                    <CardDescription className="mt-1">Thread #{thread.id}</CardDescription>
                  </div>
                  <Badge variant={statusBadgeVariant(thread.status)}>{thread.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{thread.parentName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Teacher:</span> <span className="font-medium">{thread.teacherName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{thread.studentName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{formatDateTime(thread.createdAt)}</span></div>
                </div>

                {/* Admin actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  {thread.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "closed" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Close Thread
                    </Button>
                  )}
                  {thread.status === "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "open" })}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Reopen Thread
                    </Button>
                  )}
                  {thread.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "archived" })}
                    >
                      <Archive className="h-4 w-4 mr-1" /> Archive Thread
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Messages ({messages.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No messages in this thread.</p>
                )}
                {messages.map((msg: any) => (
                  <div key={msg.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{msg.senderName || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Thread not found.</CardContent></Card>
        )}
      </div>
    );
  }

  // ── List view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Communication Oversight
        </h2>
        <p className="text-muted-foreground mt-1">Monitor and manage all parent-teacher conversations across the school.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or subject..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread table */}
      <Card>
        <CardContent className="p-0">
          {threadsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Messages</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThreads.map((t: any) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedThreadId(t.id)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{t.subject || "No Subject"}</TableCell>
                    <TableCell>{t.parentName || "—"}</TableCell>
                    <TableCell>{t.teacherName || "—"}</TableCell>
                    <TableCell>{t.studentName || "—"}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge></TableCell>
                    <TableCell className="text-center">{t.totalMessages ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.updatedAt)}</TableCell>
                  </TableRow>
                ))}
                {filteredThreads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No threads match your search." : "No communication threads found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BrandingSection() {
  const { toast } = useToast();
  const { data: branding, isLoading } = useQuery<any>({
    queryKey: ["/api/school/branding"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [primaryColour, setPrimaryColour] = useState("#2563EB");
  const [secondaryColour, setSecondaryColour] = useState("#1E3A8A");
  const [accentColour, setAccentColour] = useState("#0EA5E9");
  const [themeName, setThemeName] = useState("");
  const [fontPreference, setFontPreference] = useState("system");

  useEffect(() => {
    if (!branding) return;
    setPrimaryColour(branding.primaryColour || "#2563EB");
    setSecondaryColour(branding.secondaryColour || "#1E3A8A");
    setAccentColour(branding.accentColour || "#0EA5E9");
    setThemeName(branding.themeName || "");
    setFontPreference(branding.fontPreference || "system");
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/school/branding", {
        primaryColour,
        secondaryColour,
        accentColour,
        themeName,
        fontPreference,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding updated", description: "Theme colours and settings were saved." });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/school/branding/reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding reset", description: "Defaults restored for this school." });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/setup/branding-skip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding skipped", description: "Setup checklist updated for branding." });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ endpoint, file }: { endpoint: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Asset uploaded", description: "Branding asset saved." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error?.message || "Unable to upload file", variant: "destructive" });
    },
  });

  const onUpload = (endpoint: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ endpoint, file });
    event.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Branding & Design Identity</h2>
        <p className="text-sm text-muted-foreground">Configure tenant-specific colours, theme metadata, and visual assets.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theme Settings</CardTitle>
            <CardDescription>These values are used across login, dashboard, and invite flows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branding-primary">Primary</Label>
                <Input id="branding-primary" type="color" value={primaryColour} onChange={(e) => setPrimaryColour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding-secondary">Secondary</Label>
                <Input id="branding-secondary" type="color" value={secondaryColour} onChange={(e) => setSecondaryColour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding-accent">Accent</Label>
                <Input id="branding-accent" type="color" value={accentColour} onChange={(e) => setAccentColour(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-theme-name">Theme Name</Label>
              <Input id="branding-theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Default" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-font">Font Preference</Label>
              <Input id="branding-font" value={fontPreference} onChange={(e) => setFontPreference(e.target.value)} placeholder="system" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Theme"}
              </Button>
              <Button variant="outline" onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}>
                {skipMutation.isPending ? "Skipping..." : "Skip In Setup"}
              </Button>
              <Button variant="destructive" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "Resetting..." : "Reset To Default"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>Supported formats: PNG, JPG, JPEG, WEBP. Max size 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "branding-logo", label: "Logo", endpoint: "/api/school/branding/logo", currentUrl: branding?.logoUrl },
              { id: "branding-banner", label: "Banner", endpoint: "/api/school/branding/banner", currentUrl: branding?.bannerImageUrl },
              { id: "branding-favicon", label: "Favicon", endpoint: "/api/school/branding/favicon", currentUrl: branding?.faviconUrl },
              { id: "branding-email-logo", label: "Email Logo", endpoint: "/api/school/branding/email-logo", currentUrl: branding?.emailHeaderLogoUrl },
              { id: "branding-pdf-logo", label: "PDF Logo", endpoint: "/api/school/branding/pdf-logo", currentUrl: branding?.pdfLogoUrl },
            ].map((asset) => (
              <div key={asset.id} className="space-y-2">
                <Label htmlFor={asset.id}>{asset.label}</Label>
                <div className="flex items-center gap-3">
                  {asset.currentUrl && (
                    <img src={asset.currentUrl} alt={asset.label} className="h-10 w-10 rounded border object-contain bg-muted flex-shrink-0" />
                  )}
                  <Input id={asset.id} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={onUpload(asset.endpoint)} className="flex-1" />
                </div>
              </div>
            ))}
            {uploadMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>Preview of current logo and colour palette.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="h-14 px-4 flex items-center justify-between" style={{ backgroundColor: primaryColour }}>
              <div className="text-white font-semibold">{branding?.schoolName || "Your School"}</div>
              {branding?.logoUrl && <img src={branding.logoUrl} alt="School logo" className="h-8 w-auto object-contain bg-white rounded px-1" />}
            </div>
            <div className="p-4 grid md:grid-cols-3 gap-3 bg-background">
              <div className="h-16 rounded-md" style={{ backgroundColor: primaryColour }} />
              <div className="h-16 rounded-md" style={{ backgroundColor: secondaryColour }} />
              <div className="h-16 rounded-md" style={{ backgroundColor: accentColour }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── REPORTS SECTION ──────────────────────────────────────────
function ReportsSection() {
  const { data: report, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/reports"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load reports. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  const inv = report.inventory;
  const pay = report.payments;
  const alloc = report.allocations;
  const ecr = report.extraCopyRequests;
  const cls = report.classes;
  const pl = report.parentLinking;
  const bl = report.bookLevels;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart2 className="h-6 w-6" /> School Reports
        </h2>
        <p className="text-muted-foreground mt-1">
          Operational metrics and data summaries — generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Books</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{inv.activeBooks}</div><p className="text-xs text-muted-foreground">{inv.totalStockUnits} units in stock</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{report.students.total}</div><p className="text-xs text-muted-foreground">{cls.total} classes</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Payments Verified</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{pay.confirmed}</div><p className="text-xs text-muted-foreground">{pay.referenceSubmitted + (pay.needsReview || 0)} awaiting review</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Parent Link Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pl.linkRate}%</div><p className="text-xs text-muted-foreground">{pl.used}/{pl.totalCodes} codes used</p></CardContent>
        </Card>
      </div>

      {/* ── Inventory Report ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Inventory Report</CardTitle>
          <CardDescription>Stock levels, value, and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Active titles:</span> <strong>{inv.activeBooks}</strong></div>
            <div><span className="text-muted-foreground">Total stock units:</span> <strong>{inv.totalStockUnits}</strong></div>
            <div><span className="text-muted-foreground">Stock value:</span> <strong>${inv.totalStockValue.toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">Out of stock:</span> <strong className={inv.outOfStockCount > 0 ? "text-red-600" : ""}>{inv.outOfStockCount}</strong></div>
          </div>
          {inv.lowStockBooks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Low Stock Books ({inv.lowStockBooks.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lowStockBooks.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={b.stock === 0 ? "destructive" : "secondary"}>{b.stock ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{b.threshold ?? 10}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Report ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment Report</CardTitle>
          <CardDescription>Payment status breakdown and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Total payments</span>
              <div className="text-xl font-bold">{pay.total}</div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Revenue (verified)</span>
              <div className="text-xl font-bold text-green-600">${pay.totalRevenue.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Pending revenue</span>
              <div className="text-xl font-bold text-yellow-600">${pay.pendingRevenue.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {pay.awaitingReference} Awaiting Ref</Badge>
            <Badge className="gap-1 bg-blue-600"><ClipboardList className="h-3 w-3" /> {pay.referenceSubmitted} Submitted</Badge>
            <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> {pay.confirmed} Confirmed</Badge>
            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {pay.rejected} Rejected</Badge>
            {(pay.needsReview || 0) > 0 && <Badge className="gap-1 bg-orange-500"><AlertTriangle className="h-3 w-3" /> {pay.needsReview} Review</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* ── Distribution / Allocation Report ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BoxSelect className="h-5 w-5" /> Distribution Report</CardTitle>
          <CardDescription>Book allocation and teacher confirmation status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total allocations:</span> <strong>{alloc.total}</strong></div>
            <div><span className="text-muted-foreground">Awaiting confirmation:</span> <strong className="text-yellow-600">{alloc.allocated}</strong></div>
            <div><span className="text-muted-foreground">Confirmed:</span> <strong className="text-green-600">{alloc.confirmed}</strong></div>
            <div><span className="text-muted-foreground">Confirmation rate:</span> <strong>{alloc.confirmationRate}%</strong></div>
          </div>
        </CardContent>
      </Card>

      {/* ── Extra Copy Requests ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Extra Copy Requests</CardTitle>
          <CardDescription>Teacher requests for additional book copies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {ecr.pending} Pending</Badge>
            <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> {ecr.approved} Approved</Badge>
            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {ecr.rejected} Rejected</Badge>
          </div>
          {Object.keys(ecr.byReason).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">By Reason</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ecr.byReason).map(([reason, count]) => (
                  <Badge key={reason} variant="outline">{reason.replace(/_/g, " ")}: {count as number}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Class Distribution Report ── */}
      {cls.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Class Distribution</CardTitle>
            <CardDescription>Per-class student count and book distribution progress</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Allocations</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cls.details.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.grade || "—"}</TableCell>
                    <TableCell className="text-right">{c.studentCount}</TableCell>
                    <TableCell className="text-right">{c.totalAllocations}</TableCell>
                    <TableCell className="text-right">{c.confirmedAllocations}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.completionRate === 100 ? "default" : c.completionRate > 50 ? "secondary" : "outline"}>
                        {c.completionRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Users Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Users Summary</CardTitle>
          <CardDescription>Users by role in this school</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(report.users.byRole).map(([role, count]) => (
              <Badge key={role} variant="outline" className="text-sm py-1 px-3">
                {role.replace(/_/g, " ")}: {count as number}
              </Badge>
            ))}
            <Badge variant="secondary" className="text-sm py-1 px-3">Total: {report.users.total}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Book Levels Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Book Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Book levels created:</span> <strong>{bl.total}</strong></div>
            <div><span className="text-muted-foreground">Assigned to classes:</span> <strong>{bl.assignedToClasses}</strong></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN ADMIN PAGE ───────────────────────────────────────────
export default function AdminPage({ section }: { section: string }) {
  const { user } = useAuth();
  const requesterIsOwner = normalizeRole(user?.role) === "platform_owner";
  const inSupportMode = requesterIsOwner && user?.supportMode?.active;

  const sections: Record<string, React.ReactNode> = {
    owner: <OwnerDashboardSection />,
    schools: <SchoolsSection />,
    "school-details": <OwnerSchoolDetailsSection />,
    "pending-setups": <OwnerPendingSetupsSection />,
    "admin-invites": <OwnerAdminInvitesSection />,
    "email-status": <OwnerEmailStatusSection />,
    activity: <OwnerActivitySection />,
    "owner-settings": <OwnerSettingsSection />,
    setup: <SetupSection />,
    dashboard: <DashboardSection />,
    books: <BooksSection />,
    levels: <BookLevelsSection />,
    classes: <ClassesSection />,
    students: <StudentsSection />,
    parents: <ParentsSection />,
    codes: <LinkingCodesSection />,
    payments: <PaymentsSection />,
    allocations: <AllocationsSection />,
    requests: <ExtraRequestsSection />,
    communications: <CommunicationsSection />,
    users: <UsersSection />,
    branding: <BrandingSection />,
    reports: <ReportsSection />,
  };


  let resolvedSection = section;
  const ownerOnlySections = new Set(["owner", "schools", "school-details", "pending-setups", "admin-invites", "email-status", "activity", "owner-settings"]);

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
      {sections[resolvedSection] || <DashboardSection />}
    </div>
  );
}
