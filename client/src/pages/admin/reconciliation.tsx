import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getQueryFn } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { navigateTo } from "./shared";
import { formatMoney } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation — the exception worklist for the "Reconciliation Owner".
// One place for every order that needs a human decision: flagged for review,
// rejected, or cancelled. Read-only; resolving happens on the Payments page
// (confirm / reject / needs-review / cancel + note), which this links to.
// (Council de-risk: name one owner, one place, don't solve exceptions ad-hoc.)
// ─────────────────────────────────────────────────────────────────────────────

const money = formatMoney;
const EXCEPTION_STATUSES = ["needs_review", "rejected", "cancelled"];
const META: Record<string, { label: string; tone: string; blurb: string }> = {
  needs_review: { label: "Needs review", tone: "bg-warning-bg text-warning border-warning/30", blurb: "Flagged — confirm the reference against the payment app, then approve or reject." },
  rejected: { label: "Rejected", tone: "bg-destructive/10 text-destructive border-destructive/30", blurb: "Reference couldn't be verified. Parent can resubmit, or follow up directly." },
  cancelled: { label: "Cancelled", tone: "bg-gray-100 text-gray-600 border-gray-200", blurb: "Order was cancelled. Check whether a refund or re-order is owed." },
};

function ReconciliationSection() {
  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const exceptions = useMemo(
    () => payments
      .filter((p: any) => EXCEPTION_STATUSES.includes(p.status))
      .sort((a: any, b: any) => EXCEPTION_STATUSES.indexOf(a.status) - EXCEPTION_STATUSES.indexOf(b.status)),
    [payments],
  );
  const countBy = (s: string) => payments.filter((p: any) => p.status === s).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reconciliation</h1>
        <p className="text-muted-foreground text-sm mt-1">Every order that needs a decision, in one worklist. Assign one owner; resolve on the Payments page.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {EXCEPTION_STATUSES.map((s) => (
          <div key={s} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{META[s].label}</div>
            <div className="text-2xl font-bold mt-0.5">{countBy(s)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-sm font-medium flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Open exceptions ({exceptions.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : exceptions.length === 0 ? (
          <div className="p-10 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">Nothing to reconcile — no flagged, rejected, or cancelled orders.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {exceptions.map((p: any) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.studentName || "—"}</span>
                    <span className="text-xs text-muted-foreground">{p.className || ""}</span>
                    <Badge variant="outline" className={cn("text-xs", META[p.status]?.tone)}>{META[p.status]?.label || p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {money(p.totalAmount)}
                    {(p.paymentReferenceNumber || p.paymentReference) ? ` · ref ${p.paymentReferenceNumber || p.paymentReference}` : ""}
                    {p.parentIdentifier ? ` · ${p.parentIdentifier}` : ""}
                  </p>
                  {p.reviewNote && <p className="text-xs text-foreground/70 mt-1 italic">“{p.reviewNote}”</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{META[p.status]?.blurb}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigateTo("/admin/payments")}>
                  Resolve in Payments <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ReconciliationSection };
