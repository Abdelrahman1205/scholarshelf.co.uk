import { useQuery } from "@tanstack/react-query";
import {
  Database, Mail, ShieldCheck, Server, RefreshCw, Loader2, Activity,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

// ─── SYSTEM HEALTH & INFRASTRUCTURE (platform owner) ────────────────────────
function SystemHealthSection() {
  const { data, isLoading, isFetching, isError } = useQuery<any>({
    queryKey: ["/api/owner/system-health"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/owner/system-health"] });

  const mono = "text-[10px] font-mono uppercase tracking-wider text-muted-foreground";

  const statusMeta = (status: string) => {
    switch (status) {
      case "operational":
      case "healthy":
      case "distributed":
        return { tone: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircle2, label: "Operational" };
      case "degraded":
      case "in_memory":
      case "not_configured":
        return { tone: "text-amber-600", bg: "bg-amber-50 border-amber-200 text-amber-700", icon: AlertTriangle, label: "Degraded" };
      default:
        return { tone: "text-red-600", bg: "bg-red-50 border-red-200 text-red-700", icon: XCircle, label: "Down" };
    }
  };

  const fmtUptime = (s?: number) => {
    if (!s && s !== 0) return "—";
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Failed to load system health telemetry.
      </div>
    );
  }

  const overall = statusMeta(data.overallStatus);
  const OverallIcon = overall.icon;

  const statusCards = [
    { key: "database", icon: Database, title: data.database?.label || "Database", status: data.database?.status },
    { key: "email", icon: Mail, title: data.email?.label || "Email", status: data.email?.status },
    { key: "rate", icon: ShieldCheck, title: data.rateLimiter?.label || "Rate Limiter", status: data.rateLimiter?.status },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Health &amp; Infrastructure</h1>
          <p className="text-muted-foreground mt-1">Live telemetry from the production database, email, and runtime.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-wide", overall.bg)}>
            <OverallIcon className="w-3.5 h-3.5" />
            {data.overallStatus === "operational" ? "All Systems Operational" : data.overallStatus === "degraded" ? "Partially Degraded" : "Outage Detected"}
          </span>
          <Button variant="outline" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Primary telemetry cards */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Database cluster */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Database className="w-5 h-5" /></div>
              <div>
                <div className="font-semibold text-foreground">{data.database?.label}</div>
                <div className={mono}>Store: {data.database?.storageMode}</div>
              </div>
            </div>
            {(() => { const m = statusMeta(data.database?.status); const I = m.icon; return (
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", m.bg)}><I className="w-3 h-3" /> {data.database?.status}</span>
            ); })()}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div><div className={mono}>Query Latency</div><div className="text-2xl font-bold text-foreground mt-0.5">{data.database?.latencyMs ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">ms</span></div></div>
            <div><div className={mono}>Schools</div><div className="text-2xl font-bold text-foreground mt-0.5">{data.database?.schools ?? 0}</div></div>
            <div><div className={mono}>Round-trip</div><div className="text-2xl font-bold text-foreground mt-0.5">{data.responseTimeMs ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">ms</span></div></div>
          </div>
        </div>

        {/* Rate limiter */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Rate Limiter</h2>
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={mono}>Store</span>
              <span className="text-sm font-medium text-foreground">{data.rateLimiter?.store}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={mono}>Mode</span>
              {(() => { const m = statusMeta(data.rateLimiter?.status); const I = m.icon; return (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", m.bg)}><I className="w-3 h-3" /> {data.rateLimiter?.status === "distributed" ? "Distributed" : "In-memory"}</span>
              ); })()}
            </div>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              {data.rateLimiter?.store === "postgres"
                ? "Limits are shared across all serverless instances via Postgres."
                : "Running with an in-memory limiter (single instance / local dev)."}
            </p>
          </div>
        </div>
      </div>

      {/* Email + Runtime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Email */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">{data.email?.label}</h2></div>
            {(() => { const m = statusMeta(data.email?.status); const I = m.icon; return (
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", m.bg)}><I className="w-3 h-3" /> {data.email?.status === "operational" ? "Configured" : "Not configured"}</span>
            ); })()}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className={mono}>Provider</div><div className="text-foreground mt-0.5">{data.email?.provider}</div></div>
            <div><div className={mono}>Delivery</div><div className="text-foreground mt-0.5">{data.email?.status === "operational" ? "Enabled" : "Manual links"}</div></div>
          </div>
          {data.email?.status !== "operational" && (
            <p className="text-xs text-amber-600 mt-4 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Email sending is not configured — invites fall back to manual links.</p>
          )}
        </div>

        {/* Runtime */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Server className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Runtime</h2></div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div><div className={mono}>Node</div><div className="text-foreground mt-0.5">{data.runtime?.node}</div></div>
            <div><div className={mono}>Environment</div><div className="text-foreground mt-0.5 capitalize">{data.runtime?.env}</div></div>
            <div><div className={mono}>Platform</div><div className="text-foreground mt-0.5">{data.runtime?.platform}</div></div>
            <div><div className={mono}>Uptime</div><div className="text-foreground mt-0.5">{fmtUptime(data.runtime?.uptimeSeconds)}</div></div>
            <div><div className={mono}>Memory (RSS)</div><div className="text-foreground mt-0.5">{data.runtime?.rssMb} MB</div></div>
            <div><div className={mono}>Heap Used</div><div className="text-foreground mt-0.5">{data.runtime?.heapUsedMb} / {data.runtime?.heapTotalMb} MB</div></div>
          </div>
        </div>
      </div>

      {/* Status summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statusCards.map((c) => {
          const m = statusMeta(c.status);
          const Icon = c.icon;
          const SIcon = m.icon;
          return (
            <div key={c.key} className="rounded-2xl border border-border bg-card p-5 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", m.bg)}><SIcon className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" /> {c.title}</div>
                <div className={cn("text-xs font-mono uppercase tracking-wide", m.tone)}>{c.status}</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Generated {formatDateTime(data.generatedAt)} · auto-refreshes every 30s</p>
    </div>
  );
}

export { SystemHealthSection };
