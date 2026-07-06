import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Plus, Upload, Users, GraduationCap, Key, QrCode,
  Pencil, Archive, RefreshCw, X, Layers, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";

// ─── STUDENTS (master-detail redesign) ──────────────────────────────────────
function StudentsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [detailStudent, setDetailStudent] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: "", classId: "", parentEmail: "" });
  const [barcodeStudent, setBarcodeStudent] = useState<any>(null);

  // Book level override
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStudent, setOverrideStudent] = useState<any>(null);
  const [overrideLevelId, setOverrideLevelId] = useState("");

  // CSV Import
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<{ rows: any[]; summary: any } | null>(null);
  const [importStep, setImportStep] = useState<"input" | "preview">("input");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c]));
  const { data: bookLevels = [] } = useQuery<any[]>({ queryKey: ["/api/book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: studentOverrides = [] } = useQuery<any[]>({ queryKey: ["/api/students/book-level-overrides"], queryFn: getQueryFn({ on401: "throw" }) });
  const overrideMap = Object.fromEntries(studentOverrides.map((o: any) => [o.studentId, o]));

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
          toast({ title: "Student added", description: "Couldn't send parent invite — resend from Parent Invites.", variant: "destructive" });
        }
      } else {
        toast({ title: "Student added" });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/students/${selectedStudent?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setEditOpen(false); toast({ title: "Student updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/students/${selectedStudent?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setDeleteOpen(false); setDetailStudent(null); toast({ title: "Student archived", description: "Records preserved. Restore from the Archived view." }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/students/${id}/unarchive`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); toast({ title: "Student restored" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const previewImportMutation = useMutation({
    mutationFn: async (csv: string) => { const res = await apiRequest("POST", "/api/students/import/preview", { csv }); return res.json(); },
    onSuccess: (data: any) => { setImportPreview(data); setImportStep("preview"); },
    onError: (err: any) => toast({ title: "Import preview failed", description: err.message, variant: "destructive" }),
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (rows: any[]) => { const res = await apiRequest("POST", "/api/students/import/confirm", { rows }); return res.json(); },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setImportOpen(false); setImportStep("input"); setCsvText(""); setImportPreview(null);
      const inviteMsg = data.invitesSent > 0 ? ` · ${data.invitesSent} parent invite${data.invitesSent !== 1 ? "s" : ""} sent` : "";
      const skipMsg = data.errors?.length ? ` · ${data.errors.length} row(s) skipped` : "";
      toast({ title: `Imported ${data.created} student${data.created !== 1 ? "s" : ""}`, description: `${inviteMsg}${skipMsg}`.trim().replace(/^·\s*/, "") || undefined });
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const setOverrideMutation = useMutation({
    mutationFn: async ({ studentId, bookLevelId }: { studentId: string; bookLevelId: string }) => {
      const res = await apiRequest("PUT", "/api/students/" + studentId + "/book-level-override", { bookLevelId });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students/book-level-overrides"] }); setOverrideOpen(false); toast({ title: "Book level override saved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clearOverrideMutation = useMutation({
    mutationFn: async (studentId: string) => { await apiRequest("DELETE", "/api/students/" + studentId + "/book-level-override"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students/book-level-overrides"] }); setOverrideOpen(false); toast({ title: "Override cleared — reverted to class default" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activeStudents = students.filter((s: any) => !s.isArchived);
  const archivedStudents = students.filter((s: any) => s.isArchived);
  const displayStudents = showArchived ? archivedStudents : activeStudents;
  const filtered = displayStudents.filter((s: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q);
    const matchesClass = classFilter === "all" || s.classId === classFilter;
    return matchesSearch && matchesClass;
  });

  const initials = (name?: string) => (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const openOverride = (student: any) => { setOverrideStudent(student); setOverrideLevelId(overrideMap[student.id]?.bookLevelId || ""); setOverrideOpen(true); };
  const detailLevel = detailStudent ? overrideMap[detailStudent.id] : null;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>School Data</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Students</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Student Management</h1>
            <p className="text-muted-foreground mt-1">Manage enrolments, assign classes, and track parent connections.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportStep("input"); setCsvText(""); setImportPreview(null); setImportOpen(true); }}>
              <MaterialSymbol name="upload_file" className="text-base mr-2" /> Import CSV
            </Button>
            <Button onClick={() => { setForm({ name: "", classId: "", parentEmail: "" }); setAddOpen(true); }}>
              <MaterialSymbol name="person_add" className="text-base mr-2" /> Add Student
            </Button>
          </div>
        </div>
      </div>

      {/* Roster stats strip — design: Active Roster / Unassigned / View Archive */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">{activeStudents.length.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Active Roster</span>
        </div>
        <div className="w-px h-6 bg-border hidden sm:block" />
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">{activeStudents.filter((s: any) => !s.classId).length}</span>
          <span className="text-xs text-muted-foreground">Unassigned</span>
        </div>
        <div className="w-px h-6 bg-border hidden sm:block" />
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">{Object.keys(overrideMap).length}</span>
          <span className="text-xs text-muted-foreground">Bundle Overrides</span>
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
            showArchived ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-container-low",
          )}
        >
          <MaterialSymbol name="archive" className="text-sm" /> {showArchived ? `Viewing Archive (${archivedStudents.length})` : `View Archive (${archivedStudents.length})`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-4">
        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Filters</h2>
            <button onClick={() => { setSearch(""); setClassFilter("all"); setShowArchived(false); }} className="text-xs text-primary hover:underline">Reset</button>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Quick Find</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Name or code…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Class / Grade</div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Status</div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button onClick={() => setShowArchived(false)} className={cn("flex-1 text-xs rounded-md py-1.5 font-medium transition", !showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>Active ({activeStudents.length})</button>
              <button onClick={() => setShowArchived(true)} className={cn("flex-1 text-xs rounded-md py-1.5 font-medium transition", showArchived ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>Archived ({archivedStudents.length})</button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <span className="text-sm"><strong className="text-foreground">{filtered.length}</strong> <span className="text-muted-foreground">student{filtered.length !== 1 ? "s" : ""}</span></span>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Student</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">ID / Ref</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10">No students found.</TableCell></TableRow>
                ) : filtered.map((s: any) => (
                  <TableRow key={s.id} onClick={() => setDetailStudent(s)} className={cn("cursor-pointer", detailStudent?.id === s.id && "bg-primary/5")}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">{initials(s.name)}</div>
                        <span className="font-medium text-foreground">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.studentCode || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{classMap[s.classId]?.name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          {!detailStudent ? (
            <div className="text-center py-12">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Select a student to see details.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">{initials(detailStudent.name)}</div>
                  <div>
                    <div className="font-semibold text-foreground">{detailStudent.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{detailStudent.studentCode || "—"} · {classMap[detailStudent.classId]?.name || "No class"}</div>
                  </div>
                </div>
                <button onClick={() => setDetailStudent(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              {/* Bundle Override — design: dynamic_form panel */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2.5 bg-surface-container-low border-b border-border flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <MaterialSymbol name="dynamic_form" className="text-sm" /> Bundle Override
                  </span>
                  {detailLevel && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">Manual Override Active</span>
                  )}
                </div>
                <div className="px-3 py-2.5 space-y-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">Assigned Bundle</div>
                    <div className="text-sm text-foreground font-medium mt-0.5">
                      {detailLevel
                        ? bookLevels.find((l: any) => l.id === detailLevel.bookLevelId)?.name || "Override set"
                        : "Class default"}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full justify-center" onClick={() => openOverride(detailStudent)}>
                    <MaterialSymbol name="edit" className="text-base mr-1.5" /> Update Assignment
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setBarcodeStudent(detailStudent)}>
                  <QrCode className="w-4 h-4 mr-2" /> View barcode
                </Button>
                {!showArchived ? (
                  <>
                    <Button variant="outline" size="sm" className="justify-start" onClick={() => { setSelectedStudent(detailStudent); setForm({ name: detailStudent.name || "", classId: detailStudent.classId || "", parentEmail: "" }); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit student
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start text-destructive hover:text-destructive" onClick={() => { setSelectedStudent(detailStudent); setDeleteOpen(true); }}>
                      <Archive className="w-4 h-4 mr-2" /> Archive student
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => unarchiveMutation.mutate(detailStudent.id)}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Restore student
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student</DialogTitle><DialogDescription>Enrol a student and optionally invite their parent.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Parent email <span className="text-muted-foreground font-normal">(optional — sends invite)</span></Label><Input type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} placeholder="parent@example.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || !form.classId || createMutation.isPending}>{createMutation.isPending ? "Adding…" : "Add student"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ name: form.name, classId: form.classId })} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedStudent?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The student is soft-removed but their payment and allocation history is preserved. You can restore them from the Archived view.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{archiveMutation.isPending ? "Archiving…" : "Archive"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MaterialSymbol name="dynamic_form" className="text-xl text-on-secondary-container" /> Bundle Override — {overrideStudent?.name}</DialogTitle>
            <DialogDescription>Override the class default with a specific target curriculum bundle for this student.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Target Curriculum Level</Label>
            <Select value={overrideLevelId} onValueChange={setOverrideLevelId}>
              <SelectTrigger><SelectValue placeholder="Select a bundle…" /></SelectTrigger>
              <SelectContent>{bookLevels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            {overrideStudent && overrideMap[overrideStudent.id] && (
              <div className="rounded-lg bg-secondary-container/40 border border-secondary-container p-2.5 flex gap-2 text-xs text-on-secondary-container mt-1">
                <MaterialSymbol name="info" className="text-base shrink-0" />
                <span>A manual override is currently active for this student. Clearing it reverts to the class default bundle.</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {overrideStudent && overrideMap[overrideStudent.id] && (
              <Button variant="outline" className="mr-auto text-destructive hover:text-destructive" onClick={() => clearOverrideMutation.mutate(overrideStudent.id)}>Clear override</Button>
            )}
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button disabled={!overrideLevelId || setOverrideMutation.isPending} onClick={() => setOverrideMutation.mutate({ studentId: overrideStudent.id, bookLevelId: overrideLevelId })}>Save override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode dialog */}
      <Dialog open={!!barcodeStudent} onOpenChange={(o) => { if (!o) setBarcodeStudent(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{barcodeStudent?.name}</DialogTitle><DialogDescription className="font-mono">{barcodeStudent?.studentCode}</DialogDescription></DialogHeader>
          <div className="flex justify-center py-4">
            {barcodeStudent?.studentCode ? <BarcodeDisplay value={barcodeStudent.studentCode} /> : <p className="text-sm text-muted-foreground">No code assigned.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Students</DialogTitle>
            <DialogDescription>Upload a CSV/XLSX or paste rows. Include a <span className="font-mono">parent_email</span> column to auto-send invites.</DialogDescription>
          </DialogHeader>
          {importStep === "input" ? (
            <div className="space-y-3 py-2">
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
                        setCsvText(XLSX.utils.sheet_to_csv(ws));
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors py-8 flex flex-col items-center justify-center gap-2 text-center"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">Click to upload a CSV or XLSX file</div>
                  <div className="text-xs text-muted-foreground">Include a <span className="font-mono">parent_email</span> column to auto-send invites</div>
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or paste rows below<div className="h-px flex-1 bg-border" /></div>
              <Textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="name,class,parent_email&#10;Amelia Carter,Year 7,parent@example.com" className="font-mono text-xs" />
            </div>
          ) : (
            <div className="py-2 max-h-[50vh] overflow-auto">
              {importPreview?.summary && (
                <div className="flex gap-3 text-sm mb-3">
                  <span className="text-emerald-700"><CheckCircle2 className="w-4 h-4 inline mr-1" />{importPreview.rows.filter((r: any) => r.valid).length} valid</span>
                  {importPreview.rows.some((r: any) => !r.valid) && <span className="text-amber-700"><AlertTriangle className="w-4 h-4 inline mr-1" />{importPreview.rows.filter((r: any) => !r.valid).length} with issues</span>}
                </div>
              )}
              <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Class</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Parent email</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {importPreview?.rows.map((row: any, i: number) => (
                    <TableRow key={i} className={row.valid ? "" : "bg-amber-50"}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.className || row.classId || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{row.parentEmail || <span className="italic text-muted-foreground/50">none</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            {importStep === "input" ? (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button disabled={!csvText.trim() || previewImportMutation.isPending} onClick={() => previewImportMutation.mutate(csvText)}>{previewImportMutation.isPending ? "Checking…" : "Preview"}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportStep("input")}>Back</Button>
                <Button disabled={confirmImportMutation.isPending} onClick={() => confirmImportMutation.mutate(importPreview!.rows.filter((r: any) => r.valid))}>{confirmImportMutation.isPending ? "Importing…" : "Confirm import"}</Button>
              </>
            )}
          </DialogFooter>
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

export { StudentsSection, BarcodeDisplay };
