import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calculator, CreditCard, ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle,
  Eye, Clock, DollarSign, TrendingUp, FileText, Ban, LayoutDashboard, ClipboardList, BarChart3,
  Sparkles, Upload, RefreshCw, Loader2, Info,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { formatMoney, formatDate as sharedFormatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  parentIdentifier: string;
  totalAmount: string;
  paymentMethod: string;
  paymentReference: string;
  status: string;
  orderStatus: string;
  paidAt: string | null;
  confirmedAt: string | null;
  paymentReferenceNumber: string | null;
  verificationMethod?: string | null;
  /** Latest verification decision, attached by GET /api/admin/payments. */
  verification?: {
    outcome: "verified" | "investigation" | "rejected";
    method: string;
    reasonCode: string | null;
    reasonDetail: string | null;
    candidateCount: number;
    at: string | null;
    evidence: Record<string, any> | null;
  } | null;
  paymentReferenceSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  paymentReviewNote: string | null;
  notes: string | null;
  schoolId: string | null;
}

interface FinanceSummary {
  totalPayments: number;
  totalRevenue: string;
  totalOutstanding: string;
  pendingReview: number;
  awaitingRef: number;
  confirmed: number;
  rejected: number;
  needsReview: number;
  cancelled: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "completed":
      return <Badge className="bg-success-bg text-success border-success/30">Confirmed</Badge>;
    case "reference_submitted":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Ref Submitted</Badge>;
    case "awaiting_reference":
    case "pending":
      return <Badge className="bg-warning-bg text-warning border-warning/30">Awaiting Ref</Badge>;
    case "rejected":
    case "failed":
      return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Rejected</Badge>;
    case "needs_review":
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">Needs Review</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-500/10 text-gray-500 border-gray-200">Cancelled</Badge>;
    case "ready_for_collection":
      return <Badge className="bg-teal-500/10 text-teal-600 border-teal-200">Ready</Badge>;
    case "collected":
      return <Badge className="bg-success-bg text-success border-success/40">Collected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const formatCurrency = formatMoney;

// Was already pinned to en-GB; routed through the shared formatter so there is
// exactly one definition of what a date looks like in this product.
const formatDate = sharedFormatDate;

// ─── DASHBOARD SECTION ───────────────────────────────────────────
function FinanceDashboard() {
  const { data: summary, isLoading } = useQuery<FinanceSummary>({
    queryKey: ["/api/finance/summary"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading finance data...</p></div>;
  }

  const s = summary || { totalPayments: 0, totalRevenue: "0.00", totalOutstanding: "0.00", pendingReview: 0, awaitingRef: 0, confirmed: 0, rejected: 0, needsReview: 0, cancelled: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground mt-1">Payment overview and financial health of your school.</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Revenue</div>
              <div className="text-xl font-bold font-heading text-emerald-600">{formatCurrency(s.totalRevenue)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600"><Clock className="w-5 h-5" /></div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</div>
              <div className="text-xl font-bold font-heading text-amber-600">{formatCurrency(s.totalOutstanding)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600"><Eye className="w-5 h-5" /></div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Review</div>
              <div className="text-xl font-bold font-heading text-blue-600">{s.pendingReview}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary"><FileText className="w-5 h-5" /></div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Payments</div>
              <div className="text-xl font-bold font-heading text-primary">{s.totalPayments}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card className="rounded-2xl border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Payment Status Breakdown</CardTitle>
          <CardDescription>Distribution of all payments by current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Awaiting Ref", count: s.awaitingRef, color: "text-amber-600 bg-amber-500/10" },
              { label: "Ref Submitted", count: s.pendingReview, color: "text-blue-600 bg-blue-500/10" },
              { label: "Confirmed", count: s.confirmed, color: "text-success bg-success-bg" },
              { label: "Rejected", count: s.rejected, color: "text-destructive bg-destructive/10" },
              { label: "Needs Review", count: s.needsReview, color: "text-purple-600 bg-purple-500/10" },
              { label: "Cancelled", count: s.cancelled, color: "text-gray-500 bg-gray-500/10" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg p-4 text-center ${item.color}`}>
                <div className="text-2xl font-bold font-heading">{item.count}</div>
                <div className="text-xs font-medium mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PAYMENT REVIEW SECTION ──────────────────────────────────────
// ─── VERIFICATION PRESENTATION ───────────────────────────────────────────
// The server sends `reasonDetail` as a finished sentence, so the client never
// re-implements the reason vocabulary — it just renders what finance decided.

function VerificationBadge({ p }: { p: Payment }) {
  const v = p.verification;
  if (v?.outcome === "verified" && v.method === "automatic_stripe") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
        <Sparkles className="w-3 h-3" /> Auto-verified
      </Badge>
    );
  }
  if (v?.outcome === "verified" && v.method === "manual_finance_override") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
        <ShieldCheck className="w-3 h-3" /> Manual override
      </Badge>
    );
  }
  if (v?.outcome === "investigation") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 gap-1">
        <AlertTriangle className="w-3 h-3" /> Investigation
      </Badge>
    );
  }
  if (v?.outcome === "rejected") {
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

/**
 * The Finance Officer's answer to "why is this sitting with me?" — the reason
 * automatic verification could not settle it, plus the closest Stripe
 * transaction so they can judge without leaving the page.
 */
function VerificationPanel({ p }: { p: Payment }) {
  const v = p.verification;
  if (!v) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Automatic verification has not run for this order yet.
      </div>
    );
  }
  const ev = v.evidence || {};
  const verified = v.outcome === "verified";
  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2",
      verified ? "border-emerald-200 bg-emerald-50" : v.outcome === "rejected" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
    )}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {verified
          ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> <span className="text-emerald-800">
              {v.method === "automatic_stripe" ? "Payment verified automatically" : "Verified by a Finance Officer"}
            </span></>
          : v.outcome === "rejected"
            ? <><XCircle className="w-4 h-4 text-red-600" /> <span className="text-red-800">Rejected by a Finance Officer</span></>
            : <><AlertTriangle className="w-4 h-4 text-amber-600" /> <span className="text-amber-900">Investigation required</span></>}
      </div>

      {v.reasonDetail && (
        <p className={cn("text-sm", verified ? "text-emerald-900" : v.outcome === "rejected" ? "text-red-900" : "text-amber-900")}>
          {v.reasonDetail}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between"><dt className="text-muted-foreground">Expected</dt>
          <dd className="font-mono">{ev.expectedCurrency || "GBP"} {ev.expectedAmount ?? p.totalAmount}</dd></div>
        {ev.foundAmount !== undefined && (
          <div className="flex justify-between"><dt className="text-muted-foreground">Stripe amount</dt>
            <dd className="font-mono">{ev.foundCurrency || "?"} {ev.foundAmount}</dd></div>
        )}
        {ev.providerPaymentId && (
          <div className="flex justify-between col-span-2"><dt className="text-muted-foreground">Stripe payment</dt>
            <dd className="font-mono truncate max-w-[220px]">{String(ev.providerPaymentId)}</dd></div>
        )}
        {ev.foundStatus && (
          <div className="flex justify-between"><dt className="text-muted-foreground">Stripe status</dt>
            <dd className="font-medium">{String(ev.foundRawStatus || ev.foundStatus)}</dd></div>
        )}
        {typeof ev.candidateCount === "number" && (
          <div className="flex justify-between"><dt className="text-muted-foreground">Candidates</dt>
            <dd>{ev.candidateCount}</dd></div>
        )}
        {v.at && (
          <div className="flex justify-between col-span-2"><dt className="text-muted-foreground">Checked</dt>
            <dd>{formatDate(v.at)}</dd></div>
        )}
      </dl>

      {Array.isArray(ev.matches) && ev.matches.length > 1 && (
        <div className="text-xs">
          <div className="text-muted-foreground mb-1">Possible matches:</div>
          <ul className="space-y-0.5">
            {ev.matches.map((m: any) => (
              <li key={m.providerPaymentId} className="font-mono">
                {m.providerPaymentId} · {m.currency} {m.amount} · {m.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PaymentReviewSection() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewPayment, setReviewPayment] = useState<Payment | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
  };

  /**
   * Manual override. Goes through /manual-verify rather than /confirm because a
   * reason is mandatory when a human overrules automatic verification — and the
   * reason is written to the append-only verification trail.
   */
  const manualVerifyMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/payments/${id}/manual-verify`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Payment verified", description: "Recorded as a manual finance override." });
      setReviewPayment(null); setReviewNote(""); refresh();
    },
    onError: (e: Error) => toast({ title: "Could not verify", description: e.message, variant: "destructive" }),
  });

  const manualRejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/payments/${id}/manual-reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Payment rejected" });
      setReviewPayment(null); setReviewNote(""); refresh();
    },
    onError: (e: Error) => toast({ title: "Could not reject", description: e.message, variant: "destructive" }),
  });

  /** Ask ScholarShelf to check this one order against Stripe data again. */
  const recheckMut = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/admin/payments/${id}/verify`)).json(),
    onSuccess: (r: any) => {
      toast({
        title: r.outcome === "verified" ? "Payment verified automatically" : "Still needs investigation",
        description: r.reason || undefined,
      });
      setReviewPayment(null); refresh();
    },
    onError: (e: Error) => toast({ title: "Verification failed", description: e.message, variant: "destructive" }),
  });

  const sweepMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/finance/verification/run")).json(),
    onSuccess: (r: any) => {
      toast({
        title: "Verification run complete",
        description: `${r.examined} order(s) checked · ${r.verified} verified automatically · ${r.investigation} need investigation`,
      });
      refresh();
    },
    onError: (e: Error) => toast({ title: "Could not run verification", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!payments) return [];
    let result = payments;
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter((p) => p.status === "awaiting_reference" || p.status === "pending");
      } else if (statusFilter === "submitted") {
        result = result.filter((p) => p.status === "reference_submitted");
      } else if (statusFilter === "auto_verified") {
        result = result.filter((p) => p.verification?.method === "automatic_stripe" && p.verification?.outcome === "verified");
      } else {
        result = result.filter((p) => p.status === statusFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.parentIdentifier?.toLowerCase().includes(q) ||
        p.paymentReference?.toLowerCase().includes(q) ||
        p.paymentReferenceNumber?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [payments, statusFilter, searchQuery]);

  const investigationCount = (payments || []).filter((p) => p.status === "needs_review").length;
  const autoVerifiedCount = (payments || []).filter((p) => p.verification?.outcome === "verified" && p.verification?.method === "automatic_stripe").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payment Review</h1>
          <p className="text-muted-foreground mt-1">
            Payments are verified automatically against imported Stripe data. Anything that
            can&rsquo;t be confirmed comes here for investigation.
          </p>
        </div>
        <Button variant="outline" onClick={() => sweepMut.mutate()} disabled={sweepMut.isPending}>
          {sweepMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Re-run verification
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Verified automatically</div>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums">{autoVerifiedCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">No finance action needed</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Investigation required</div>
            <div className={cn("text-2xl font-bold tabular-nums", investigationCount ? "text-amber-600" : "text-foreground")}>{investigationCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Waiting on a Finance Officer</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Stripe data</div>
            <StripeDataSummary />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search parent, reference..." className="pl-9 bg-card" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="needs_review">Investigation required</SelectItem>
            <SelectItem value="auto_verified">Verified automatically</SelectItem>
            <SelectItem value="submitted">Ref Submitted</SelectItem>
            <SelectItem value="pending">Awaiting Ref</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading payments...</p></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-base font-semibold text-muted-foreground">No Payments Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || statusFilter !== "all" ? "Try adjusting your filters." : "No payment records yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  // Finance now only acts on what automation could not settle.
                  const needsOfficer = p.status === "needs_review" || p.status === "reference_submitted";
                  return (
                    <TableRow key={p.id} className={p.status === "needs_review" ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-medium text-sm max-w-[160px] truncate">{p.parentIdentifier}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[130px] truncate">{p.paymentReference}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell><VerificationBadge p={p} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {needsOfficer && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => recheckMut.mutate(p.id)} disabled={recheckMut.isPending}>
                              <RefreshCw className="w-3 h-3 mr-1" />Re-check
                            </Button>
                          )}
                          <Button size="sm" variant={needsOfficer ? "default" : "ghost"} className="h-7 text-xs"
                            onClick={() => { setReviewPayment(p); setReviewNote(""); }}>
                            <Eye className="w-3 h-3 mr-1" />{needsOfficer ? "Investigate" : "View"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Investigation / detail dialog */}
      <Dialog open={!!reviewPayment} onOpenChange={(open) => { if (!open) setReviewPayment(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewPayment?.status === "needs_review" ? "Finance Investigation" : "Payment Details"}
            </DialogTitle>
            <DialogDescription className="font-mono">{reviewPayment?.paymentReference}</DialogDescription>
          </DialogHeader>
          {reviewPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{reviewPayment.parentIdentifier}</span></div>
                <div><span className="text-muted-foreground">Expected:</span> <span className="font-mono font-medium">{formatCurrency(reviewPayment.totalAmount)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(reviewPayment.status)}</div>
                <div><span className="text-muted-foreground">Ext. Ref:</span> <span className="font-mono">{reviewPayment.paymentReferenceNumber || "—"}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> {formatDate(reviewPayment.paymentReferenceSubmittedAt)}</div>
                <div><span className="text-muted-foreground">Reviewed:</span> {formatDate(reviewPayment.paymentReviewedAt)}</div>
              </div>

              <VerificationPanel p={reviewPayment} />

              {(reviewPayment.status === "reference_submitted" || reviewPayment.status === "needs_review") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Manual verification reason <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="e.g. Bank transfer confirmed separately with the parent."
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Required — overriding automatic verification is recorded permanently against this order.
                    </p>
                  </div>
                  <DialogFooter className="gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => recheckMut.mutate(reviewPayment.id)} disabled={recheckMut.isPending}>
                      <RefreshCw className="w-4 h-4 mr-1" />{recheckMut.isPending ? "Checking…" : "Check Stripe again"}
                    </Button>
                    <Button variant="destructive" disabled={manualRejectMut.isPending || reviewNote.trim().length < 5}
                      onClick={() => manualRejectMut.mutate({ id: reviewPayment.id, reason: reviewNote.trim() })}>
                      <XCircle className="w-4 h-4 mr-1" />Payment not received
                    </Button>
                    <Button disabled={manualVerifyMut.isPending || reviewNote.trim().length < 5}
                      onClick={() => manualVerifyMut.mutate({ id: reviewPayment.id, reason: reviewNote.trim() })}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />{manualVerifyMut.isPending ? "…" : "Approve manually"}
                    </Button>
                  </DialogFooter>
                </>
              )}
              {reviewPayment.status !== "reference_submitted" && reviewPayment.status !== "needs_review" && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReviewPayment(null)}>Close</Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Small inline summary of the imported Stripe data, used on the review page. */
function StripeDataSummary() {
  const { data } = useQuery<{ total: number; byStatus: Record<string, number> }>({
    queryKey: ["/api/finance/stripe/status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  if (!data) return <div className="text-2xl font-bold tabular-nums">—</div>;
  if (data.total === 0) {
    return (
      <>
        <div className="text-2xl font-bold text-amber-600 tabular-nums">0</div>
        <button className="text-xs text-primary underline mt-0.5" onClick={() => navigateToFinance("/finance/stripe")}>
          Import a Stripe export
        </button>
      </>
    );
  }
  return (
    <>
      <div className="text-2xl font-bold tabular-nums">{data.total}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{data.byStatus.succeeded ?? 0} succeeded</div>
    </>
  );
}

function navigateToFinance(href: string) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * ─── STRIPE PAYMENT DATA ───────────────────────────────────────────────────
 * The ONE controlled place Stripe payment data enters ScholarShelf. Deliberately
 * a single screen in the finance area rather than upload buttons scattered
 * around the app.
 *
 * What lands here is not "a spreadsheet the workflow reads" — it is normalised
 * into ScholarShelf payment records. When the Stripe API replaces this upload,
 * this screen becomes optional and nothing downstream changes.
 */
function StripePaymentDataSection() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [minorUnits, setMinorUnits] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: status } = useQuery<{ total: number; byStatus: Record<string, number> }>({
    queryKey: ["/api/finance/stripe/status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("minorUnits", String(minorUnits));
      const res = await fetch("/api/finance/stripe/import", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Import failed (${res.status})`);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Stripe data imported",
        description: `${data.transactions.imported} new · ${data.transactions.updated} updated · ${data.verification.ordersAutoVerified} order(s) verified automatically`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/stripe/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
    },
    onError: (e: Error) => toast({ title: "Could not import", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Stripe Payment Data</h1>
        <p className="text-muted-foreground mt-1">
          Import a Stripe export so orders at the finance stage can be verified automatically.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Currently held</CardTitle>
          <CardDescription>Payment records available to automatic verification.</CardDescription>
        </CardHeader>
        <CardContent>
          {!status ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : status.total === 0 ? (
            <p className="text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              No Stripe data imported yet — every order will go to investigation until you import an export.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-muted">{status.total} transactions</Badge>
              {Object.entries(status.byStatus).map(([k, n]) => (
                <Badge key={k} variant="outline" className={
                  k === "succeeded" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : k === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-muted text-muted-foreground"
                }>{k.replace(/_/g, " ")}: {n}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import an export</CardTitle>
          <CardDescription>
            Stripe Dashboard → Payments → Export. CSV, XLSX or XLS. Re-importing the same file is safe —
            transactions are identified by their Stripe id and never duplicated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importMut.isPending}
            className="w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors py-10 flex flex-col items-center justify-center gap-2"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {importMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <div className="text-sm font-medium text-foreground">
              {importMut.isPending ? "Importing and re-checking orders…" : "Choose a Stripe export"}
            </div>
            <div className="text-xs text-muted-foreground">.csv, .xlsx or .xls · up to 10 MB</div>
          </button>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={minorUnits} onChange={(e) => setMinorUnits(e.target.checked)} />
            Amounts in this file are in pence (some Stripe API reports export minor units)
          </label>
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Import complete
            </CardTitle>
            <CardDescription className="font-mono">{result.file?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Rows read</dt><dd className="tabular-nums">{result.file?.rowsRead}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">New transactions</dt><dd className="tabular-nums">{result.transactions.imported}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Updated</dt><dd className="tabular-nums">{result.transactions.updated}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Already current</dt><dd className="tabular-nums">{result.transactions.unchanged}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Duplicates in file</dt><dd className="tabular-nums">{result.transactions.duplicatesInFile}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Unreadable rows</dt><dd className="tabular-nums">{result.rowErrorCount}</dd></div>
            </dl>
            <div className="border-t border-border pt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Effect on orders</div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Orders checked</dt><dd className="tabular-nums">{result.verification.ordersExamined}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Verified automatically</dt><dd className="tabular-nums text-emerald-600 font-semibold">{result.verification.ordersAutoVerified}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Need investigation</dt><dd className="tabular-nums text-amber-600">{result.verification.ordersNeedingInvestigation}</dd></div>
                {result.reversalsFlagged > 0 && (
                  <div className="flex justify-between col-span-2 sm:col-span-3">
                    <dt className="text-muted-foreground">Refunds / disputes flagged</dt>
                    <dd className="tabular-nums text-destructive font-semibold">{result.reversalsFlagged}</dd>
                  </div>
                )}
              </dl>
            </div>
            {result.rowErrors?.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-medium text-amber-900 mb-1">Rows that could not be read</div>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {result.rowErrors.map((e: any) => <li key={e.row}>Row {e.row}: {e.reason}</li>)}
                </ul>
              </div>
            )}
            <Button variant="outline" onClick={() => navigateToFinance("/finance/payments")}>
              Go to Payment Review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportsSection() {
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const stats = useMemo(() => {
    if (!payments) return null;
    const confirmed = payments.filter((p) => p.status === "confirmed" || p.status === "completed");
    const rejected = payments.filter((p) => p.status === "rejected" || p.status === "failed");
    const pending = payments.filter((p) => !["confirmed", "completed", "rejected", "failed", "cancelled"].includes(p.status));

    const totalConfirmed = confirmed.reduce((s, p) => s + parseFloat(p.totalAmount || "0"), 0);
    const totalPending = pending.reduce((s, p) => s + parseFloat(p.totalAmount || "0"), 0);
    const totalRejected = rejected.reduce((s, p) => s + parseFloat(p.totalAmount || "0"), 0);
    const avgPayment = confirmed.length > 0 ? totalConfirmed / confirmed.length : 0;

    // Group by month
    const monthly = new Map<string, { count: number; amount: number }>();
    for (const p of confirmed) {
      const d = p.confirmedAt || p.paidAt;
      if (!d) continue;
      const key = new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      const existing = monthly.get(key) || { count: 0, amount: 0 };
      existing.count++;
      existing.amount += parseFloat(p.totalAmount || "0");
      monthly.set(key, existing);
    }

    return {
      totalConfirmed, totalPending, totalRejected, avgPayment,
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      monthly: Array.from(monthly.entries()).slice(-6),
    };
  }, [payments]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading reports...</p></div>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">Revenue analysis and payment performance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmed Revenue</div>
            <div className="text-xl font-bold font-heading text-emerald-600 mt-1">{formatCurrency(stats.totalConfirmed)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.confirmedCount} payments</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Amount</div>
            <div className="text-xl font-bold font-heading text-amber-600 mt-1">{formatCurrency(stats.totalPending)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.pendingCount} payments</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-none shadow-none">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rejected</div>
            <div className="text-xl font-bold font-heading text-red-600 mt-1">{formatCurrency(stats.totalRejected)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.rejectedCount} payments</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg. Payment</div>
            <div className="text-xl font-bold font-heading text-primary mt-1">{formatCurrency(stats.avgPayment)}</div>
            <div className="text-xs text-muted-foreground mt-1">per confirmed order</div>
          </CardContent>
        </Card>
      </div>

      {stats.monthly.length > 0 && (
        <Card className="rounded-2xl border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Revenue</CardTitle>
            <CardDescription>Confirmed payments by month (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.monthly.map(([month, data]) => {
                const maxAmount = Math.max(...stats.monthly.map(([, d]) => d.amount));
                const pct = maxAmount > 0 ? (data.amount / maxAmount) * 100 : 0;
                return (
                  <div key={month} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-muted-foreground">{month}</div>
                    <div className="flex-1">
                      <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/20 rounded-md flex items-center px-3"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        >
                          <span className="text-xs font-mono font-medium text-emerald-700">{formatCurrency(data.amount)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs text-muted-foreground">{data.count} orders</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collection rate */}
      <Card className="rounded-2xl border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Collection Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold font-heading text-emerald-600">
                {payments && payments.length > 0 ? Math.round((stats.confirmedCount / payments.length) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Confirmation Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-heading text-red-600">
                {payments && payments.length > 0 ? Math.round((stats.rejectedCount / payments.length) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Rejection Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-heading text-amber-600">
                {payments && payments.length > 0 ? Math.round((stats.pendingCount / payments.length) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Still Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────
export default function FinancePage({ section = "dashboard" }: { section?: string }) {
  switch (section) {
    case "payments":
      return <PaymentReviewSection />;
    case "reports":
      return <ReportsSection />;
    case "stripe":
      return <StripePaymentDataSection />;
    default:
      return <FinanceDashboard />;
  }
}
