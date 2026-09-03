import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Database, Play, ChevronLeft, ChevronRight, Search,
  AlertTriangle, RefreshCw, Terminal, ShieldAlert, Eye,
} from "lucide-react";

/**
 * BytHub DB Console — platform-owner database browse.
 *
 * READ-ONLY BY DESIGN. The query runner, the row editor, the row delete and the
 * tenant wipe were removed on 2 September 2026 under the Legal & Compliance
 * directive (Phase A.3); the endpoints behind them no longer exist. Support work
 * that changes data goes through the typed console operations, which are bounded
 * and audited; tenant deletion goes through the school lifecycle screens.
 *
 * Secret-looking columns (password_hash, mfa_secret, tokens) are redacted by the
 * server before they reach this page.
 *
 * Styling follows the "BytHub" design system (deep slate, indigo accents,
 * monospaced data). The console is always dark regardless of app theme, since
 * it is a high-privilege engineering surface.
 */

// ── Shared style tokens (BytHub palette) ────────────────────────────────────
const S = {
  panel: "bg-[#171f33] border border-[#2d3449] rounded-xl",
  input:
    "w-full bg-[#060e20] border border-[#464554] rounded-lg px-3 py-2 text-sm text-[#dae2fd] " +
    "placeholder:text-[#908fa0] focus:outline-none focus:ring-2 focus:ring-[#8083ff] focus:border-transparent",
  btnGhost:
    "inline-flex items-center gap-2 rounded-lg border border-[#464554] bg-[#222a3d] px-3 py-2 " +
    "text-sm text-[#dae2fd] hover:bg-[#2d3449] disabled:opacity-40 transition",
  label: "text-[11px] font-bold uppercase tracking-wider text-[#908fa0]",
  mono: "font-mono text-xs",
};

function StatusPill({ value }: { value: any }) {
  const v = String(value).toLowerCase();
  const map: Record<string, string> = {
    active: "bg-[#89ceff1a] text-[#89ceff] border-[#89ceff55]",
    completed: "bg-[#89ceff1a] text-[#89ceff] border-[#89ceff55]",
    confirmed: "bg-[#89ceff1a] text-[#89ceff] border-[#89ceff55]",
    suspended: "bg-[#f59e0b1a] text-[#f59e0b] border-[#f59e0b55]",
    pending: "bg-[#908fa01a] text-[#c7c4d7] border-[#908fa055]",
    archived: "bg-[#908fa01a] text-[#c7c4d7] border-[#908fa055]",
    rejected: "bg-[#ffb4ab1a] text-[#ffb4ab] border-[#ffb4ab55]",
    deleted: "bg-[#ffb4ab1a] text-[#ffb4ab] border-[#ffb4ab55]",
  };
  const cls = map[v] || "bg-[#908fa01a] text-[#c7c4d7] border-[#908fa055]";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {String(value)}
    </span>
  );
}

function cellValue(val: any) {
  if (val === null || val === undefined) return <span className="text-[#908fa0] italic">null</span>;
  if (val === "[redacted]") return <span className="text-[#908fa0] italic">[redacted]</span>;
  if (val === true || val === false) return <StatusPill value={String(val)} />;
  const s = String(val);
  const looksStatus = ["active", "suspended", "pending", "archived", "confirmed", "rejected", "completed", "deleted"].includes(s.toLowerCase());
  if (looksStatus) return <StatusPill value={s} />;
  if (s.length > 60) return <span title={s}>{s.slice(0, 60)}…</span>;
  return s;
}

