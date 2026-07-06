import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./shared";

// ─── PAYMENTS — Review & Collection Lifecycle (ScholarShelf design) ─────────

const LIFECYCLE_STEPS = [
  { key: "pending", label: "Pending Approval", icon: "hourglass_empty" },
  { key: "confirmed", label: "Confirmed", icon: "check_circle" },
  { key: "ready_for_collection", label: "Ready for Collection", icon: "local_shipping" },
  { key: "collected", label: "Collected", icon: "inventory" },
];

function lifecycleIndex(status: string): number {
  if (status === "collected") return 3;
  if (status === "ready_for_collection") return 2;
  if (status === "confirmed") return 1;
  if (["reference_submitted", "needs_review", "pending", "awaiting_payment"].includes(status)) return 0;
  return -1; // rejected / cancelled
}

function PaymentsSection() {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"], queryFn: getQueryFn({ on401: "throw" }) });

  const clearDetail = () => { setSelectedPayment(null); setReviewNote(""); };
  const afterAction = () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); clearDetail(); };
  const onErr = (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" });

  const confirmMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/confirm`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Payment confirmed & books allocated" }); }, onError: onErr });
  const rejectMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/reject`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Payment rejected — parent can resubmit" }); }, onError: onErr });
  const needsReviewMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/needs-review`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Payment flagged for review" }); }, onError: onErr });
  const readyMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/ready-for-collection`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Order marked ready for collection" }); }, onError: onErr });
  const collectedMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/collected`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Order marked as collected" }); }, onError: onErr });
  const cancelMutation = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/cancel`, { reviewNote: reviewNote.trim() || undefined }), onSuccess: () => { afterAction(); toast({ title: "Order cancelled" }); }, onError: onErr });

  const anyPending = confirmMutation.isPending || rejectMutation.isPending || needsReviewMutation.isPending || readyMutation.isPending || collectedMutation.isPending || cancelMutation.isPending;
  const isReviewActionable = (s: string) => ["reference_submitted", "needs_review"].includes(s);
  const isFulfilmentActionable = (s: string) => ["confirmed", "ready_for_collection"].includes(s);
  const isActionable = (s: string) => isReviewActionable(s) || isFulfilmentActionable(s);

  const allClasses: { id: string; name: string }[] = [];
  payments.forEach((p: any) => { if (p.classId && p.className && !allClasses.find((c) => c.id === p.classId)) allClasses.push({ id: p.classId, name: p.className }); });
  allClasses.sort((a, b) => a.name.localeCompare(b.name));

  const filteredPayments = payments.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (classFilter !== "all" && p.classId !== classFilter) return false;
    return true;
  });
  const actionableCount = payments.filter((p: any) => isActionable(p.status)).length;

  const exportCSV = () => {
    const rows = [
      ["Order Ref", "Student", "Class", "Parent", "Amount (GBP)", "Payment Ref #", "Status", "Submitted"],
      ...filteredPayments.map((p: any) => [
        p.paymentReference ?? "", p.studentName ?? "", p.className ?? "", p.parentIdentifier ?? "",
        parseFloat(p.totalAmount || "0").toFixed(2), p.paymentReferenceNumber ?? "", p.status ?? "",
        p.paymentReferenceSubmittedAt ? new Date(p.paymentReferenceSubmittedAt).toLocaleDateString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payments-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const initials = (name?: string) => (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const p = selectedPayment;
  const stepIdx = p ? lifecycleIndex(p.status) : -1;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>Orders</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Payments</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Payment Transactions</h1>
            <p className="text-muted-foreground mt-1">Review incoming payment references and manage the collection lifecycle.{actionableCount > 0 && <span className="ml-1 text-foreground font-medium">{actionableCount} awaiting action.</span>}</p>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={filteredPayments.length === 0}>
            <MaterialSymbol name="download" className="text-base mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_360px] gap-4 items-start">
        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-5 h-fit space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-1.5"><MaterialSymbol name="filter_list" className="text-lg text-muted-foreground" /> Filters</h2>
            <button onClick={() => { setStatusFilter("all"); setClassFilter("all"); }} className="text-xs text-on-secondary-container hover:underline">Reset</button>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="reference_submitted">Awaiting review</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="ready_for_collection">Ready for collection</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Class</div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {allClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm"><strong className="text-foreground">{filteredPayments.length}</strong> <span className="text-muted-foreground">payment{filteredPayments.length !== 1 ? "s" : ""}</span></div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-container-low">
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Student</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10">No payments match these filters.</TableCell></TableRow>
                ) : filteredPayments.map((pay: any) => (
                  <TableRow key={pay.id} onClick={() => { setSelectedPayment(pay); setReviewNote(""); }} className={cn("cursor-pointer", selectedPayment?.id === pay.id && "bg-secondary-container/30", isActionable(pay.status) && selectedPayment?.id !== pay.id && "bg-surface-container-low")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-secondary-container flex items-center justify-center text-[11px] font-semibold text-on-secondary-container shrink-0">{initials(pay.studentName)}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{pay.studentName || "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">{pay.paymentReference}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">£{parseFloat(pay.totalAmount || "0").toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={pay.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detail panel — design: transaction review + lifecycle */}
        <div className="rounded-xl border border-border bg-card h-fit overflow-hidden lg:sticky lg:top-4">
          {!p ? (
            <div className="text-center py-12 px-5">
              <MaterialSymbol name="receipt_long" className="text-4xl text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mt-2">Select a payment to review.</p>
            </div>
          ) : (
            <div>
              {/* Transaction header */}
              <div className="p-5 border-b border-border bg-surface-container-low">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Transaction ID</div>
                    <div className="font-mono font-bold text-foreground">{p.paymentReference || "—"}</div>
                  </div>
                  <button onClick={clearDetail} className="text-muted-foreground hover:text-foreground" aria-label="Close details"><X className="w-4 h-4" /></button>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-foreground">£{parseFloat(p.totalAmount || "0").toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Total Amount Due</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.paymentReferenceSubmittedAt && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                    <MaterialSymbol name="account_balance" className="text-sm" /> Reference submitted {new Date(p.paymentReferenceSubmittedAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Lifecycle stepper */}
                {stepIdx >= 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Collection Lifecycle</div>
                    <div className="flex items-center">
                      {LIFECYCLE_STEPS.map((s, i) => (
                        <div key={s.key} className={cn("flex items-center", i < LIFECYCLE_STEPS.length - 1 && "flex-1")}>
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn(
                              "inline-flex items-center justify-center w-7 h-7 rounded-full border",
                              i < stepIdx && "bg-secondary-container text-on-secondary-container border-secondary-container",
                              i === stepIdx && "bg-primary text-primary-foreground border-primary",
                              i > stepIdx && "bg-surface-container-low text-muted-foreground border-border",
                            )}>
                              <MaterialSymbol name={i < stepIdx ? "check" : s.icon} className="text-base" />
                            </span>
                            <span className={cn("text-[9px] font-mono uppercase text-center leading-tight max-w-[64px]", i === stepIdx ? "text-foreground font-semibold" : "text-muted-foreground")}>{s.label}</span>
                          </div>
                          {i < LIFECYCLE_STEPS.length - 1 && <div className={cn("h-0.5 flex-1 mx-1 -mt-4", i < stepIdx ? "bg-primary" : "bg-border")} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Student covered */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Student Covered</div>
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold shrink-0">{initials(p.studentName)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">{p.studentName || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.className || "—"}{p.parentIdentifier ? ` · ${p.parentIdentifier}` : ""}</div>
                    </div>
                  </div>
                </div>

                {/* External payment reference */}
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MaterialSymbol name="receipt_long" className="text-sm" /> External Payment Reference</div>
                  {p.paymentReferenceNumber ? (
                    <p className="font-mono text-lg font-bold text-foreground">{p.paymentReferenceNumber}</p>
                  ) : <p className="text-sm text-muted-foreground italic">Parent hasn't submitted a reference yet.</p>}
                </div>

                {/* Previous review */}
                {p.paymentReviewedAt && (
                  <div className="rounded-lg border border-dashed border-border p-3 bg-surface-container-low text-sm space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MaterialSymbol name="history" className="text-sm" /> Review Notes</div>
                    <p>Reviewed {new Date(p.paymentReviewedAt).toLocaleString()}{p.paymentReviewedBy && <span className="text-muted-foreground"> by {p.paymentReviewedBy}</span>}</p>
                    {p.paymentReviewNote && <p><span className="text-muted-foreground">Note:</span> {p.paymentReviewNote}</p>}
                  </div>
                )}

                {p.notes && <div className="text-sm"><span className="text-muted-foreground">Parent notes:</span> {p.notes}</div>}

                {isActionable(p.status) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Review note (optional)</Label>
                    <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Note about this decision…" rows={2} />
                  </div>
                )}

                {/* Review actions — design: Reject / Review / Confirm Payment */}
                {isReviewActionable(p.status) && (
                  <div className="flex flex-col gap-2 pt-1">
                    <Button variant="success" onClick={() => confirmMutation.mutate(p.id)} disabled={anyPending}>
                      {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MaterialSymbol name="check_circle" className="text-base mr-1" />} Confirm Payment
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="warning" className="flex-1" onClick={() => needsReviewMutation.mutate(p.id)} disabled={anyPending}>
                        <MaterialSymbol name="flag" className="text-base mr-1" /> Review
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => rejectMutation.mutate(p.id)} disabled={anyPending}>
                        {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MaterialSymbol name="cancel" className="text-base mr-1" />} Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Fulfilment actions — design: Mark for Collection / Collected */}
                {isFulfilmentActionable(p.status) && (
                  <div className="flex flex-col gap-2 pt-1">
                    {p.status === "confirmed" && (
                      <Button onClick={() => readyMutation.mutate(p.id)} disabled={anyPending}>
                        {readyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MaterialSymbol name="local_shipping" className="text-base mr-1" />} Mark for Collection
                      </Button>
                    )}
                    <Button variant="success" onClick={() => collectedMutation.mutate(p.id)} disabled={anyPending}>
                      {collectedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MaterialSymbol name="inventory" className="text-base mr-1" />} Mark Collected
                    </Button>
                    <Button variant="destructive" onClick={() => cancelMutation.mutate(p.id)} disabled={anyPending}>
                      <MaterialSymbol name="cancel" className="text-base mr-1" /> Cancel Order
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ALLOCATIONS ───────────────────────────────────────────────

export { PaymentsSection };
