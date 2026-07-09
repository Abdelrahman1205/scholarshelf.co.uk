import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, Search, UserPlus, GraduationCap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { navigateTo } from "./shared";

// ─── FAMILIES (master-detail redesign) ──────────────────────────────────────
function FamiliesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addGuardianOpen, setAddGuardianOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [studentForm, setStudentForm] = useState({ fullName: "", dateOfBirth: "", gradeLevel: "", classId: "", preferredReadingLevel: "" });
  const [guardianForm, setGuardianForm] = useState({ fullName: "", relationship: "Guardian", email: "", phone: "", isPrimaryContact: false });

  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/families"], queryFn: getQueryFn({ on401: "throw" }) });
  const detailQuery = useQuery<any>({
    queryKey: ["/api/families", detailId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!detailId,
  });
  const detail = detailQuery.data || null;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/families", data),
    onSuccess: async (res) => {
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      setAddOpen(false);
      setName("");
      setDetailId(created.id);
      toast({ title: "Family created" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/families/${selectedFamily?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      if (selectedFamily?.id) queryClient.invalidateQueries({ queryKey: ["/api/families", selectedFamily.id] });
      setEditOpen(false);
      toast({ title: "Family updated" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/families/${selectedFamily?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/families"] }); setDeleteOpen(false); setDetailId(null); toast({ title: "Family deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addStudentMutation = useMutation({
    mutationFn: ({ familyId, data }: any) => apiRequest("POST", `/api/families/${familyId}/students`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/families", detailId] });
      setAddStudentOpen(false);
      setStudentForm({ fullName: "", dateOfBirth: "", gradeLevel: "", classId: "", preferredReadingLevel: "" });
      toast({ title: "Student added" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addGuardianMutation = useMutation({
    mutationFn: ({ familyId, data }: any) => apiRequest("POST", `/api/families/${familyId}/guardians`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/families", detailId] });
      setAddGuardianOpen(false);
      setGuardianForm({ fullName: "", relationship: "Guardian", email: "", phone: "", isPrimaryContact: false });
      toast({ title: "Guardian added" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeGuardianMutation = useMutation({
    mutationFn: (guardianId: string) => apiRequest("DELETE", `/api/guardians/${guardianId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/families", detailId] });
      toast({ title: "Guardian removed" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const archiveStudentMutation = useMutation({
    mutationFn: (studentId: string) => apiRequest("DELETE", `/api/students/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: ["/api/families", detailId] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student archived" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const filtered = families.filter((f: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [f.householdName, f.name, f.familyCode, f.primaryEmail, f.primaryPhone].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const totalStudents = families.reduce((acc: number, f: any) => acc + (f.studentCount || 0), 0);
  const totalGuardians = families.reduce((acc: number, f: any) => acc + (f.guardianCount || 0), 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Families</h1>
          <p className="text-muted-foreground mt-1">Household-first records with linked guardians and students.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Families</div><div className="text-xl font-bold text-foreground">{families.length}</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Guardians</div><div className="text-xl font-bold text-foreground">{totalGuardians}</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Students</div><div className="text-xl font-bold text-foreground">{totalStudents}</div></div>
          <Button variant="outline" onClick={() => navigateTo("/admin/family-enroll")}><UserPlus className="w-4 h-4 mr-2" /> New Family Enrollment</Button>
          <Button onClick={() => { setName(""); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Create Family</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* List */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search families…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{families.length === 0 ? "No families yet. Create one to group siblings and generate a shared link code." : "No matching families."}</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((family: any) => (
                <button key={family.id} onClick={() => setDetailId(family.id)} className={cn("w-full text-left flex items-center justify-between px-5 py-3 hover:bg-muted/20", detailId === family.id && "bg-primary/5")}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Users className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{family.householdName || family.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{family.familyCode || "No code"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="secondary">{family.guardianCount || 0} guardian{(family.guardianCount || 0) !== 1 ? "s" : ""}</Badge>
                    <Badge variant="secondary">{family.studentCount || 0} student{(family.studentCount || 0) !== 1 ? "s" : ""}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          {!detail ? (
            <div className="text-center py-12"><Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select a family to manage members and link codes.</p></div>
          ) : detailQuery.isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Loading family profile…</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground text-lg">{detail.householdName || detail.name}</div>
                  <div className="text-xs text-muted-foreground">{detail.familyCode || "No family code"}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title="Rename" onClick={() => { setSelectedFamily(detail); setName(detail.householdName || detail.name); setEditOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Delete" onClick={() => { setSelectedFamily(detail); setDeleteOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Parents / Guardians</div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => { setSelectedFamily(detail); setAddGuardianOpen(true); }}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {(detail.guardians || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No guardians linked yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.guardians.map((guardian: any) => (
                      <div key={guardian.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                        <div>
                          <div className="font-medium text-foreground">{guardian.fullName}</div>
                          <div className="text-xs text-muted-foreground">{guardian.relationship || "Guardian"} • {guardian.email || guardian.phone || "No contact"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {guardian.isPrimaryContact && <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Primary</Badge>}
                          <Button variant="ghost" size="sm" className="h-6 text-muted-foreground hover:text-destructive" onClick={() => removeGuardianMutation.mutate(guardian.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Students in this Family</div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => { setSelectedFamily(detail); setAddStudentOpen(true); }}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {(detail.students || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No students linked yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.students.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                        <div>
                          <div className="font-medium text-foreground">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.studentCode || "No student code"} • {student.gradeLevel || "Grade not set"}</div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground hover:text-destructive" onClick={() => archiveStudentMutation.mutate(student.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground/90 text-[11px]">Family Profile Actions</div>
                <div>Open student profile via global search for class placement, book allocations, order status, and reading progress.</div>
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigateTo("/admin/family-enroll")}>Use New Family Enrollment for step-by-step intake</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create family */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>New Family</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Family / Household Name</Label>
              <Input placeholder="e.g. The Smith Household" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ householdName: name })} disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename family */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Rename Family</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Family / Household Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ householdName: name })} disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add guardian */}
      <Dialog open={addGuardianOpen} onOpenChange={setAddGuardianOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Add Guardian</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={guardianForm.fullName} onChange={(e) => setGuardianForm({ ...guardianForm, fullName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Relationship</Label>
                <Input value={guardianForm.relationship} onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={guardianForm.phone} onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={guardianForm.email} onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })} />
            </div>
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <input type="checkbox" checked={guardianForm.isPrimaryContact} onChange={(e) => setGuardianForm({ ...guardianForm, isPrimaryContact: e.target.checked })} />
              Primary Contact
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addGuardianMutation.mutate({ familyId: selectedFamily?.id, data: guardianForm })}
              disabled={!guardianForm.fullName.trim() || (!guardianForm.email.trim() && !guardianForm.phone.trim()) || addGuardianMutation.isPending}
            >
              {addGuardianMutation.isPending ? "Adding..." : "Add Guardian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add student to family */}
      <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Add Student to {selectedFamily?.householdName || selectedFamily?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={studentForm.fullName} onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={studentForm.dateOfBirth} onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Grade Level</Label>
                <Input placeholder="e.g. Grade 4" value={studentForm.gradeLevel} onChange={(e) => setStudentForm({ ...studentForm, gradeLevel: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Class ID (optional)</Label>
                <Input value={studentForm.classId} onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Reading Level (optional)</Label>
                <Input value={studentForm.preferredReadingLevel} onChange={(e) => setStudentForm({ ...studentForm, preferredReadingLevel: e.target.value })} />
              </div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Student ID is auto-generated on save.</div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addStudentMutation.mutate({ familyId: selectedFamily?.id, data: studentForm })}
              disabled={!studentForm.fullName.trim() || !studentForm.dateOfBirth.trim() || !studentForm.gradeLevel.trim() || addStudentMutation.isPending}
            >
              {addStudentMutation.isPending ? "Adding..." : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Family</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedFamily?.name}"? Students will not be deleted.</AlertDialogDescription>
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

export { FamiliesSection };