// ─── Table Browser (read-only) ──────────────────────────────────────────────
function TableBrowser() {
  const qc = useQueryClient();
  const [selectedTable, setSelectedTable] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data: tablesData } = useQuery({
    queryKey: ["/api/owner/db/tables"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/owner/db/tables"); return r.json(); },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/owner/db/browse", selectedTable, page, search],
    queryFn: async () => {
      if (!selectedTable) return null;
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      const r = await apiRequest("GET", `/api/owner/db/tables/${selectedTable}?${params}`);
      return r.json();
    },
    enabled: !!selectedTable,
  });

  const tables: string[] = tablesData?.tables ?? [];
  const columns: string[] = data?.columns ?? [];
  const rows: Record<string, any>[] = data?.rows ?? [];

  return (
    <div className="space-y-5">
      {/* Title + table selector */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#c0c1ff]">Table Browser</h2>
          <p className="text-sm text-[#c7c4d7]">Read-only view of production data. Every browse is written to the audit log.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <div className={`${S.label} mb-1`}>Target Table</div>
            <select
              value={selectedTable}
              onChange={(e) => { setSelectedTable(e.target.value); setPage(1); setSearch(""); setSearchInput(""); }}
              className={`${S.input} min-w-[200px]`}
            >
              <option value="">Select table…</option>
              {tables.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Search bar + stat cards */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3">
        <div className={`${S.panel} flex items-center gap-3 px-4 py-3`}>
          <Search className="w-4 h-4 text-[#908fa0] shrink-0" />
          <input
            placeholder={selectedTable ? `Search ${selectedTable} by id or name…` : "Select a table to begin…"}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            disabled={!selectedTable}
            className={`flex-1 bg-transparent ${S.mono} text-sm text-[#dae2fd] placeholder:text-[#908fa0] focus:outline-none disabled:opacity-50`}
          />
          <button
            onClick={() => { setSearch(searchInput); setPage(1); }}
            disabled={!selectedTable}
            className="text-[#c0c1ff] hover:text-white disabled:opacity-30"
            title="Run search"
          >
            <Play className="w-4 h-4" />
          </button>
          {selectedTable && (
            <button onClick={() => qc.invalidateQueries({ queryKey: ["/api/owner/db/browse", selectedTable] })} className="text-[#908fa0] hover:text-[#dae2fd]" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className={`${S.panel} px-5 py-3 min-w-[130px]`}>
          <div className={S.label}>Total Rows</div>
          <div className="text-2xl font-bold text-[#dae2fd] mt-0.5">{data ? Number(data.total).toLocaleString() : "—"}</div>
        </div>
        <div className={`${S.panel} px-5 py-3 min-w-[130px] ring-1 ring-[#8083ff33]`}>
          <div className={S.label}>Columns</div>
          <div className="text-2xl font-bold text-[#c0c1ff] mt-0.5">{data ? columns.length : "—"}</div>
        </div>
      </div>

      {/* Data table */}
      {!selectedTable ? (
        <div className={`${S.panel} border-dashed flex flex-col items-center justify-center h-48 text-center`}>
          <Database className="w-8 h-8 text-[#464554] mb-2" />
          <p className="text-sm text-[#908fa0]">Select a table to browse its rows.</p>
        </div>
      ) : isLoading ? (
        <div className={`${S.panel} h-48 flex items-center justify-center text-sm text-[#908fa0]`}>Loading…</div>
      ) : isError ? (
        <div className="rounded-lg border border-[#93000a] bg-[#93000a1a] px-4 py-3 text-sm text-[#ffb4ab] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Failed to load table.
        </div>
      ) : (
        <div className={`${S.panel} overflow-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2d3449]">
                {columns.map((col) => (
                  <th key={col} className={`text-left px-4 py-3 ${S.label} whitespace-nowrap`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={Math.max(1, columns.length)} className="text-center text-[#908fa0] py-10 text-sm">No rows found.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-[#2d3449] hover:bg-[#222a3d] transition-colors">
                  {columns.map((col) => (
                    <td key={col} className={`px-4 py-3 ${S.mono} text-[#dae2fd] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis`}>
                      {cellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Footer / pagination */}
          {data && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d3449] text-xs text-[#908fa0]">
              <span>Showing page {data.page} of {data.pages} · {Number(data.total).toLocaleString()} rows</span>
              <div className="flex items-center gap-2">
                <button className={`${S.btnGhost} px-2 py-1`} disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[#dae2fd] font-mono">{page} / {data.pages}</span>
                <button className={`${S.btnGhost} px-2 py-1`} disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export function DbConsoleSection() {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-[#0b1326] text-[#dae2fd] p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#8083ff] to-[#c0c1ff] flex items-center justify-center">
          <Terminal className="w-5 h-5 text-[#1000a9]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#dae2fd]">BytHub</h1>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c0c1ff]">Super-Admin</span>
          </div>
          <p className="text-sm text-[#908fa0]">DB Console — read-only production browse</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#93000a] bg-[#93000a1a] px-3 py-1 text-xs font-semibold text-[#ffb4ab]">
          <ShieldAlert className="w-3.5 h-3.5" /> Owner only
        </span>
      </div>

      {/* Read-only notice */}
      <div className="mb-6 rounded-xl border border-[#2d3449] bg-[#171f33] px-4 py-3 flex gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#222a3d] flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5 text-[#c0c1ff]" />
        </div>
        <div className="text-sm">
          <div className="font-semibold text-[#dae2fd]">This console cannot change data</div>
          <p className="text-[#c7c4d7] mt-0.5 max-w-3xl">
            The query runner, row editor and tenant wipe were removed. Use the typed console
            operations for support actions, and the school lifecycle screens to suspend, archive or
            delete a tenant — both are bounded and audited. Password hashes, MFA secrets and tokens
            are redacted before they leave the server.
          </p>
        </div>
      </div>

      <TableBrowser />
    </div>
  );
}
