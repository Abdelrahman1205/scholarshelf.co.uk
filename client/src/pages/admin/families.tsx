import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Users, Link as LinkIcon, Copy, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── FAMILIES ──────────────────────────────────────────────────────────────
function FamiliesSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [name, setName] = useState("");
  const [addStudentId, setAddStudentId] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);

  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/admin/families"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const unlinkedStudents = (studentId: string) => {
    const family = families.find((f: any) => f.id === selectedFamily?.id);
    const memberIds = new Set((family?.students || []).map((s: any) => s.id));
    return students.filter((s: any) => s.id === studentId || !memberIds.has(s.id));
  };

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/families"] }); setDeleteOpen(false); toast({ title: "Family deleted" }); },
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

  const toggleExpand = (id: string) => setExpandedFamilyId(expandedFamilyId === id ? null : id);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Families</h1>
          <p className="text-muted-foreground text-sm mt-1">Group siblings and generate a single family link code for parents.</p>
        </div>
        <Button onClick={() => { setName(""); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Family
        </Button>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Family Name</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Members</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {families.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No families yet. Create one to group siblings and generate a shared link code.</TableCell></TableRow>
            )}
            {families.map((family: any) => (
              <>
                <TableRow key={family.id} className="cursor-pointer" onClick={() => toggleExpand(family.id)}>
                  <TableCell className="text-muted-foreground">
                    {expandedFamilyId === family.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </TableCell>
                  <TableCell className="font-medium">{family.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(family.students || []).length} student{(family.students || []).length !== 1 ? "s" : ""}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" title="Generate family link code"
                      onClick={() => { setSelectedFamily(family); setParentEmail(""); setGeneratedCode(null); setCopied(false); setCodeOpen(true); }}>
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Add student"
                      onClick={() => { setSelectedFamily(family); setAddStudentId(""); setAddStudentOpen(true); }}>
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" title="Rename"
                      onClick={() => { setSelectedFamily(family); setName(family.name); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" title="Delete"
                      onClick={() => { setSelectedFamily(family); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedFamilyId === family.id && (
                  <TableRow key={`${family.id}-expanded`} className="bg-muted/10 hover:bg-muted/10">
                    <TableCell />
                    <TableCell colSpan={3} className="py-3">
                      {(family.students || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No students in this family yet. Click the <Users className="w-3 h-3 inline" /> button to add students.</p>
                      ) : (
                        <div className="space-y-2">
                          {family.students.map((student: any) => (
                            <div key={student.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-card border border-border">
                              <span className="font-medium">{student.name}</span>
                              <Button variant="ghost" size="sm" className="h-6 text-muted-foreground hover:text-destructive"
                                onClick={() => removeStudentMutation.mutate({ familyId: family.id, studentId: student.id })}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>

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
