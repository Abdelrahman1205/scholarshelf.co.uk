import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./shared";
import { formatDate } from "@/lib/format";

// ─── ALLOCATIONS — Master Allocations List (ScholarShelf design) ─────────────

type AllocFilter = "all" | "pending" | "received" | "absent";

function initials(name?: string) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function AllocationsSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<AllocFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const { data: allocations = [] } = useQuery<any[]>({ queryKey: ["/api/allocations"], queryFn: getQueryFn({ on401: "throw" }) });

  const confirmReceiptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/allocations/${id}/confirm`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/allocations"] }); toast({ title: "Receipt confirmed", description: "Books marked as received by student." }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  async function bulkConfirm() {
    setBulkPending(true);
    try {
      for (const id of Array.from(selected)) {
        await apiRequest("POST", `/api/allocations/${id}/confirm`, {});
      }
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({ title: `Receipt confirmed for ${selected.size} allocation${selected.size !== 1 ? "s" : ""}` });
      setSelected(new Set());
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBulkPending(false); }
  }

  const allocState = (a: any): AllocFilter => a.status === "received" ? "received" : a.status === "absent" ? "absent" : "pending";

  const counts = {
    total: allocations.length,
    received: allocations.filter((a: any) => allocState(a) === "received").length,
    pending: allocations.filter((a: any) => allocState(a) === "pending").length,
    absent: allocations.filter((a: any) => allocState(a) === "absent").length,
  };

  const filtered = allocations.filter((a: any) => {
    if (statusFilter !== "all" && allocState(a) !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !(a.student?.name?.toLowerCase().includes(q) || a.book?.title?.toLowerCase().includes(q))) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  function exportManifest() {
    const rows = [["Student", "Book", "Status", "Allocated", "Received"]];
    filtered.forEach((a: any) => rows.push([
      a.student?.name || "", a.book?.title || "", a.status || "",
      a.allocatedAt ? formatDate(a.allocatedAt) : "",
      a.receivedAt ? formatDate(a.receivedAt) : "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "allocations-manifest.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { icon: "analytics", label: "Total Required", value: counts.total, iconCls: "bg-secondary-container text-on-secondary-container" },
    { icon: "inventory_2", label: "Awaiting Collection", value: counts.pending, iconCls: "bg-tertiary-fixed text-on-tertiary-fixed-variant" },
    { icon: "check_circle", label: "Fully Collected", value: counts.received, iconCls: "bg-secondary-container text-on-secondary-container" },
    { icon: "person_off", label: "Absent", value: counts.absent, iconCls: "bg-surface-container-high text-muted-foreground" },
  ];

  const pills: { key: AllocFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Not Collected" },
    { key: "received", label: "Collected" },
    { key: "absent", label: "Absent" },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>Master Records</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Allocations</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Master Allocations</h1>
            <p className="text-muted-foreground mt-1">Real-time tracking of book distribution across all students.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportManifest} disabled={filtered.length === 0}>
              <MaterialSymbol name="download" className="text-base mr-2" /> Export Manifest
            </Button>
            {selected.size > 0 && (
              <Button onClick={bulkConfirm} disabled={bulkPending}>
                {bulkPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MaterialSymbol name="check_circle" className="text-base mr-2" />}
                Confirm Receipt ({selected.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg", k.iconCls)}>
                <MaterialSymbol name={k.icon} className="text-xl" />
              </span>
            </div>
            <div className="text-2xl font-bold mt-3 text-foreground">{k.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MaterialSymbol name="filter_list" className="text-base" /> Filters:</span>
        <div className="flex items-center gap-1 bg-surface-container rounded-full p-1">
          {pills.map((p) => (
            <button
              key={p.key}
              onClick={() => setStatusFilter(p.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === p.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setStatusFilter("all"); setSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <MaterialSymbol name="refresh" className="text-sm" /> Reset
        </button>
        <div className="relative ml-auto min-w-[220px] flex-1 sm:flex-none">
          <MaterialSymbol name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-muted-foreground" />
          <Input placeholder="Student or book…" className="pl-8 h-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Master table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-container-low">
                <th className="px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Student Name</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Book</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Allocated</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Collection Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">{allocations.length === 0 ? "No allocations yet. Confirm a payment to create allocations." : "No allocations match these filters."}</td></tr>
              ) : filtered.map((a: any) => {
                const st = allocState(a);
                return (
                  <tr key={a.id} className={cn("border-b border-border last:border-0 hover:bg-surface-container-low transition-colors", selected.has(a.id) && "bg-secondary-container/30")}>
                    <td className="px-4 py-3">
                      {st !== "received" && (
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          className="rounded border-border cursor-pointer"
                          aria-label={`Select allocation for ${a.student?.name || "student"}`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold shrink-0">{initials(a.student?.name)}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{a.student?.name || "Unknown"}</div>
                          {a.student?.id && <div className="text-[10px] font-mono text-muted-foreground truncate">ID: {String(a.student.id).slice(0, 8)}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MaterialSymbol name="menu_book" className="text-base text-muted-foreground" />
                        <span className="text-sm text-foreground">{a.book?.title || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{a.allocatedAt ? formatDate(a.allocatedAt) : "—"}</td>
                    <td className="px-4 py-3">
                      {st === "received" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                          <MaterialSymbol name="check_circle" className="text-sm" /> COLLECTED
                        </span>
                      ) : st === "absent" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-muted-foreground">ABSENT</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">NOT COLLECTED</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {st === "received" ? (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <MaterialSymbol name="history" className="text-base" />
                          {a.receivedAt ? formatDate(a.receivedAt) : "—"}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-on-secondary-container hover:bg-secondary-container/50"
                          onClick={() => confirmReceiptMutation.mutate(a.id)}
                          disabled={confirmReceiptMutation.isPending || bulkPending}
                        >
                          <MaterialSymbol name="check_circle" className="text-base mr-1" /> Confirm Receipt
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {filtered.length} of {allocations.length} entries
        </div>
      </div>
    </div>
  );
}

// ─── EXTRA COPY REQUESTS — Action Queue (ScholarShelf design) ─────────────────
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

  const pendingRequests = requests.filter((r: any) => r.status === "pending");
  const resolvedRequests = requests.filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>Orders</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Extra Requests</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Action Queue</h1>
            <p className="text-muted-foreground mt-1">Review and approve extra copy requests from teachers.</p>
          </div>
          {pendingRequests.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-error-container text-on-error-container">
              <MaterialSymbol name="notifications_active" className="text-sm" /> {pendingRequests.length} Pending
            </span>
          )}
        </div>
      </div>

      {/* Pending queue — design: action cards */}
      {pendingRequests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pendingRequests.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">Extra Copy Request</span>
                  <div className="font-semibold text-foreground mt-2">{r.class?.name || "—"} {r.teacher?.name ? `(${r.teacher.name})` : ""}</div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{reasonLabels[r.reason] || r.reason}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <div><span className="text-foreground font-medium">Book:</span> {r.book?.title || "Unknown"} · Qty {r.quantity}</div>
                {r.notes && <div><span className="text-foreground font-medium">Reason:</span> {r.notes}</div>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                  <MaterialSymbol name="check_circle" className="text-base mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => rejectMutation.mutate(r.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                  <MaterialSymbol name="cancel" className="text-base mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-sm font-semibold text-foreground flex items-center gap-2">
          <MaterialSymbol name="history" className="text-lg text-muted-foreground" /> Request History
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-container-low">
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Teacher</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Class</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Book</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Qty</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Reason</th>
                <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {resolvedRequests.length === 0 && pendingRequests.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No extra copy requests.</td></tr>
              ) : resolvedRequests.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No resolved requests yet.</td></tr>
              ) : resolvedRequests.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.teacher?.name || "Unknown"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{r.class?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{r.book?.title || "Unknown"}</td>
                  <td className="px-4 py-3 text-sm">{r.quantity}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><Badge variant="outline" className="text-xs">{reasonLabels[r.reason] || r.reason}</Badge></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── COMMUNICATIONS OVERSIGHT ─────────────────────────────────

export { AllocationsSection, ExtraRequestsSection };
