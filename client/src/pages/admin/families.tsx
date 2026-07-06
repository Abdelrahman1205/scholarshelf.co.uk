import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, Link as LinkIcon, Copy, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── FAMILIES (master-detail redesign) ──────────────────────────────────────
function FamiliesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [addStudentId, setAddStudentId] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/admin/families"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/families", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); setAddOpen(false); setName(""); toast({ title: "Family created" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/families/${selectedFamily?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); setEditOpen(false); toast({ title: "Family renamed" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/families/${selectedFamily?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); setDeleteOpen(false); setDetailId(null); toast({ title: "Family deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addStudentMutation = useMutation({
    mutationFn: ({ familyId, studentId }: any) => apiRequest("PUT", `/api/admin/families/${familyId}/students/${studentId}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); setAddStudentOpen(false); setAddStudentId(""); toast({ title: "Student added to family" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ familyId, studentId }: any) => apiRequest("DELETE", `/api/admin/families/${familyId}/students/${studentId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); toast({ title: "Student removed" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const generateCodeMutation = useMutation({
    mutationFn: ({ familyId, parentEmail }: any) => apiRequest("POST", `/api/admin/families/${familyId}/link-code`, { parentEmail }),
    onSuccess: async (res) => {
      const data = await res.json();
      setGeneratedCode(data.code);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] });
      toast({ title: "Family link code generated" });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = families.filter((f: any) => !search || f.name?.toLowerCase().includes(search.toLowerCase()));
  const detail = families.find((f: any) => f.id === detailId) || null;
  const totalStudents = families.reduce((acc: number, f: any) => acc + (f.students || []).length, 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Families</h1>
          <p className="text-muted-foreground mt-1">Group siblings and generate a single family link code for parents.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Families</div><div className="text-xl font-bold text-foreground">{families.length}</div></div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center"><div className="text-[10px] font-mono uppercase text-muted-foreground">Grouped</div><div className="text-xl font-bold text-foreground">{totalStudents}</div></div>
          <Button onClick={() => { setName(""); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> New Family</Button>
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
                    <span className="font-medium text-foreground truncate">{family.name}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 ml-3">{(family.students || []).length} student{(family.students || []).length !== 1 ? "s" : ""}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          {!detail ? (
            <div className="text-center py-12"><Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select a family to manage members and link codes.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground text-lg">{detail.name}</div>
                  <div className="text-xs text-muted-foreground">{(detail.students || []).length} student{(detail.students || []).length !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" title="Rename" onClick={() => { setSelectedFamily(detail); setName(detail.name); setEditOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Delete" onClick={() => { setSelectedFamily(detail); setDeleteOpen(true); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Members</div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={() => { setSelectedFamily(detail); setAddStudentId(""); setAddStudentOpen(true); }}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {(detail.students || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No students yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.students.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                        <span className="font-medium text-foreground">{student.name}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-muted-foreground hover:text-destructive" onClick={() => removeStudentMutation.mutate({ familyId: detail.id, studentId: student.id })}><X className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button className="w-full" variant="outline" onClick={() => { setSelectedFamily(detail); setParentEmail(""); setGeneratedCode(null); setCopied(false); setCodeOpen(true); }}>
                <LinkIcon className="w-4 h-4 mr-2" /> Generate Family Link Code
              </Button>
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
              <Label>Family Name</Label>
              <Input placeholder="e.g. The Smith Family" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ name })} disabled={!name.trim() || createMutation.isPending}>
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
              <Label>Family Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ name })} disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add student to family */}
      <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Add Student to {selectedFamily?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Student</Label>
              <Select value={addStudentId} onValueChange={setAddStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students
                    .filter((s: any) => !(selectedFamily?.students || []).some((m: any) => m.id === s.id))
                    .map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addStudentMutation.mutate({ familyId: selectedFamily?.id, studentId: addStudentId })}
              disabled={!addStudentId || addStudentMutation.isPending}>
              {addStudentMutation.isPending ? "Adding..." : "Add to Family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate family link code */}
      <Dialog open={codeOpen} onOpenChange={(open) => { setCodeOpen(open); if (!open) setGeneratedCode(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Family Link Code — {selectedFamily?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {!generatedCode ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Generate a single code that links a parent to all {(selectedFamily?.students || []).length} children in this family at once.
                </p>
                <div className="grid gap-2">
                  <Label>Parent Email</Label>
                  <Input type="email" placeholder="parent@example.com" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Share this code with the parent. It links them to all children in this family.</p>
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <span className="font-mono text-xl font-bold tracking-widest flex-1 text-center">{generatedCode}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyCode(generatedCode!)}>
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="space-y-1">
                  {(selectedFamily?.students || []).map((s: any) => (
                    <div key={s.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-500" /> {s.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!generatedCode && (
            <DialogFooter>
              <Button
                onClick={() => generateCodeMutation.mutate({ familyId: selectedFamily?.id, parentEmail })}
                disabled={!parentEmail.trim() || generateCodeMutation.isPending}>
                {generateCodeMutation.isPending ? "Generating..." : "Generate Code"}
              </Button>
            </DialogFooter>
          )}
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
