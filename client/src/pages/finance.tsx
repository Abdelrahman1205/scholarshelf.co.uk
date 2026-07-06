import { useState, useMemo } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

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
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Confirmed</Badge>;
    case "reference_submitted":
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Ref Submitted</Badge>;
    case "awaiting_reference":
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Awaiting Ref</Badge>;
    case "rejected":
    case "failed":
      return <Badge className="bg-red-500/10 text-red-600 border-red-200">Rejected</Badge>;
    case "needs_review":
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">Needs Review</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-500/10 text-gray-500 border-gray-200">Cancelled</Badge>;
    case "ready_for_collection":
      return <Badge className="bg-teal-500/10 text-teal-600 border-teal-200">Ready</Badge>;
    case "collected":
      return <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-300">Collected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `£${num.toFixed(2)}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

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
              { label: "Confirmed", count: s.confirmed, color: "text-emerald-600 bg-emerald-500/10" },
              { label: "Rejected", count: s.rejected, color: "text-red-600 bg-red-500/10" },
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

  const confirmMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await apiRequest("POST", `/api/admin/payments/${id}/confirm`, { reviewNote: note });
    },
    onSuccess: () => {
      toast({ title: "Payment Confirmed" });
      setReviewPayment(null); setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await apiRequest("POST", `/api/admin/payments/${id}/reject`, { reviewNote: note });
    },
    onSuccess: () => {
      toast({ title: "Payment Rejected" });
      setReviewPayment(null); setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const flagMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      await apiRequest("POST", `/api/admin/payments/${id}/needs-review`, { reviewNote: note });
    },
    onSuccess: () => {
      toast({ title: "Flagged for Review" });
      setReviewPayment(null); setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!payments) return [];
    let result = payments;
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter((p) => p.status === "awaiting_reference" || p.status === "pending");
      } else if (statusFilter === "submitted") {
        result = result.filter((p) => p.status === "reference_submitted");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Payment Review</h1>
        <p className="text-muted-foreground mt-1">Review, confirm, reject, or flag payment submissions.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search parent, reference..." className="pl-9 bg-card" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Ref Submitted</SelectItem>
            <SelectItem value="pending">Awaiting Ref</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
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
                  <TableHead>Ext. Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const actionable = p.status === "reference_submitted" || p.status === "needs_review";
                  return (
                    <TableRow key={p.id} className={actionable ? "bg-blue-50/30" : ""}>
                      <TableCell className="font-medium text-sm max-w-[160px] truncate">{p.parentIdentifier}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{p.paymentReference}</TableCell>
                      <TableCell className="text-xs font-mono">{p.paymentReferenceNumber || "—"}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</TableCell>
                      <TableCell className="text-right">
                        {actionable ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="default" className="h-7 text-xs"
                              onClick={() => confirmMut.mutate({ id: p.id })}
                              disabled={confirmMut.isPending}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />Confirm
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs"
                              onClick={() => { setReviewPayment(p); setReviewNote(""); }}>
                              <XCircle className="w-3 h-3 mr-1" />Reject
                            </Button>
                            {p.status !== "needs_review" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => flagMut.mutate({ id: p.id })}
                                disabled={flagMut.isPending}>
                                <AlertTriangle className="w-3 h-3 mr-1" />Flag
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => { setReviewPayment(p); setReviewNote(""); }}>
                            <Eye className="w-3 h-3 mr-1" />View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review / Reject Dialog */}
      <Dialog open={!!reviewPayment} onOpenChange={(open) => { if (!open) setReviewPayment(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>Review payment #{reviewPayment?.paymentReference}</DialogDescription>
          </DialogHeader>
          {reviewPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{reviewPayment.parentIdentifier}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-medium">{formatCurrency(reviewPayment.totalAmount)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(reviewPayment.status)}</div>
                <div><span className="text-muted-foreground">Ext. Ref:</span> <span className="font-mono">{reviewPayment.paymentReferenceNumber || "—"}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> {formatDate(reviewPayment.paymentReferenceSubmittedAt)}</div>
                <div><span className="text-muted-foreground">Reviewed:</span> {formatDate(reviewPayment.paymentReviewedAt)}</div>
              </div>
              {reviewPayment.paymentReviewNote && (
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <span className="text-muted-foreground font-medium">Previous note:</span> {reviewPayment.paymentReviewNote}
                </div>
              )}
              {(reviewPayment.status === "reference_submitted" || reviewPayment.status === "needs_review") && (
                <>
                  <Textarea
                    placeholder="Add a review note (optional)..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={2}
                  />
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setReviewPayment(null)}>Cancel</Button>
                    <Button variant="destructive" disabled={rejectMut.isPending}
                      onClick={() => rejectMut.mutate({ id: reviewPayment.id, note: reviewNote || undefined })}>
                      <XCircle className="w-4 h-4 mr-1" />{rejectMut.isPending ? "..." : "Reject"}
                    </Button>
                    <Button disabled={confirmMut.isPending}
                      onClick={() => confirmMut.mutate({ id: reviewPayment.id, note: reviewNote || undefined })}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />{confirmMut.isPending ? "..." : "Confirm"}
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

// ─── REPORTS SECTION ─────────────────────────────────────────────
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
    default:
      return <FinanceDashboard />;
  }
}
