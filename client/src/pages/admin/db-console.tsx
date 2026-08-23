import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Database, Play, Trash2, ChevronLeft, ChevronRight, Search,
  AlertTriangle, Check, Copy, RefreshCw, Terminal, ShieldAlert, ShieldCheck, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * BytHub DB Console — platform-owner database administration.
 *
 * Styling follows the "BytHub" design system (deep slate, indigo accents,
 * monospaced data). The console is always dark regardless of app theme, since
 * it is a high-privilege engineering surface. All data operations use the real
 * /api/owner/db/* endpoints; nothing here is mocked.
 */

// ── Shared style tokens (BytHub palette) ────────────────────────────────────
const S = {
  panel: "bg-[#171f33] border border-[#2d3449] rounded-xl",
  panelInset: "bg-[#0b1326] border border-[#464554] rounded-lg",
  input:
    "w-full bg-[#060e20] border border-[#464554] rounded-lg px-3 py-2 text-sm text-[#dae2fd] " +
    "placeholder:text-[#908fa0] focus:outline-none focus:ring-2 focus:ring-[#8083ff] focus:border-transparent",
  btnPrimary:
    "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8083ff] to-[#c0c1ff] " +
    "px-4 py-2 text-sm font-semibold text-[#1000a9] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition",
  btnGhost:
    "inline-flex items-center gap-2 rounded-lg border border-[#464554] bg-[#222a3d] px-3 py-2 " +
    "text-sm text-[#dae2fd] hover:bg-[#2d3449] disabled:opacity-40 transition",
  btnDanger:
    "inline-flex items-center gap-2 rounded-lg bg-[#93000a] px-4 py-2 text-sm font-semibold text-[#ffdad6] " +
    "hover:bg-[#b3131d] disabled:opacity-40 disabled:cursor-not-allowed transition",
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
  if (val === true || val === false) return <StatusPill value={String(val)} />;
  const s = String(val);
  const looksStatus = ["active", "suspended", "pending", "archived", "confirmed", "rejected", "completed", "deleted"].includes(s.toLowerCase());
  if (looksStatus) return <StatusPill value={s} />;
  if (s.length > 60) return <span title={s}>{s.slice(0, 60)}…</span>;
  return s;
}

