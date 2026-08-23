import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Search, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDateTime, formatMoney } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Collection Sheet — the offline paid-roster for distribution day.
// Read-only: pulls /api/admin/payments, filters to payable orders, and prints a
// per-class tick-list so staff can hand books over even if wifi/app fails.
// (Council de-risk: there's no auto-link payment→copy, so the paper roster is
// the safety net at hand-over.)
// ─────────────────────────────────────────────────────────────────────────────

const money = formatMoney;
const STATUS_LABEL: Record<string, string> = { confirmed: "Paid", ready_for_collection: "Ready", collected: "Collected" };
const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-success-bg text-success border-success/30",
  ready_for_collection: "bg-indigo-50 text-indigo-700 border-indigo-200",
  collected: "bg-gray-100 text-gray-600 border-gray-200",
};
const esc = (s: any) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function CollectionSheetSection() {
  const [classFilter, setClassFilter] = useState("all");
  const [includeCollected, setIncludeCollected] = useState(false);
  const [search, setSearch] = useState("");

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const classes = useMemo(() => {
    const m = new Map<string, string>();
    payments.forEach((p: any) => { if (p.classId && p.className) m.set(p.classId, p.className); });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  const statuses = includeCollected
    ? ["confirmed", "ready_for_collection", "collected"]
    : ["confirmed", "ready_for_collection"];

  const rows = useMemo(() => payments
    .filter((p: any) => statuses.includes(p.status))
    .filter((p: any) => classFilter === "all" ? true : p.classId === classFilter)
    .filter((p: any) => !search || (p.studentName || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => (a.className || "").localeCompare(b.className || "") || (a.studentName || "").localeCompare(b.studentName || "")),
    [payments, classFilter, includeCollected, search]);

  const title = classFilter === "all" ? "All classes" : (classes.find((c) => c.id === classFilter)?.name || "");

  function printSheet() {
    if (!rows.length) return;
    const body = rows.map((p: any) => `<tr>
      <td class="chk"></td>
      <td>${esc(p.studentName)}</td>
      <td>${esc(p.className)}</td>
      <td class="r">${money(p.totalAmount)}</td>
      <td class="mono">${esc(p.paymentReferenceNumber || p.paymentReference || "")}</td>
      <td>${esc(STATUS_LABEL[p.status] || p.status)}</td>
    </tr>`).join("");
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.write(`<html><head><title>Collection sheet — ${esc(title)}</title><style>
      *{font-family:Arial,Helvetica,sans-serif}
      h1{font-size:18px;margin:0 0 2px}
      .sub{color:#555;font-size:12px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#f2f2f2}
      td.r{text-align:right} td.mono{font-family:monospace} td.chk{width:26px}
      tr{page-break-inside:avoid}
    </style></head><body>
      <h1>Collection sheet — ${esc(title)}</h1>
      <p class="sub">${rows.length} student${rows.length === 1 ? "" : "s"} · printed ${formatDateTime(new Date())}</p>
      <table><thead><tr><th>✓</th><th>Student</th><th>Class</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead>
      <tbody>${body}</tbody></table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch {} }, 300);
  }

  const totalDue = rows.reduce((s: number, p: any) => s + parseFloat(p.totalAmount || "0"), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Collection Sheet</h1>
        <p className="text-muted-foreground text-sm mt-1">Print a paid-roster tick-list for distribution day — works on paper if the app or wifi fails.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium">Class</label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm h-9">
          <input type="checkbox" className="h-4 w-4" checked={includeCollected} onChange={(e) => setIncludeCollected(e.target.checked)} />
          Include collected
        </label>
        <div className="sm:ml-auto">
          <Button onClick={printSheet} disabled={!rows.length}>
            <Printer className="w-4 h-4 mr-1.5" /> Print sheet ({rows.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">To collect</div>
          <div className="text-2xl font-bold mt-0.5">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Value</div>
          <div className="text-2xl font-bold mt-0.5">{money(totalDue)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Classes</div>
          <div className="text-2xl font-bold mt-0.5">{classFilter === "all" ? classes.length : 1}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> {title}
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No paid orders to collect for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 w-10">✓</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2"><span className="inline-block h-4 w-4 border border-muted-foreground/40 rounded-sm" /></td>
                    <td className="px-3 py-2 font-medium">{p.studentName || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.className || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(p.totalAmount)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.paymentReferenceNumber || p.paymentReference || "—"}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={cn("text-xs", STATUS_STYLE[p.status] || "")}>{STATUS_LABEL[p.status] || p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export { CollectionSheetSection };
