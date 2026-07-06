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

const YEAR_GROUP_OPTIONS = [
  "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13",
  "Reception", "Nursery", "Sixth Form",
];

// ─── CLASSES ──────────────────────────────────────────────────────────────────
function ClassesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const emptyForm = { name: "", academicYear: "2026-2027", yearGroup: "", teacherId: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });
  const teachers = users.filter((u: any) => u.role === "teacher");

  // Group classes by year group for display
  const grouped: Record<string, any[]> = {};
  const noGroup: any[] = [];
  for (const cls of classes) {
    if (cls.yearGroup) {
      (grouped[cls.yearGroup] = grouped[cls.yearGroup] || []).push(cls);
    } else {
      noGroup.push(cls);
    }
  }
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    const ai = YEAR_GROUP_OPTIONS.indexOf(a);
    const bi = YEAR_GROUP_OPTIONS.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

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

  const ClassRow = ({ cls }: { cls: any }) => (
    <TableRow key={cls.id}>
      <TableCell className="font-medium">{cls.name}</TableCell>
      <TableCell>
        {cls.yearGroup
          ? <Badge variant="secondary" className="text-xs">{cls.yearGroup}</Badge>
          : <span className="text-muted-foreground text-sm">—</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">{cls.academicYear || "—"}</TableCell>
      <TableCell className="text-muted-foreground">{users.find((u: any) => u.id === cls.teacherId)?.name || "Not assigned"}</TableCell>
      <TableCell className="text-right space-x-1">
        <Button variant="ghost" size="sm" onClick={() => {
          setSelectedClass(cls);
          setForm({ name: cls.name || "", academicYear: cls.academicYear || "2026-2027", yearGroup: cls.yearGroup || "", teacherId: cls.teacherId || "none" });
          setEditOpen(true);
        }}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedClass(cls); setDeleteOpen(true); }}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  const FormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
        <Label>Teacher</Label>
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Classes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage school classes and teacher assignments.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Class
        </Button>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Year Group</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Academic Year</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Teacher</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No classes found. Add your first class above.</TableCell></TableRow>
            )}
            {sortedGroups.map((yg) => (
              <>
                <TableRow key={`group-${yg}`} className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={5} className="py-1.5 px-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{yg}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({grouped[yg].length} class{grouped[yg].length !== 1 ? "es" : ""})</span>
                  </TableCell>
                </TableRow>
                {grouped[yg].map((cls: any) => <ClassRow key={cls.id} cls={cls} />)}
              </>
            ))}
            {noGroup.map((cls: any) => <ClassRow key={cls.id} cls={cls} />)}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add New Class</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(buildPayload(form))} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate(buildPayload(form))} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
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

// ─── STUDENTS ──────────────────────────────────────────────────

export { ClassesSection };
