import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus,
  Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight,
  QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users,
  Package, TrendingUp, TrendingDown, ClipboardList, CheckCircle2, Clock,
  XCircle, Eye, History, BarChart2, Settings, MessageSquare, ArrowLeft,
  Archive, RefreshCw, Printer, ShieldAlert, ShieldOff, Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  navigateTo, formatSchoolDisplay, StatusBadge, formatDateTime,
  normalizeRole, roleLabel, isProtectedPlatformOwner, BRANDING_PERMISSION_OPTIONS
} from "./shared";

import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";
// ─── STUDENTS ─────────────────────────────────────────────────────────────────
function StudentsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: "", classId: "", parentEmail: "" });

  // CSV Import state
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<{ rows: any[]; summary: any } | null>(null);
  const [importStep, setImportStep] = useState<"input" | "preview">("input");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c]));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/students", { name: data.name, classId: data.classId });
      return { student: await res.json(), parentEmail: data.parentEmail };
    },
    onSuccess: async ({ student, parentEmail }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setAddOpen(false);
      setForm({ name: "", classId: "", parentEmail: "" });
      if (parentEmail?.trim() && student?.id) {
        try {
          await apiRequest("POST", `/api/students/${student.id}/linking-code`, { parentEmail: parentEmail.trim() });
          toast({ title: "Student added", description: "Invite sent to parent's email." });
        } catch {
          toast({ title: "Student added", description: "Couldn't send parent invite — try resending from Linking Codes.", variant: "destructive" });
        }
      } else {
        toast({ title: "Student added" });
      }
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/students/${selectedStudent?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setEditOpen(false); toast({ title: "Student updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  // Archive (soft-delete) — preserves payment/allocation history
  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/students/${selectedStudent?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setDeleteOpen(false); toast({ title: "Student archived", description: "Records preserved. Restore from Archived tab if needed." }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/students/${id}/unarchive`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); toast({ title: "Student restored" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const previewImportMutation = useMutation({
    mutationFn: async (csv: string) => { const res = await apiRequest("POST", "/api/students/import/preview", { csv }); return res.json(); },
    onSuccess: (data: any) => { setImportPreview(data); setImportStep("preview"); },
    onError: (err: any) => { toast({ title: "Import preview failed", description: err.message, variant: "destructive" }); },
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (rows: any[]) => { const res = await apiRequest("POST", "/api/students/import/confirm", { rows }); return res.json(); },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setImportOpen(false);
      setImportStep("input");
      setCsvText("");
      setImportPreview(null);
      const inviteMsg = data.invitesSent > 0 ? ` · ${data.invitesSent} parent invite${data.invitesSent !== 1 ? "s" : ""} sent` : "";
      const skipMsg = data.errors?.length ? ` · ${data.errors.length} row(s) skipped` : "";
      toast({ title: `Imported ${data.created} student${data.created !== 1 ? "s" : ""}`, description: `${inviteMsg}${skipMsg}`.trim().replace(/^·\s*/, "") || undefined });
    },
    onError: (err: any) => { toast({ title: "Import failed", description: err.message, variant: "destructive" }); },
  });

  const activeStudents = students.filter((s: any) => !s.isArchived);
  const archivedStudents = students.filter((s: any) => s.isArchived);
  const displayStudents = showArchived ? archivedStudents : activeStudents;

  const filtered = displayStudents.filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student records and class assignments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setImportStep("input"); setCsvText(""); setImportPreview(null); setImportOpen(true); }}>
            Import CSV
          </Button>
          <Button onClick={() => { setForm({ name: "", classId: "", parentEmail: "" }); setAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Student
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search students..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Active Students" : `Archived (${archivedStudents.length})`}
        </Button>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Student Code</TableHead>
              <TableHead>Class</TableHead>
              {showArchived && <TableHead>Archived</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((student: any) => (
              <TableRow key={student.id} className={student.isArchived ? "opacity-60" : ""}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">{student.studentCode || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{classMap[student.classId]?.name || "—"}</TableCell>
                {showArchived && <TableCell className="text-muted-foreground text-sm">{student.archivedAt ? new Date(student.archivedAt).toLocaleDateString() : "—"}</TableCell>}
                <TableCell className="text-right space-x-1">
                  {student.isArchived ? (
                    <Button variant="outline" size="sm" onClick={() => unarchiveMutation.mutate(student.id)} disabled={unarchiveMutation.isPending}>
                      Restore
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(student); setForm({ name: student.name || "", classId: student.classId || "", parentEmail: "" }); setEditOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedStudent(student); setDeleteOpen(true); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={showArchived ? 5 : 4} className="text-center text-muted-foreground py-8">{search ? "No matching students" : showArchived ? "No archived students." : "No students yet. Add your first student above."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>{classes.map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
            <div className="grid gap-2">
              <Label>Parent Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} placeholder="parent@example.com" />
              <p className="text-xs text-muted-foreground">If provided, an invite email with the linking code is sent automatically.</p>
            </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add Student"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>{classes.map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Student</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedStudent?.name}" will be archived. Their payment and allocation records are preserved and the student can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Archive Student</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportStep("input"); setImportPreview(null); } }}>
        <DialogContent className="sm:max-w-[600px]">
          {importStep === "input" ? (
            <>
              <DialogHeader>
                <DialogTitle>Import Students from CSV</DialogTitle>
                <DialogDescription>
                  Paste a CSV with columns: <code className="font-mono text-xs bg-muted px-1 rounded">name</code>, <code className="font-mono text-xs bg-muted px-1 rounded">class</code> (optional), <code className="font-mono text-xs bg-muted px-1 rounded">parent_email</code> (optional — auto-sends invite). First row must be headers.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* File upload */}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
                      const reader = new FileReader();
                      if (isExcel) {
                        reader.onload = (ev) => {
                          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
                          const wb = XLSX.read(data, { type: "array" });
                          const ws = wb.Sheets[wb.SheetNames[0]];
                          const csv = XLSX.utils.sheet_to_csv(ws);
                          setCsvText(csv);
                        };
                        reader.readAsArrayBuffer(file);
                      } else {
                        reader.onload = (ev) => {
                          let text = ev.target?.result as string;
                          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                          setCsvText(text);
                        };
                        reader.readAsText(file, "utf-8");
                      }
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" className="w-full" type="button" onClick={() => fileInputRef.current?.click()}>
                    <Download className="w-4 h-4 mr-2" /> Upload CSV or Excel file
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 h-px bg-border" />
                  <span>or paste CSV below</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2">name,class,parent_email{"\n"}Alice Smith,Year 7A,mum@example.com{"\n"}Bob Jones,Year 7B,</p>
                <textarea
                  className="w-full min-h-[120px] border border-border rounded-md p-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={"name,class,parent_email\nAlice Smith,Year 7A,mum@example.com\nBob Jones,Year 7B,"}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button onClick={() => previewImportMutation.mutate(csvText)} disabled={previewImportMutation.isPending || !csvText.trim()}>
                  {previewImportMutation.isPending ? "Parsing..." : "Preview Import"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Import</DialogTitle>
                <DialogDescription>
                  {importPreview?.summary.valid} of {importPreview?.summary.total} rows are valid and will be created.
                  {importPreview?.summary.withEmail > 0 && ` ${importPreview?.summary.withEmail} parent invite${importPreview?.summary.withEmail !== 1 ? "s" : ""} will be sent automatically.`}
                  {importPreview?.summary.invalid > 0 && ` ${importPreview?.summary.invalid} row(s) have errors and will be skipped.`}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Parent Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview?.rows.map((row: any, i: number) => (
                      <TableRow key={i} className={row.error ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{row.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.className || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.parentEmail || <span className="italic text-muted-foreground/50">none</span>}</TableCell>
                        <TableCell>
                          {row.error
                            ? <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">{row.error}</Badge>
                            : <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep("input")}>Back</Button>
                <Button
                  onClick={() => confirmImportMutation.mutate(importPreview?.rows.filter((r: any) => !r.error) ?? [])}
                  disabled={confirmImportMutation.isPending || (importPreview?.summary.valid ?? 0) === 0}
                >
                  {confirmImportMutation.isPending ? "Importing..." : `Import ${importPreview?.summary.valid} Students`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── BARCODE RENDERER ──────────────────────────────────────────
function BarcodeDisplay({ value, width = 2, height = 80 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, { format: "CODE128", width, height, displayValue: false, margin: 10 });
      } catch (e) {
        console.error("JsBarcode render error:", e);
      }
    }
  }, [value, width, height]);
  return <svg ref={svgRef} />;
}

// ─── BOOKS ─────────────────────────────────────────────────────

export { StudentsSection, BarcodeDisplay };