// ─── Table Browser ──────────────────────────────────────────────────────────
function TableBrowser() {
  const { toast } = useToast();
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
      {/* Title + scope/table selectors */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#c0c1ff]">Table Browser</h2>
          <p className="text-sm text-[#c7c4d7]">Exploring direct production data for the <span className={`${S.mono} text-[#89ceff]`}>scholar_db</span> cluster.</p>
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

      {/* Query bar + stat cards */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3">
        <div className={`${S.panel} flex items-center gap-3 px-4 py-3`}>
          <Search className="w-4 h-4 text-[#908fa0] shrink-0" />
          <input
            placeholder={selectedTable ? `SELECT * FROM ${selectedTable} — search by id or name…` : "Select a table to begin…"}
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
                <th className="w-10 px-3 py-3" />
                {columns.map((col) => (
                  <th key={col} className={`text-left px-4 py-3 ${S.label} whitespace-nowrap`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center text-[#908fa0] py-10 text-sm">No rows found.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-[#2d3449] hover:bg-[#222a3d] group transition-colors">
                  <td className="w-10 px-2 py-2">
                    {/* Row editing was removed. The PATCH endpoint interpolated JSON
                        object keys straight into SQL, and nothing typed replaces that.
                        Changes go through Operations, which are audited. */}
                    <span className="sr-only">Read-only row</span>
                  </td>
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

// ─── SQL Console ──────────────────────────────────────────────────────────────
function SqlConsole() {
  const [query, setQuery] = useState("SELECT * FROM schools LIMIT 10;");
  const [result, setResult] = useState<{ rows: any[]; columns: string[]; rowCount: number; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresConfirm, setRequiresConfirm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function runQuery() {
    setIsRunning(true); setError(null); setRequiresConfirm(false);
    try {
      // The console connects as console_ro inside BEGIN READ ONLY and always
      // rolls back, so there is no such thing as a "dangerous" query here any
      // more — Postgres refuses writes before this code ever sees them.
      const r = await apiRequest("POST", "/api/owner/db/query", { query });
      const data = await r.json();
      if (!r.ok) {
        setError(data.message || "Query failed");
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setIsRunning(false);
    }
  }

  function copyResults() {
    if (!result) return;
    const header = result.columns.join("\t");
    const body = result.rows.map((row) => result.columns.map((c) => row[c] ?? "").join("\t")).join("\n");
    navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const lineCount = Math.max(query.split("\n").length, 7);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight text-[#c0c1ff]">Query Runner</h2>

      {/* Editor card */}
      <div className={`${S.panel} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3449]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#89ceff]" />
            <span className={`${S.mono} font-semibold text-[#dae2fd]`}>scholar_db · production</span>
          </div>
          <span className="text-xs text-[#908fa0]">Ctrl + Enter to execute</span>
        </div>
        <div className="flex">
          {/* line gutter */}
          <div className={`select-none py-3 px-3 text-right ${S.mono} text-[#464554] bg-[#060e20] border-r border-[#2d3449]`}>
            {Array.from({ length: lineCount }, (_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
            className={`flex-1 bg-[#060e20] ${S.mono} text-sm leading-6 text-[#dae2fd] p-3 min-h-[160px] resize-none focus:outline-none placeholder:text-[#908fa0]`}
            placeholder="SELECT * FROM schools LIMIT 10;"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2d3449]">
          <span className="text-xs text-[#908fa0]">DDL blocked · mutations require confirmation</span>
          <div className="flex gap-2">
            <button className={S.btnGhost} onClick={() => setQuery("")}>Clear</button>
            <button className={S.btnPrimary} onClick={() => runQuery()} disabled={isRunning || !query.trim()}>
              <Play className="w-4 h-4" /> {isRunning ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      </div>

      {/* Error / confirm */}
      {error && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between gap-4 ${requiresConfirm ? "border-[#f59e0b55] bg-[#f59e0b1a] text-[#f59e0b]" : "border-[#93000a] bg-[#93000a1a] text-[#ffb4ab]"}`}>
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</span>

        </div>
      )}

      {/* Results */}
      {result && (
        <div className={`${S.panel} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3449]">
            <div className="flex items-center gap-4 text-xs text-[#908fa0]">
              <span className="font-semibold text-[#dae2fd] flex items-center gap-2"><Terminal className="w-4 h-4" /> Query Results</span>
              <span><strong className="text-[#dae2fd]">{result.rowCount}</strong> rows</span>
              <span><strong className="text-[#89ceff]">{result.durationMs}ms</strong></span>
              <span>{result.columns.length} cols</span>
            </div>
            <button className={`${S.btnGhost} px-3 py-1.5`} onClick={copyResults}>
              {copied ? <Check className="w-3.5 h-3.5 text-[#89ceff]" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy as TSV"}
            </button>
          </div>
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#2d3449]">
                  {result.columns.map((col) => <th key={col} className={`text-left px-4 py-3 ${S.label} whitespace-nowrap`}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr><td colSpan={result.columns.length} className="text-center text-[#908fa0] py-8 text-sm">No rows returned.</td></tr>
                ) : result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#2d3449] hover:bg-[#222a3d]">
                    {result.columns.map((col) => (
                      <td key={col} className={`px-4 py-3 ${S.mono} text-[#dae2fd] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis`}>{cellValue(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────
function DangerZone() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wipeSchoolId, setWipeSchoolId] = useState("");
  const [wipeConfirmName, setWipeConfirmName] = useState("");
  const [wipeReason, setWipeReason] = useState("");
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
  const [wipeResult, setWipeResult] = useState<string | null>(null);

  const { data: schoolsData } = useQuery({
    queryKey: ["/api/owner/schools"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/owner/schools"); return r.json(); },
  });

  const schools: any[] = schoolsData?.schools ?? schoolsData ?? [];
  const selectedSchool = schools.find((s: any) => s.id === wipeSchoolId);

  const wipeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/owner/db/danger/wipe-school/${wipeSchoolId}`, {
        confirmCode: wipeConfirmName.trim(),
        reason: wipeReason.trim(),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setWipeResult(data.message);
      setWipeDialogOpen(false); setWipeSchoolId(""); setWipeConfirmName(""); setWipeReason("");
      qc.invalidateQueries({ queryKey: ["/api/owner/db/browse"] });
      toast({ title: "School marked for deletion", description: data.message });
    },
    onError: (e: any) => toast({ title: "Wipe failed", description: e.message, variant: "destructive" }),
  });

  // The server compares the school CODE, so the UI must ask for the code.
  // A code is unambiguous; two schools can share a name.
  const confirmNameMatches =
    !!selectedSchool &&
    wipeConfirmName.trim().toUpperCase() === String(selectedSchool.code ?? "").trim().toUpperCase();
  const reasonIsSufficient = wipeReason.trim().length >= 20;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#dae2fd]">Critical System Maintenance</h2>
        <p className="text-sm text-[#c7c4d7] mt-1 max-w-2xl">
          Destructive tenant-data operations. These actions are irreversible and take immediate effect — proceed only with a verified backup and sign-off.
        </p>
      </div>

      {/* Unrestrained access warning */}
      <div className="rounded-xl border border-[#93000a] bg-gradient-to-r from-[#93000a22] to-transparent px-4 py-4 flex gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#93000a] flex items-center justify-center shrink-0"><ShieldAlert className="w-5 h-5 text-[#ffdad6]" /></div>
        <div>
          <div className="font-semibold text-[#ffb4ab]">High-privilege console</div>
          <p className="text-sm text-[#ffb4ab]/80 mt-0.5">Data deleted here is permanent and is not recoverable from routine snapshots. Every action on this page is written to the audit log.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* Wipe card */}
        <div className="rounded-xl border-2 border-[#93000a] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#ffb4ab]" />
            <h3 className="text-lg font-bold text-[#ffb4ab]">Danger Zone</h3>
          </div>
          <div className={`${S.panel} p-4 space-y-4`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-[#dae2fd]">School Wipe</div>
                <p className="text-sm text-[#c7c4d7] mt-0.5 max-w-md">Purge all data for a tenant — students, classes, books, baskets, payments, allocations, and users. The school record itself is preserved.</p>
              </div>
              <span className="inline-flex items-center rounded border border-[#93000a] bg-[#93000a33] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#ffb4ab]">Destructive</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className={`${S.label} mb-1`}>Select Tenant</div>
                <select value={wipeSchoolId} onChange={(e) => { setWipeSchoolId(e.target.value); setWipeConfirmName(""); }} className={S.input}>
                  <option value="">Choose a school…</option>
                  {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <div className={`${S.label} mb-1`}>Confirm Selection</div>
                <input
                  value={wipeConfirmName}
                  onChange={(e) => setWipeConfirmName(e.target.value)}
                  disabled={!wipeSchoolId}
                  placeholder={selectedSchool ? `Type "${selectedSchool.code}"` : "Select a school first"}
                  className={`${S.input} disabled:opacity-50`}
                />
              </div>
            </div>

            <div>
              <div className={`${S.label} mb-1`}>Reason (recorded in the audit trail)</div>
              <textarea
                value={wipeReason}
                onChange={(e) => setWipeReason(e.target.value)}
                disabled={!wipeSchoolId}
                rows={2}
                placeholder="Why is this school being deleted? Minimum 20 characters."
                className={`${S.input} disabled:opacity-50 resize-y`}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#2d3449]">
              <p className="text-xs text-[#908fa0] max-w-xs">
                Type the exact school code and give a reason. This marks the school for
                deletion — no data is removed, and it stays restorable for 7 days.
              </p>
              <button
                className={S.btnDanger}
                disabled={!wipeSchoolId || !confirmNameMatches || !reasonIsSufficient}
                onClick={() => setWipeDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" /> Mark for deletion
              </button>
            </div>
          </div>

          {wipeResult && (
            <div className="rounded-lg border border-[#89ceff55] bg-[#89ceff1a] px-4 py-3 text-sm text-[#89ceff] flex items-center gap-2">
              <Check className="w-4 h-4" /> {wipeResult}
            </div>
          )}
        </div>

        {/* Safety checklist */}
        <div className={`${S.panel} p-5 h-fit`}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-[#c0c1ff]" />
            <h3 className="font-semibold text-[#dae2fd]">Safety Checklist</h3>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "Confirm a recent database backup exists",
              "Verify you have the correct tenant selected",
              "Ensure sign-off from the school / account owner",
              "Understand this cannot be undone",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[#c7c4d7]">
                <span className="mt-0.5 h-4 w-4 rounded-full border border-[#464554] flex items-center justify-center shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-[#2d3449] text-xs text-[#908fa0]">
            Every console action — including browsing and queries — is recorded in <span className={S.mono}>console_audit</span> with your account, IP, statement and a before/after snapshot.
          </div>
        </div>
      </div>

      {/* Final confirm modal */}
      {wipeDialogOpen && (
        <Modal onClose={() => setWipeDialogOpen(false)} title="Final confirmation" danger>
          <div className="space-y-2 py-2">
            <p className="text-sm text-[#c7c4d7]">You are about to mark this school for deletion:</p>
            <p className="font-semibold text-[#dae2fd] text-base">{selectedSchool?.name} <span className={`${S.mono} text-[#908fa0]`}>({selectedSchool?.code})</span></p>
            <p className="text-sm text-[#c7c4d7]">
              Every user at the school loses access immediately. <strong className="text-[#dae2fd]">No data is removed.</strong>{" "}
              You can restore it with “Reactivate school” for the next 7 days, after which it
              becomes eligible for a permanent purge — which needs its own confirmation.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button className={S.btnGhost} onClick={() => setWipeDialogOpen(false)}>Cancel</button>
            <button className={S.btnDanger} onClick={() => wipeMutation.mutate()} disabled={wipeMutation.isPending}>
              {wipeMutation.isPending ? "Marking…" : "Mark for deletion"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Modal primitive (BytHub styled) ────────────────────────────────────────
function Modal({ children, onClose, title, subtitle, danger, wide }: {
  children: React.ReactNode; onClose: () => void; title: string; subtitle?: string; danger?: boolean; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${S.panel} ${wide ? "max-w-2xl" : "max-w-md"} w-full p-5 shadow-2xl`}
        style={{ borderColor: danger ? "#93000a" : "#464554" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className={`text-lg font-bold ${danger ? "text-[#ffb4ab]" : "text-[#dae2fd]"} flex items-center gap-2`}>
              {danger && <AlertTriangle className="w-5 h-5" />} {title}
            </h3>
            {subtitle && <p className={`text-xs ${S.mono} text-[#908fa0] mt-0.5`}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[#908fa0] hover:text-[#dae2fd]"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
type Tab = "browser" | "sql" | "danger";

export function DbConsoleSection() {
  const [tab, setTab] = useState<Tab>("browser");
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "browser", label: "Table Browser", icon: Database },
    { id: "sql", label: "Query Runner", icon: Terminal },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

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
          <p className="text-sm text-[#908fa0]">DB Console — direct production database access</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#93000a] bg-[#93000a1a] px-3 py-1 text-xs font-semibold text-[#ffb4ab]">
          <ShieldAlert className="w-3.5 h-3.5" /> Owner only
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#131b2e] border border-[#2d3449] rounded-xl p-1 w-fit">
        {tabs.map((t) => {
          const active = tab === t.id;
          const isDanger = t.id === "danger";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? isDanger ? "bg-[#93000a] text-[#ffdad6]" : "bg-gradient-to-r from-[#8083ff] to-[#c0c1ff] text-[#1000a9]"
                  : `text-[#c7c4d7] hover:bg-[#222a3d] ${isDanger ? "hover:text-[#ffb4ab]" : ""}`
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "browser" && <TableBrowser />}
      {tab === "sql" && <SqlConsole />}
      {tab === "danger" && <DangerZone />}
    </div>
  );
}
