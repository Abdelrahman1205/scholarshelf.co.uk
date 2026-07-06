import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatSchoolDisplay, formatDateTime } from "./shared";

// ─── PARENTS (master-detail redesign) ───────────────────────────────────────
function ParentsSection() {
  useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [detail, setDetail] = useState<any>(null);

  const endpoint = (() => {
    const params = new URLSearchParams();
    if (schoolFilter !== "all") params.set("schoolId", schoolFilter);
    const query = params.toString();
    return query ? `/api/admin/parents?${query}` : "/api/admin/parents";
  })();

  const { data: parents = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/admin/parents", schoolFilter],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load parents");
      return res.json();
    },
  });

  const filtered = parents.filter((p: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ? true
      : statusFilter === "linked" ? (p.linkedChildrenCount ?? 0) > 0
      : statusFilter === "unlinked" ? (p.linkedChildrenCount ?? 0) === 0
      : statusFilter === "unpaid" ? (p.unpaidBasketsCount ?? 0) > 0
      : statusFilter === "awaiting-collection" ? (p.paidAwaitingCollectionCount ?? 0) > 0
      : p.parentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const schools = Array.from(new Map(
    parents.filter((p: any) => !!p.schoolId).map((p: any) => [p.schoolId, { value: p.schoolId, label: formatSchoolDisplay(p) }]),
  ).values()).sort((a: any, b: any) => a.label.localeCompare(b.label));

  const totalLinkedChildren = parents.reduce((acc, p: any) => acc + (p.linkedChildrenCount || 0), 0);
  const initials = (name?: string) => (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const p = detail;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Parents</h1>
          <p className="text-muted-foreground mt-1">Monitor parent accounts, child links, and payment readiness.</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Parents</div><div className="text-xl font-bold text-foreground">{parents.length}</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Linked Children</div><div className="text-xl font-bold text-emerald-600">{totalLinkedChildren}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_340px] gap-4">
        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Filters</h2>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setSchoolFilter("all"); }} className="text-xs text-primary hover:underline">Reset</button>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Quick Find</div>
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Name or email…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parents</SelectItem>
                <SelectItem value="linked">Linked to a child</SelectItem>
                <SelectItem value="unlinked">Not linked</SelectItem>
                <SelectItem value="unpaid">Has unpaid baskets</SelectItem>
                <SelectItem value="awaiting-collection">Awaiting collection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {schools.length > 1 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">School</div>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((s: any) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm"><strong className="text-foreground">{filtered.length}</strong> <span className="text-muted-foreground">parent{filtered.length !== 1 ? "s" : ""}</span></div>
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : isError ? (
            <div className="py-10 px-4 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Failed to load parents.</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No matching parents.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((parent: any) => (
                <button key={parent.id} onClick={() => setDetail(parent)} className={cn("w-full text-left flex items-center justify-between px-5 py-3 hover:bg-muted/20", detail?.id === parent.id && "bg-primary/5")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">{initials(parent.name)}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{parent.name || "Not available"}</div>
                      <div className="text-xs text-muted-foreground truncate">{parent.email || "—"}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 ml-3", (parent.linkedChildrenCount ?? 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "")}>
                    {parent.linkedChildrenCount ?? 0} linked
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          {!p ? (
            <div className="text-center py-12"><Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select a parent to see details.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">{initials(p.name)}</div>
                  <div><div className="font-semibold text-foreground">{p.name || "Not available"}</div><div className="text-xs text-muted-foreground">{p.email || "—"}</div></div>
                </div>
                <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={p.parentStatus === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>{p.parentStatus || "unknown"}</Badge>
                <span className="text-xs text-muted-foreground">{formatSchoolDisplay(p)}</span>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">Linked Children ({p.linkedChildrenCount ?? 0})</div>
                {(p.linkedStudents || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">{p.linkedStudents.map((s: any, i: number) => <Badge key={i} variant="secondary" className="text-xs">{s.name}</Badge>)}</div>
                ) : <p className="text-sm text-muted-foreground italic">No children linked yet.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Payments</div><div className="text-foreground">{p.completedPaymentsCount ?? 0}/{p.paymentsCount ?? 0} confirmed</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Last Payment</div><div className="text-foreground text-xs">{formatDateTime(p.lastPaymentAt)}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Collection</div><div className="text-foreground text-xs">{p.collectionStatus || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Signup</div><div className="text-foreground text-xs">{p.signupStatus || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Created</div><div className="text-foreground text-xs">{formatDateTime(p.createdAt)}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Last Login</div><div className="text-foreground text-xs">{formatDateTime(p.lastLoginAt)}</div></div>
              </div>

              {(p.linkedChildrenCount ?? 0) > 0 && (p.completedPaymentsCount ?? 0) >= (p.paymentsCount ?? 0) && (p.paymentsCount ?? 0) > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> All payments settled.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ParentsSection };
