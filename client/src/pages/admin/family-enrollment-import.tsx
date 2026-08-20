/**
 * client/src/pages/admin/family-enrollment-import.tsx
 *
 * "Import Student Sheet" — the spreadsheet enrollment path, presented as a
 * dialog INSIDE the existing New Enrollment screen (/admin/family-enroll).
 *
 * This is deliberately NOT a page, a route or a sidebar entry. It is a second
 * way to do the thing the surrounding screen already does, so it opens over
 * that screen and closes back onto it. The administrator never leaves New
 * Enrollment.
 *
 * Steps, all within the one dialog:
 *   upload → map columns → preview → confirm → results
 *
 * The preview NEVER changes the database. The file is sent again on confirm and
 * re-validated server-side, so what gets written is what the server decided,
 * not what the browser is holding.
 *
 * Styling follows the existing admin design system: shadcn Dialog/Table/Button,
 * the `mono` micro-label, rounded-2xl cards, emerald/amber/destructive states.
 */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, Loader2,
  ArrowRight, ArrowLeft, Sparkles, RefreshCw, UserPlus, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  IMPORT_ACCEPT_ATTR, IMPORT_FIELDS, IMPORT_MAX_FILE_BYTES,
  type ImportFieldKey,
} from "@shared/enrollment-import";

// ── Types mirroring the server's AnalyzeResult / CommitResult ───────────────

type RowAction = "create" | "update" | "duplicate" | "error";

interface ColumnReport {
  column: string; index: number; field: ImportFieldKey | null; fieldLabel: string | null;
  confidence: "exact" | "none"; duplicate: boolean; samples: string[];
}
interface PreviewRow {
  sheetRow: number; studentName: string; dateOfBirth: string | null; gradeLevel: string | null;
  className: string | null; householdName: string; guardianName: string | null;
  action: RowAction; existingStudentCode?: string | null;
  matchedOn?: "studentCode" | "nameAndDob";
  classChange?: { from: string | null; to: string | null } | null;
  duplicateOfRow?: number; problems: string[];
}
interface AnalyzeResult {
  file: { name: string; sheetName: string; rowsRead: number; totalRowsInFile: number; truncated: boolean };
  columns: ColumnReport[];
  ignoredColumns: string[];
  missingRequiredFields: string[];
  summary: {
    studentsDetected: number; newStudents: number; existingStudents: number;
    duplicateRowsInFile: number; invalidRows: number; existingClasses: number;
    newClasses: number; familiesToCreate: number; familiesReused: number;
  };
  classesToCreate: Array<{ name: string; rowCount: number }>;
  existingClassNames: string[];
  rows: PreviewRow[];
  invalidRows: Array<{ sheetRow: number; studentName: string; problem: string }>;
  mapping: Record<string, ImportFieldKey>;
  canImport: boolean;
}
interface CommitResult {
  processed: number; created: number; updated: number; skipped: number;
  classesCreated: number; createdClassNames: string[];
  familiesCreated: number; guardiansCreated: number; errorCount: number;
  failedRows: Array<{ sheetRow: number; studentName: string; problem: string }>;
}

type Step = "upload" | "map" | "preview" | "result";

const mono = "text-[10px] font-mono uppercase tracking-wider text-muted-foreground";

/** Groups shown as optgroup-ish separators in the field picker. */
const FIELD_GROUP_LABEL: Record<string, string> = {
  student: "Student", class: "Class", family: "Family", guardian: "Parent / Guardian",
};

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className={mono}>{label}</div>
      <div className={cn(
        "text-xl font-semibold tabular-nums",
        tone === "good" && "text-emerald-600",
        tone === "warn" && "text-amber-600",
        tone === "bad" && "text-destructive",
        !tone && "text-foreground",
      )}>{value}</div>
    </div>
  );
}

function ActionBadge({ row }: { row: PreviewRow }) {
  if (row.action === "create") return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">New</Badge>;
  if (row.action === "update") return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Update</Badge>;
  if (row.action === "duplicate") return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">Duplicate row</Badge>;
  return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Invalid</Badge>;
}

