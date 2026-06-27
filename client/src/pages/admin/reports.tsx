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

// ─── REPORTS ──────────────────────────────────────────────────────────────────
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
            <div><span className="text-muted-foreground">Stock value:</span> <strong>£{inv.totalStockValue.toLocaleString()}</strong></div>
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
              <div className="text-xl font-bold text-green-600">£{pay.totalRevenue.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Pending revenue</span>
              <div className="text-xl font-bold text-yellow-600">£{pay.pendingRevenue.toLocaleString()}</div>
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

export { ReportsSection };
