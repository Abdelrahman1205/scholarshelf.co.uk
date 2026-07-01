import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Database, Play, Trash2, Pencil, ChevronLeft, ChevronRight, Search,
  AlertTriangle, Check, Copy, RefreshCw, Zap, Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Table Browser ────────────────────────────────────────────────────────────

function TableBrowser() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [deleteRow, setDeleteRow] = useState<Record<string, any> | null>(null);

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const r = await apiRequest("PATCH", `/api/owner/db/tables/${selectedTable}/${id}`, values);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Row updated" });
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["/api/owner/db/browse", selectedTable] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/owner/db/tables/${selectedTable}/${id}`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Row deleted" });
      setDeleteRow(null);
      qc.invalidateQueries({ queryKey: ["/api/owner/db/browse", selectedTable] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const columns: string[] = data?.columns ?? [];
  const rows: Record<string, any>[] = data?.rows ?? [];

  function openEdit(row: Record<string, any>) {
    setEditRow(row);
    setEditValues({ ...row });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-52">
          <Label className="text-xs text-muted-foreground mb-1 block">Table</Label>
          <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setPage(1); setSearch(""); setSearchInput(""); }}>
            <SelectTrigger><SelectValue placeholder="Select table…" /></SelectTrigger>
            <SelectContent>
              {(tablesData?.tables ?? []).map((t: string) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-1 min-w-0">
          <Input
            placeholder="Search by id or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}>
            <Search className="w-4 h-4" />
          </Button>
          {selectedTable && (
            <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["/api/owner/db/browse", selectedTable] })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{data.total}</strong> rows</span>
          <span>Page <strong className="text-foreground">{data.page}</strong> of <strong className="text-foreground">{data.pages}</strong></span>
          <span>{columns.length} columns</span>
        </div>
      )}

      {/* Table */}
      {!selectedTable ? (
        <Card className="border-dashed border-2 shadow-none">
          <CardContent className="flex flex-col items-center justify-center h-40 text-center">
            <Database className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Select a table to browse its rows</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>Failed to load table</AlertDescription></Alert>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 sticky left-0 bg-muted/50" />
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap font-mono text-xs">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">No rows found</TableCell>
                </TableRow>
              ) : rows.map((row, i) => (
                <TableRow key={row.id ?? i} className="hover:bg-muted/30 group">
                  <TableCell className="w-8 sticky left-0 bg-background p-1">
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(row)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => setDeleteRow(row)} className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                  {columns.map((col) => {
                    const val = row[col];
                    const display = val === null ? <span className="text-muted-foreground/50 italic text-xs">null</span>
                      : val === true ? <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">true</Badge>
                      : val === false ? <Badge variant="secondary" className="text-xs">false</Badge>
                      : typeof val === "string" && val.length > 60 ? <span title={val}>{val.slice(0, 60)}…</span>
                      : String(val);
                    return (
                      <TableCell key={col} className="font-mono text-xs whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                        {display}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit row — {selectedTable}</DialogTitle>
            <DialogDescription>ID: <span className="font-mono">{editRow?.id}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {Object.keys(editValues).filter(k => !["id", "created_at"].includes(k)).map((key) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground mb-1 block font-mono">{key}</Label>
                <Input
                  value={editValues[key] === null ? "" : String(editValues[key])}
                  onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value || null }))}
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editRow!.id, values: editValues })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => { if (!o) setDeleteRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete row?</DialogTitle>
            <DialogDescription>
              This permanently deletes the row with ID <span className="font-mono font-medium">{deleteRow?.id}</span> from <span className="font-mono">{selectedTable}</span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteRow!.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SQL Console ──────────────────────────────────────────────────────────────

function SqlConsole() {
  const { toast } = useToast();
  const [query, setQuery] = useState("SELECT * FROM schools LIMIT 10;");
  const [result, setResult] = useState<{ rows: any[]; columns: string[]; rowCount: number; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresConfirm, setRequiresConfirm] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function runQuery(dangerConfirm = false) {
    setIsRunning(true);
    setError(null);
    setRequiresConfirm(false);
    try {
      const r = await apiRequest("POST", "/api/owner/db/query", { query, dangerConfirm });
      const data = await r.json();
      if (!r.ok) {
        if (data.requiresConfirm) {
          setRequiresConfirm(true);
          setError(data.message);
        } else {
          setError(data.message || "Query failed");
        }
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
    const rows = result.rows.map(row => result.columns.map(c => row[c] ?? "").join("\t")).join("\n");
    navigator.clipboard.writeText(`${header}\n${rows}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
          <span className="text-xs font-mono text-muted-foreground">SQL Query</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setQuery("")}>Clear</Button>
            <Button size="sm" className="h-6 text-xs gap-1" onClick={() => runQuery()} disabled={isRunning || !query.trim()}>
              <Play className="w-3 h-3" />
              {isRunning ? "Running…" : "Run"}
            </Button>
          </div>
        </div>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
          className="font-mono text-sm border-0 rounded-none min-h-[140px] resize-none focus-visible:ring-0 bg-card"
          placeholder="SELECT * FROM schools LIMIT 10;"
          spellCheck={false}
        />
        <div className="px-3 py-1.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
          Ctrl+Enter to run • DDL blocked • Mutations require confirmation
        </div>
      </div>

      {error && (
        <Alert variant={requiresConfirm ? "default" : "destructive"} className={requiresConfirm ? "border-amber-500/50 bg-amber-50" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            {requiresConfirm && (
              <Button size="sm" variant="destructive" className="shrink-0" onClick={() => runQuery(true)}>
                Confirm & Execute
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{result.rowCount}</strong> rows</span>
              <span><strong className="text-foreground">{result.durationMs}ms</strong></span>
              <span>{result.columns.length} columns</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyResults}>
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy TSV"}
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((col) => (
                    <TableHead key={col} className="font-mono text-xs whitespace-nowrap">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={result.columns.length} className="text-center text-muted-foreground">No rows returned</TableCell></TableRow>
                ) : result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map((col) => {
                      const val = row[col];
                      return (
                        <TableCell key={col} className="font-mono text-xs whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                          {val === null ? <span className="text-muted-foreground/50 italic">null</span> : String(val)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      const r = await apiRequest("POST", `/api/owner/db/danger/wipe-school/${wipeSchoolId}`, { dangerConfirm: true });
      return r.json();
    },
    onSuccess: (data) => {
      setWipeResult(data.message);
      setWipeDialogOpen(false);
      setWipeSchoolId("");
      setWipeConfirmName("");
      qc.invalidateQueries({ queryKey: ["/api/owner/db/browse"] });
      toast({ title: "School data wiped", description: data.message });
    },
    onError: (e: any) => toast({ title: "Wipe failed", description: e.message, variant: "destructive" }),
  });

  const confirmNameMatches = selectedSchool && wipeConfirmName.trim().toLowerCase() === selectedSchool.name.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <Alert className="border-red-500/40 bg-red-50 dark:bg-red-950/20">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700 dark:text-red-400 font-medium">
          Danger Zone — These operations are irreversible. All deleted data is permanently gone.
        </AlertDescription>
      </Alert>

      {/* Wipe school */}
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Wipe School Data
          </CardTitle>
          <CardDescription>
            Permanently deletes all students, classes, books, baskets, payments, allocations, and users for a school. The school record itself is preserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Select school</Label>
            <Select value={wipeSchoolId} onValueChange={setWipeSchoolId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Choose school to wipe…" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} <span className="text-muted-foreground font-mono text-xs ml-1">({s.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {wipeSchoolId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Type the school name to confirm: <span className="font-semibold text-foreground">{selectedSchool?.name}</span>
              </Label>
              <Input
                value={wipeConfirmName}
                onChange={(e) => setWipeConfirmName(e.target.value)}
                placeholder="Type school name exactly…"
                className="max-w-sm"
              />
            </div>
          )}
          <Button
            variant="destructive"
            disabled={!wipeSchoolId || !confirmNameMatches}
            onClick={() => setWipeDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Wipe all data for this school
          </Button>

          {wipeResult && (
            <Alert className="border-emerald-500/40 bg-emerald-50">
              <Check className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{wipeResult}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Final confirm dialog */}
      <Dialog open={wipeDialogOpen} onOpenChange={setWipeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Final confirmation
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>You are about to permanently wipe <strong>all data</strong> for:</p>
              <p className="font-semibold text-foreground text-base">{selectedSchool?.name} ({selectedSchool?.code})</p>
              <p className="text-destructive font-medium">This cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => wipeMutation.mutate()} disabled={wipeMutation.isPending}>
              {wipeMutation.isPending ? "Wiping…" : "Yes, wipe everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DbConsoleSection() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">DB Console</h1>
          <p className="text-sm text-muted-foreground">BytHub super account — direct database access</p>
        </div>
        <Badge variant="destructive" className="ml-auto gap-1">
          <Shield className="w-3 h-3" /> Owner only
        </Badge>
      </div>

      <Tabs defaultValue="browser">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="browser" className="gap-1.5">
            <Database className="w-3.5 h-3.5" /> Table Browser
          </TabsTrigger>
          <TabsTrigger value="sql" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> SQL Console
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-1.5 text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="mt-4">
          <TableBrowser />
        </TabsContent>
        <TabsContent value="sql" className="mt-4">
          <SqlConsole />
        </TabsContent>
        <TabsContent value="danger" className="mt-4">
          <DangerZone />
        </TabsContent>
      </Tabs>
    </div>
  );
}
