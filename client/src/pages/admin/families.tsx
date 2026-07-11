import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, Search, UserPlus, AlertTriangle, ArrowRight, ChevronDown, ChevronUp, GraduationCap, Phone, Mail, BookOpen, Loader2 } from "lucide-react";
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

      {/* ── Accordion list ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search families…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {families.length === 0 ? "No families yet. Use New Family Enrollment to get started." : "No matching families."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((family: any) => {
              const isOpen = detailId === family.id;
              const isLoading = isOpen && detailQuery.isLoading;
              const fDetail = isOpen ? (detailQuery.data || null) : null;

              return (
                <div key={family.id}>
                  {/* ── Header row (click to toggle) ── */}
                  <button
                    className={cn("w-full text-left flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors", isOpen && "bg-primary/5")}
                    onClick={() => setDetailId(isOpen ? null : family.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-semibold text-sm">
                        {(family.householdName || family.name || "F").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{family.householdName || family.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{family.familyCode || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant="secondary">{family.guardianCount || 0} guardian{(family.guardianCount || 0) !== 1 ? "s" : ""}</Badge>
                      <Badge variant="secondary">{family.studentCount || 0} student{(family.studentCount || 0) !== 1 ? "s" : ""}</Badge>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* ── Expanded accordion body ── */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/10 px-5 py-4 space-y-5">
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading family details…
                        </div>
                      ) : fDetail ? (
                        <>
                          {/* Family actions bar */}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {fDetail.primaryEmail && <span className="inline-flex items-center gap-1 mr-3"><Mail className="w-3 h-3" />{fDetail.primaryEmail}</span>}
                              {fDetail.primaryPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{fDetail.primaryPhone}</span>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedFamily(fDetail); setName(fDetail.householdName || fDetail.name); setEditOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Rename
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedFamily(fDetail); setDeleteOpen(true); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* ── Guardians ── */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground font-semibold">Parents / Guardians</div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => { setSelectedFamily(fDetail); setAddGuardianOpen(true); }}>
                                <Plus className="w-3 h-3 mr-1" /> Add Guardian
                              </Button>
                            </div>
                            {(fDetail.guardians || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No guardians linked yet.</p>
                            ) : (
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {fDetail.guardians.map((g: any) => (
                                  <div key={g.id} className="rounded-xl border border-border bg-card p-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-medium text-sm text-foreground truncate">{g.fullName}</span>
                                        {g.isPrimaryContact && <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 py-0 h-4">Primary</Badge>}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">{g.relationship || "Guardian"}</div>
                                      {g.email && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{g.email}</div>}
                                      {g.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{g.phone}</div>}
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeGuardianMutation.mutate(g.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ── Students ── */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground font-semibold">Students in this Family</div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => { setSelectedFamily(fDetail); setAddStudentOpen(true); }}>
                                <Plus className="w-3 h-3 mr-1" /> Add Student
                              </Button>
                            </div>
                            {(fDetail.students || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No students linked yet.</p>
                            ) : (
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {fDetail.students.map((s: any) => (
                                  <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                    {/* Student card header */}
                                    <div className="bg-primary/5 px-3 py-2 flex items-center justify-between border-b border-border">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                                          {(s.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                        </div>
                                        <button
                                          className="font-semibold text-sm text-foreground hover:text-primary flex items-center gap-1 group truncate"
                                          onClick={() => navigateTo(`/admin/students?open=${s.id}`)}
                                          title="Open full student profile"
                                        >
                                          {s.name}
                                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </button>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => archiveStudentMutation.mutate(s.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                    {/* Student card body */}
                                    <div className="px-3 py-2 space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Student ID</span>
                                        <span className="font-mono text-foreground">{s.studentCode || "—"}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Date of Birth</span>
                                        <span className="text-foreground">{s.dateOfBirth || "—"}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Gender</span>
                                        <span className="text-foreground">{s.gender || "—"}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Grade Level</span>
                                        <span className="text-foreground font-medium">{s.gradeLevel || "—"}</span>
                                      </div>
                                      {s.preferredReadingLevel && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" /> Reading Level</span>
                                          <span className="text-foreground">{s.preferredReadingLevel}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