export function ImportStudentSheetDialog({
  open, onOpenChange, onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful commit so the host screen can refresh. */
  onImported?: (result: CommitResult) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  /** Administrator's column corrections: column index → field key or "ignore". */
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [dragging, setDragging] = useState(false);

  const reset = (keepOpen = true) => {
    setStep("upload"); setFile(null); setAnalysis(null); setResult(null); setOverrides({});
    if (!keepOpen) onOpenChange(false);
  };

  // ── The field list comes from the server so client and server can never
  //    disagree about what is importable. Falls back to the shared registry. ──
  const { data: fieldMeta } = useQuery<{ fields: Array<{ key: ImportFieldKey; label: string; group: string; required: boolean; hint: string | null }> }>({
    queryKey: ["/api/families/enroll/import/fields"],
    enabled: open,
  });
  const fields = fieldMeta?.fields ?? IMPORT_FIELDS.map((f) => ({
    key: f.key, label: f.label, group: f.group, required: f.required, hint: f.hint ?? null,
  }));
  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, typeof fields> = {};
    for (const f of fields) (groups[f.group] ||= []).push(f);
    return groups;
  }, [fields]);

  // ── Analyse (preview) — never writes ──
  const analyzeMutation = useMutation({
    mutationFn: async (payload: { file: File; overrides?: Record<number, string> }) => {
      const fd = new FormData();
      fd.append("file", payload.file);
      if (payload.overrides && Object.keys(payload.overrides).length > 0) {
        fd.append("mapping", JSON.stringify(payload.overrides));
      }
      const res = await fetch("/api/families/enroll/import/analyze", {
        method: "POST", body: fd, credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Could not read that spreadsheet (${res.status})`);
      return data as AnalyzeResult;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      setStep((s) => (s === "upload" ? "map" : s));
    },
    onError: (e: any) => toast({ title: "Could not read the spreadsheet", description: e.message, variant: "destructive" }),
  });

  // ── Commit — the only call that writes ──
  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No spreadsheet selected");
      const fd = new FormData();
      fd.append("file", file);
      if (Object.keys(overrides).length > 0) fd.append("mapping", JSON.stringify(overrides));
      const res = await fetch("/api/families/enroll/import/commit", {
        method: "POST", body: fd, credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Import failed (${res.status})`);
      return data as CommitResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      onImported?.(data);
      toast({
        title: "Import complete",
        description: `${data.created} created · ${data.updated} updated${data.classesCreated ? ` · ${data.classesCreated} class(es) created` : ""}`,
      });
    },
    onError: (e: any) => toast({ title: "Import failed — nothing was changed", description: e.message, variant: "destructive" }),
  });

  const takeFile = (picked: File | null | undefined) => {
    if (!picked) return;
    if (picked.size > IMPORT_MAX_FILE_BYTES) {
      toast({
        title: "That file is too large",
        description: `The limit is ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
        variant: "destructive",
      });
      return;
    }
    setFile(picked);
    setOverrides({});
    setAnalysis(null);
    analyzeMutation.mutate({ file: picked });
  };

  const setOverride = (index: number, value: string) => {
    const next = { ...overrides, [index]: value };
    setOverrides(next);
    if (file) analyzeMutation.mutate({ file, overrides: next });
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/families/enroll/import/template", { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scholarshelf-student-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Could not download the template", description: e.message, variant: "destructive" });
    }
  };

  const s = analysis?.summary;
  const importable = (s?.newStudents ?? 0) + (s?.existingStudents ?? 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(false); else onOpenChange(true); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Student Sheet
          </DialogTitle>
          <DialogDescription>
            Enrol a whole spreadsheet of students without leaving New Enrollment. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step rail ── */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          {(["upload", "map", "preview", "result"] as Step[]).map((sKey, i) => {
            const labels: Record<Step, string> = { upload: "Upload", map: "Map columns", preview: "Preview", result: "Results" };
            const order: Step[] = ["upload", "map", "preview", "result"];
            const active = step === sKey;
            const done = order.indexOf(step) > i;
            return (
              <div key={sKey} className="flex items-center gap-2">
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold",
                  done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>{done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}</div>
                <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>{labels[sKey]}</span>
                {i < 3 && <div className="w-6 h-px bg-border" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ─────────────── STEP 1 · UPLOAD ─────────────── */}
          {step === "upload" && (
            <div className="space-y-4 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={IMPORT_ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ""; }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
                className={cn(
                  "w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center justify-center gap-2 transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40",
                )}
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {analyzeMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {analyzeMutation.isPending ? "Reading your spreadsheet…" : "Click to choose a spreadsheet, or drop it here"}
                </div>
                <div className="text-xs text-muted-foreground">
                  .xlsx, .xls or .csv · up to {Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB · one student per row
                </div>
              </button>

              <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="font-medium text-foreground mb-1">Not sure about the columns?</div>
                  <p className="text-muted-foreground text-xs">
                    The template carries the exact ScholarShelf enrollment fields, marks the required ones, and shows the UK date format.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
                  <Download className="w-4 h-4 mr-2" /> Download Student Import Template
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-start gap-1.5"><Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" /> Classes that don't exist yet are created automatically — you'll see exactly which ones before anything is saved.</p>
                <p className="flex items-start gap-1.5"><RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" /> Students already on roll are updated in place, never duplicated.</p>
              </div>
            </div>
          )}

          {/* ─────────────── STEP 2 · COLUMN MAPPING ─────────────── */}
          {step === "map" && analysis && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{analysis.file.name}</span>
                  <span className="text-muted-foreground"> · sheet "{analysis.file.sheetName}" · {analysis.file.rowsRead} row(s)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => reset()}>Choose a different file</Button>
              </div>

              {analysis.missingRequiredFields.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    No column is mapped to <strong>{analysis.missingRequiredFields.join(", ")}</strong>.
                    Pick the matching column below — these are required by the enrollment form.
                  </span>
                </div>
              )}

              {analysis.file.truncated && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Only the first {analysis.file.rowsRead} of {analysis.file.totalRowsInFile} rows will be imported. Split the file and import the rest afterwards.
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={mono}>Spreadsheet column</TableHead>
                      <TableHead className={mono}>Sample values</TableHead>
                      <TableHead className={cn(mono, "w-[260px]")}>ScholarShelf field</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.columns.map((c) => {
                      const unmapped = !c.field;
                      return (
                        <TableRow key={c.index} className={unmapped ? "bg-amber-50/60" : ""}>
                          <TableCell className="font-medium">
                            {c.column}
                            {c.duplicate && <div className="text-[11px] text-amber-700">Another column already uses this field</div>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {c.samples.length ? c.samples.join(" · ") : <span className="italic opacity-60">empty</span>}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={overrides[c.index] ?? c.field ?? "ignore"}
                              onValueChange={(v) => setOverride(c.index, v)}
                            >
                              <SelectTrigger className={unmapped ? "border-amber-400" : ""}>
                                <SelectValue placeholder="Ignore this column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignore">— Ignore this column —</SelectItem>
                                {Object.entries(fieldsByGroup).map(([group, gf]) => (
                                  <div key={group}>
                                    <div className={cn(mono, "px-2 py-1.5")}>{FIELD_GROUP_LABEL[group] || group}</div>
                                    {gf.map((f) => (
                                      <SelectItem key={f.key} value={f.key}>
                                        {f.label}{f.required ? " *" : ""}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {analysis.ignoredColumns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <strong>{analysis.ignoredColumns.length} column(s) will be ignored:</strong> {analysis.ignoredColumns.join(", ")}. ScholarShelf has no field for them — map them above if that's wrong.
                </p>
              )}
            </div>
          )}

          {/* ─────────────── STEP 3 · PREVIEW ─────────────── */}
          {step === "preview" && analysis && s && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="font-medium text-foreground">{analysis.file.name}</span>
                <span className="text-muted-foreground"> · nothing has been saved yet</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatCard label="Students detected" value={s.studentsDetected} />
                <StatCard label="New students" value={s.newStudents} tone="good" />
                <StatCard label="To update" value={s.existingStudents} />
                <StatCard label="Duplicate rows" value={s.duplicateRowsInFile} tone={s.duplicateRowsInFile ? "warn" : undefined} />
                <StatCard label="Invalid rows" value={s.invalidRows} tone={s.invalidRows ? "bad" : undefined} />
                <StatCard label="New classes" value={s.newClasses} tone={s.newClasses ? "warn" : undefined} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-3">
                  <div className={cn(mono, "mb-2")}>Classes</div>
                  {analysis.existingClassNames.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                      Reusing {analysis.existingClassNames.length}: {analysis.existingClassNames.join(", ")}
                    </p>
                  )}
                  {analysis.classesToCreate.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-amber-700 mb-1">To be created automatically:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.classesToCreate.map((c) => (
                          <Badge key={c.name} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                            {c.name} <span className="opacity-60 ml-1">· {c.rowCount} student(s)</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No new classes needed.</p>
                  )}
                </div>

                <div className="rounded-xl border border-border p-3">
                  <div className={cn(mono, "mb-2")}>Families</div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                    <UserPlus className="w-3.5 h-3.5 text-primary" /> {s.familiesToCreate} new household record(s)
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> {s.familiesReused} existing household(s) reused
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Siblings are grouped by Family / Household Name, then by parent email or phone.
                  </p>
                </div>
              </div>

              {analysis.invalidRows.length > 0 && (
                <div className="rounded-xl border border-red-200 overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {analysis.invalidRows.length} row(s) will be skipped — fix these in the spreadsheet and import again
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={cn(mono, "w-16")}>Row</TableHead>
                        <TableHead className={mono}>Student</TableHead>
                        <TableHead className={mono}>Problem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.invalidRows.slice(0, 50).map((r) => (
                        <TableRow key={r.sheetRow}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.sheetRow}</TableCell>
                          <TableCell>{r.studentName}</TableCell>
                          <TableCell className="text-sm text-red-700">{r.problem}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {analysis.invalidRows.length > 50 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">…and {analysis.invalidRows.length - 50} more.</div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-2 text-sm font-medium text-foreground bg-muted/30">All rows</div>
                <div className="max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={cn(mono, "w-14")}>Row</TableHead>
                        <TableHead className={mono}>Student</TableHead>
                        <TableHead className={mono}>DOB</TableHead>
                        <TableHead className={mono}>Class</TableHead>
                        <TableHead className={mono}>Household</TableHead>
                        <TableHead className={mono}>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.rows.map((r) => (
                        <TableRow key={r.sheetRow} className={r.action === "error" ? "bg-red-50/50" : r.action === "duplicate" ? "bg-muted/40" : ""}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.sheetRow}</TableCell>
                          <TableCell className="font-medium">
                            {r.studentName}
                            {r.existingStudentCode && <span className="ml-1.5 text-[11px] font-mono text-muted-foreground">{r.existingStudentCode}</span>}
                            {r.duplicateOfRow && <div className="text-[11px] text-muted-foreground">Same student as row {r.duplicateOfRow}</div>}
                            {r.problems.length > 0 && <div className="text-[11px] text-red-700">{r.problems.join("; ")}</div>}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.dateOfBirth || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.className || "—"}
                            {r.classChange && (
                              <div className="text-[11px] text-blue-700 flex items-center gap-1">
                                {r.classChange.from || "no class"} <ArrowRight className="w-3 h-3" /> {r.classChange.to}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.householdName}</TableCell>
                          <TableCell><ActionBadge row={r} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── STEP 4 · RESULTS ─────────────── */}
          {step === "result" && result && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl bg-[#091426] text-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold">Import Complete</h3>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-6 text-sm">
                  <div className="flex justify-between"><dt className="text-white/60">Students processed</dt><dd className="tabular-nums">{result.processed}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Students created</dt><dd className="tabular-nums">{result.created}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Students updated</dt><dd className="tabular-nums">{result.updated}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Students skipped</dt><dd className="tabular-nums">{result.skipped}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Classes created</dt><dd className="tabular-nums">{result.classesCreated}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Students with errors</dt><dd className="tabular-nums">{result.errorCount}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Families created</dt><dd className="tabular-nums">{result.familiesCreated}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/60">Guardians added</dt><dd className="tabular-nums">{result.guardiansCreated}</dd></div>
                </dl>
                {result.createdClassNames.length > 0 && (
                  <div className="border-t border-white/10 mt-4 pt-3">
                    <div className="text-[10px] font-mono uppercase text-white/50 mb-1.5">Classes created automatically</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.createdClassNames.map((n) => (
                        <span key={n} className="text-xs bg-white/10 rounded px-2 py-0.5">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {result.failedRows.length > 0 && (
                <div className="rounded-xl border border-amber-200 overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {result.failedRows.length} row(s) were not imported
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={cn(mono, "w-16")}>Row</TableHead>
                        <TableHead className={mono}>Student</TableHead>
                        <TableHead className={mono}>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.failedRows.map((r) => (
                        <TableRow key={r.sheetRow}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.sheetRow}</TableCell>
                          <TableCell>{r.studentName}</TableCell>
                          <TableCell className="text-sm text-amber-800">{r.problem}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-3">
          {step === "upload" && (
            <Button variant="outline" onClick={() => reset(false)}>Cancel</Button>
          )}

          {step === "map" && (
            <>
              <Button variant="outline" onClick={() => reset()}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              <Button
                disabled={!analysis || analysis.missingRequiredFields.length > 0 || analyzeMutation.isPending}
                onClick={() => setStep("preview")}
              >
                {analyzeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Re-checking…</> : <>Preview Import <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => reset(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => setStep("map")}><ArrowLeft className="w-4 h-4 mr-2" /> Back to mapping</Button>
              <Button
                disabled={!analysis?.canImport || importable === 0 || commitMutation.isPending}
                onClick={() => commitMutation.mutate()}
              >
                {commitMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</>
                  : `Confirm Import (${importable} student${importable === 1 ? "" : "s"})`}
              </Button>
            </>
          )}

          {step === "result" && (
            <>
              <Button variant="outline" onClick={() => reset()}>Import Another Sheet</Button>
              <Button onClick={() => reset(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { CommitResult as StudentImportResult };
