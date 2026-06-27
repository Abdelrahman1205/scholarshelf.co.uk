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
// ─── STUDENTS ─────────────────────────────────────────────────────────────────
function StudentsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ name: "", classId: "" });

  // CSV Import state
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<{ rows: any[]; summary: any } | null>(null);
  const [importStep, setImportStep] = useState<"input" | "preview">("input");

  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c]));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/students", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setAddOpen(false); setForm({ name: "", classId: "" }); toast({ title: "Student added" }); },
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
    mutationFn: (csv: string) => apiRequest("POST", "/api/students/import/preview", { csv }),
    onSuccess: (data: any) => { setImportPreview(data); setImportStep("preview"); },
    onError: (err: any) => { toast({ title: "Import preview failed", description: err.message, variant: "destructive" }); },
  });

  const confirmImportMutation = useMutation({
    mutationFn: (rows: any[]) => apiRequest("POST", "/api/students/import/confirm", { rows }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setImportOpen(false);
      setImportStep("input");
      setCsvText("");
      setImportPreview(null);
      toast({ title: `Imported ${data.created} student${data.created !== 1 ? "s" : ""}`, description: data.errors?.length ? `${data.errors.length} row(s) skipped` : undefined });
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
          <Button onClick={() => { setForm({ name: "", classId: "" }); setAddOpen(true); }}>
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(student); setForm({ name: student.name || "", classId: student.classId || "" }); setEditOpen(true); }}>
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
                  Paste a CSV with a <code className="font-mono text-xs bg-muted px-1 rounded">name</code> column and optional <code className="font-mono text-xs bg-muted px-1 rounded">class</code> column. First row must be headers.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2">name,class{"\n"}Alice Smith,Year 7A{"\n"}Bob Jones,Year 7B</p>
                <textarea
                  className="w-full min-h-[160px] border border-border rounded-md p-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={"name,class\nAlice Smith,Year 7A\nBob Jones,Year 7B"}
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
                  {importPreview?.summary.invalid > 0 && ` ${importPreview?.summary.invalid} row(s) have errors and will be skipped.`}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview?.rows.map((row: any, i: number) => (
                      <TableRow key={i} className={row.error ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{row.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.className || "—"}</TableCell>
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
