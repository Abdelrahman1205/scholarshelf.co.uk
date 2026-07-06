import { useQuery } from "@tanstack/react-query";
import {
  Layers, CreditCard, BoxSelect, Loader2, GraduationCap, Users,
  Package, ClipboardList, CheckCircle2, Clock, XCircle, AlertTriangle, BarChart2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getQueryFn } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// ─── REPORTS (Stitch redesign) ──────────────────────────────────────────────
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

  const mono = "text-[10px] font-mono uppercase tracking-wider";
  const th = `${mono} text-muted-foreground`;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart2 className="h-6 w-6" /> School Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Operational metrics and data summaries — generated {new Date(report.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* ── Hero metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Books", value: inv.activeBooks, sub: `${inv.totalStockUnits} units in stock`, tone: "text-foreground" },
          { label: "Students", value: report.students.total, sub: `${cls.total} classes`, tone: "text-foreground" },
          { label: "Payments Verified", value: pay.confirmed, sub: `${pay.referenceSubmitted + (pay.needsReview || 0)} awaiting review`, tone: "text-emerald-600" },
          { label: "Parent Link Rate", value: `${pl.linkRate}%`, sub: `${pl.used}/${pl.totalCodes} codes used`, tone: "text-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
            <div className={th}>{k.label}</div>
            <div className={cn("text-3xl font-bold mt-1", k.tone)}>{k.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Inventory Report ── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Inventory Report</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground">Active titles:</span> <strong>{inv.activeBooks}</strong></div>
          <div><span className="text-muted-foreground">Total stock units:</span> <strong>{inv.totalStockUnits}</strong></div>
          <div><span className="text-muted-foreground">Stock value:</span> <strong>£{inv.totalStockValue.toLocaleString()}</strong></div>
          <div><span className="text-muted-foreground">Out of stock:</span> <strong className={inv.outOfStockCount > 0 ? "text-red-600" : ""}>{inv.outOfStockCount}</strong></div>
        </div>
        {inv.lowStockBooks.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Low Stock Books ({inv.lowStockBooks.length})
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={th}>Title</TableHead>
                    <TableHead className={cn(th, "text-right")}>Stock</TableHead>
                    <TableHead className={cn(th, "text-right")}>Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lowStockBooks.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell className="text-right"><Badge variant={b.stock === 0 ? "destructive" : "secondary"}>{b.stock ?? 0}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground">{b.threshold ?? 10}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      {/* ── Payment Report ── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4"><CreditCard className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Payment Report</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1"><span className="text-muted-foreground">Total payments</span><div className="text-xl font-bold text-foreground">{pay.total}</div></div>
          <div className="space-y-1"><span className="text-muted-foreground">Revenue (verified)</span><div className="text-xl font-bold text-emerald-600">£{pay.totalRevenue.toLocaleString()}</div></div>
          <div className="space-y-1"><span className="text-muted-foreground">Pending revenue</span><div className="text-xl font-bold text-amber-600">£{pay.pendingRevenue.toLocaleString()}</div></div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {pay.awaitingReference} Awaiting Ref</Badge>
          <Badge className="gap-1 bg-blue-600"><ClipboardList className="h-3 w-3" /> {pay.referenceSubmitted} Submitted</Badge>
          <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> {pay.confirmed} Confirmed</Badge>
          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {pay.rejected} Rejected</Badge>
          {(pay.needsReview || 0) > 0 && <Badge className="gap-1 bg-orange-500"><AlertTriangle className="h-3 w-3" /> {pay.needsReview} Review</Badge>}
        </div>
      </section>

      {/* ── Distribution Report ── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4"><BoxSelect className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Distribution Report</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground">Total allocations:</span> <strong>{alloc.total}</strong></div>
          <div><span className="text-muted-foreground">Awaiting confirmation:</span> <strong className="text-amber-600">{alloc.allocated}</strong></div>
          <div><span className="text-muted-foreground">Confirmed:</span> <strong className="text-emerald-600">{alloc.confirmed}</strong></div>
          <div><span className="text-muted-foreground">Confirmation rate:</span> <strong>{alloc.confirmationRate}%</strong></div>
        </div>
      </section>

      {/* ── Extra Copy Requests ── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4"><ClipboardList className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Extra Copy Requests</h2></div>
        <div className="flex gap-4">
          <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {ecr.pending} Pending</Badge>
          <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> {ecr.approved} Approved</Badge>
          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {ecr.rejected} Rejected</Badge>
        </div>
        {Object.keys(ecr.byReason).length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 text-foreground">By Reason</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ecr.byReason).map(([reason, count]) => (
                <Badge key={reason} variant="outline">{reason.replace(/_/g, " ")}: {count as number}</Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Class Distribution ── */}
      {cls.details.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><GraduationCap className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Class Distribution</h2></div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={th}>Class</TableHead>
                  <TableHead className={th}>Grade</TableHead>
                  <TableHead className={cn(th, "text-right")}>Students</TableHead>
                  <TableHead className={cn(th, "text-right")}>Allocations</TableHead>
                  <TableHead className={cn(th, "text-right")}>Confirmed</TableHead>
                  <TableHead className={cn(th, "text-right")}>Completion</TableHead>
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
                      <Badge variant={c.completionRate === 100 ? "default" : c.completionRate > 50 ? "secondary" : "outline"}>{c.completionRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ── Users + Book Levels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Users Summary</h2></div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(report.users.byRole).map(([role, count]) => (
              <Badge key={role} variant="outline" className="text-sm py-1 px-3">{role.replace(/_/g, " ")}: {count as number}</Badge>
            ))}
            <Badge variant="secondary" className="text-sm py-1 px-3">Total: {report.users.total}</Badge>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Layers className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Bundles</h2></div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Book levels created:</span> <strong>{bl.total}</strong></div>
            <div><span className="text-muted-foreground">Assigned to classes:</span> <strong>{bl.assignedToClasses}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}

export { ReportsSection };
