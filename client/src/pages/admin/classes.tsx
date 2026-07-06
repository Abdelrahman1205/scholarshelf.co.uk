import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const YEAR_GROUP_OPTIONS = [
  "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13",
  "Reception", "Nursery", "Sixth Form",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

// ─── CLASSES — Class Management & Teacher Assignment (ScholarShelf design) ───
function ClassesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const emptyForm = { name: "", academicYear: "2026-2027", yearGroup: "", teacherId: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classBookLevels = [] } = useQuery<any[]>({ queryKey: ["/api/class-book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const teachers = users.filter((u: any) => u.role === "teacher");

  const studentCount = (classId: string) => students.filter((s: any) => s.classId === classId).length;
  const unassignedCount = classes.filter((c: any) => !c.teacherId).length;
  const coverage = classes.length ? Math.round(((classes.length - unassignedCount) / classes.length) * 100) : 0;
  const avgStudents = classes.length ? Math.round(students.length / classes.length) : 0;
  const activeBundles = new Set(classBookLevels.map((cbl: any) => cbl.bookLevelId || cbl.bookLevel?.id)).size;

  const buildPayload = (f: typeof emptyForm) => ({
    ...f,
    yearGroup: f.yearGroup === "none" || !f.yearGroup ? null : f.yearGroup,
    teacherId: f.teacherId === "none" || !f.teacherId ? null : f.teacherId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/classes", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setAddOpen(false); toast({ title: "Class created" }); setForm(emptyForm); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/classes/${selectedClass?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setEditOpen(false); toast({ title: "Class updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/classes/${selectedClass?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setDeleteOpen(false); toast({ title: "Class deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function exportCsv() {
    const rows = [["Class Name", "Year Group", "Academic Year", "Teacher", "Students"]];
    filtered.forEach((c: any) => rows.push([c.name, c.yearGroup || "", c.academicYear || "", users.find((u: any) => u.id === c.teacherId)?.name || "Unassigned", String(studentCount(c.id))]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "classes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const openEdit = (cls: any) => {
    setSelectedClass(cls);
    setForm({ name: cls.name || "", academicYear: cls.academicYear || "2026-2027", yearGroup: cls.yearGroup || "", teacherId: cls.teacherId || "none" });
    setEditOpen(true);
  };

  const yearGroups = Array.from(new Set(classes.map((c: any) => c.yearGroup).filter(Boolean))).sort((a: any, b: any) => {
    const ai = YEAR_GROUP_OPTIONS.indexOf(a); const bi = YEAR_GROUP_OPTIONS.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1; if (bi !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
  const filtered = classes.filter((c: any) => yearFilter === "all" || c.yearGroup === yearFilter);

  const FormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 3 Blue" /></div>
      <div className="grid gap-2">
        <Label>Year Group</Label>
        <Select value={form.yearGroup || "none"} onValueChange={(v) => setForm({ ...form, yearGroup: v })}>
          <SelectTrigger><SelectValue placeholder="Select year group (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No year group</SelectItem>
            {YEAR_GROUP_OPTIONS.map((yg) => <SelectItem key={yg} value={yg}>{yg}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2"><Label>Academic Year</Label><Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
      <div className="grid gap-2">
        <Label>Assigned Teacher</Label>
        <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
          <SelectTrigger><SelectValue placeholder="Select teacher (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No teacher assigned</SelectItem>
            {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const kpis = [
    { icon: "school", label: "Total Classes", value: String(classes.length), note: null, iconCls: "bg-secondary-container text-on-secondary-container" },
    { icon: "group", label: "Avg Students", value: String(avgStudents), note: "Target range: 20-30", iconCls: "bg-tertiary-fixed text-on-tertiary-fixed-variant" },
    { icon: "person_check", label: "Teacher Coverage", value: `${coverage}%`, note: unassignedCount > 0 ? `${unassignedCount} class${unassignedCount !== 1 ? "es" : ""} unassigned` : "All classes covered", warn: unassignedCount > 0, iconCls: unassignedCount > 0 ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container" },
    { icon: "inventory_2", label: "Active Bundles", value: String(activeBundles), note: "Standard Distribution", iconCls: "bg-surface-container-high text-muted-foreground" },
  ] as any[];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>School Data</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Classes</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Class Management</h1>
            <p className="text-muted-foreground mt-1">Manage academic class structures, teacher assignments, and student enrollment levels.</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
            <MaterialSymbol name="add" className="text-base mr-2" /> Create New Class
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg", k.iconCls)}>
                <MaterialSymbol name={k.icon} className="text-lg" />
              </span>
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground">{k.value}</div>
            {k.note && (
              <div className={cn("text-xs mt-0.5 flex items-center gap-1", k.warn ? "text-on-error-container" : "text-muted-foreground")}>
                {k.warn && <MaterialSymbol name="warning" className="text-sm" />}{k.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active classes table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MaterialSymbol name="list" className="text-lg text-muted-foreground" /> Active Classes
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Year Groups</SelectItem>
                {yearGroups.map((yg: any) => <SelectItem key={yg} value={yg}>{yg}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}><MaterialSymbol name="download" className="text-base mr-1.5" /> Export</Button>
          </div>
        </div>
        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MaterialSymbol name="school" className="text-5xl text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mt-3">No classes yet. Create your first class.</p>
            <Button className="mt-4" onClick={() => { setForm(emptyForm); setAddOpen(true); }}><MaterialSymbol name="add" className="text-base mr-2" /> Create New Class</Button>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-container-low">
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Class Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Year Group</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Assigned Teacher</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Students</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cls: any) => {
                  const teacher = users.find((u: any) => u.id === cls.teacherId);
                  const count = studentCount(cls.id);
                  return (
                    <tr key={cls.id} className="border-b border-border last:border-0 hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{cls.name}</div>
                        <div className="text-xs text-muted-foreground">{cls.academicYear || "—"}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {cls.yearGroup ? <Badge variant="secondary" className="text-xs">{cls.yearGroup}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {teacher ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold shrink-0">{initials(teacher.name || "?")}</span>
                            <span className="text-sm text-foreground">{teacher.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MaterialSymbol name="person_off" className="text-lg" />
                            <span className="text-sm italic">Unassigned</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{count}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", teacher ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container")}>
                          {teacher ? "Active" : "Setup"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-container hover:text-foreground transition-colors" aria-label="Edit class">
                          <MaterialSymbol name="edit" className="text-lg" />
                        </button>
                        <button onClick={() => { setSelectedClass(cls); setDeleteOpen(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:bg-error-container hover:text-on-error-container transition-colors" aria-label="Delete class">
                          <MaterialSymbol name="delete" className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {classes.length} classes
            </div>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Create New Class</DialogTitle></DialogHeader>
          {FormFields}
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(buildPayload(form))} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          {FormFields}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate(buildPayload(form))} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedClass?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { ClassesSection };
