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

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
function PaymentsSection() {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

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
  const allClasses: { id: string; name: string }[] = [];
  payments.forEach((p: any) => { if (p.classId && p.className && !allClasses.find(c => c.id === p.classId)) allClasses.push({ id: p.classId, name: p.className }); });
  allClasses.sort((a, b) => a.name.localeCompare(b.name));

  const filteredPayments = payments.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (classFilter !== "all" && p.classId !== classFilter) return false;
    return true;
  });

  const exportCSV = () => {
    const rows = [
      ["Order Ref", "Student", "Class", "Parent", "Amount (GBP)", "Payment Ref #", "Status", "Submitted"],
      ...filteredPayments.map((p: any) => [
        p.paymentReference ?? "",
        p.studentName ?? "",
        p.className ?? "",
        p.parentIdentifier ?? "",
        parseFloat(p.totalAmount || "0").toFixed(2),
        p.paymentReferenceNumber ?? "",
        p.status ?? "",
        p.paymentReferenceSubmittedAt ? new Date(p.paymentReferenceSubmittedAt).toLocaleDateString() : "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payments-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const actionableCount = payments.filter((p: any) => isActionable(p.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payment Review</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review parent payment references submitted via external payment apps.
            {actionableCount > 0 && <span className="ml-2 text-blue-600 font-medium">{actionableCount} awaiting review</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredPayments.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm text-muted-foreground">Status:</Label>
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
        {allClasses.length > 0 && (
          <>
            <Label className="text-sm text-muted-foreground">Class:</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Order Ref</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
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
                <TableCell className="text-sm font-medium">{p.studentName ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.className ?? "—"}</TableCell>
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
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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

export { PaymentsSection };
