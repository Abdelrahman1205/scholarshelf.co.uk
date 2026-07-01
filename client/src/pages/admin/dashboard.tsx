import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus,
  Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight,
  QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users,
  Package, TrendingUp, TrendingDown, ClipboardList, CheckCircle2, Clock,
  XCircle, Eye, History, BarChart2, Settings, MessageSquare, ArrowLeft,
  Archive, RefreshCw, Printer, ShieldAlert, ShieldOff, Ban
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  navigateTo, formatSchoolDisplay, StatusBadge, formatDateTime,
  normalizeRole, roleLabel, isProtectedPlatformOwner, BRANDING_PERMISSION_OPTIONS
} from "./shared";

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
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
        { key: "parentCodesGenerated", label: "Parent invites sent", done: summary.setupChecklist.parentCodesGenerated, href: "/admin/codes", count: summary.totalLinkingCodes },
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
          label: "Students Without Invites", value: summary.parentCodesNotSent,
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
      label: "Manage Parent Invites",
      description: "Resend parent email invites to link their children",
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
          ? [{ type: "info" as const, msg: `${summary.parentCodesNotSent} student${summary.parentCodesNotSent !== 1 ? "s" : ""} without a parent invite — go to Parent Invites to send`, href: "/admin/codes" }]
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting}, {user?.name?.split(" ")[0] || "Admin"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {schoolLabel} &middot; {schoolRoleLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Operational
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
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
                <Card className="border-border shadow-none hover:shadow-md transition-all duration-150 group-hover:border-primary/25 cursor-pointer h-full">
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
                        <p className={cn("text-xl font-bold leading-tight", s.color)}>{s.value}</p>
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
                  <Card className="border-border border-dashed h-full">
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
                <Card className="border-border shadow-none hover:shadow-md transition-all duration-150 group-hover:border-primary/25 cursor-pointer h-full">
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
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
            { label: "Parent Invites", href: "/admin/codes" },
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


export { DashboardSection };
