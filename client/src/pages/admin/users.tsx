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

// ─── USERS ────────────────────────────────────────────────────────────────────
function UserDetailPanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [addParentOpen, setAddParentOpen] = useState(false);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [linkChildOpen, setLinkChildOpen] = useState(false);
  const [removeRoleOpen, setRemoveRoleOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [department, setDepartment] = useState("");
  const [subjects, setSubjects] = useState("");

  const { data: detail, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/users", userId],
    queryFn: () => fetch(`/api/admin/users/${userId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!userId,
  });

  const { data: studentResults = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/students/search", studentSearch],
    queryFn: () => fetch(`/api/admin/students/search?q=${encodeURIComponent(studentSearch)}`, { credentials: "include" }).then((r) => r.json()),
    enabled: studentSearch.length >= 2,
  });

  const addParentRoleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/admin/users/${userId}/roles/parent`, data),
    onSuccess: () => { refetch(); setAddParentOpen(false); toast({ title: "Parent role added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addTeacherRoleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/admin/users/${userId}/roles/teacher`, data),
    onSuccess: () => { refetch(); setAddTeacherOpen(false); toast({ title: "Teacher role added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const linkChildMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/admin/users/${userId}/link-child`, data),
    onSuccess: () => { refetch(); setLinkChildOpen(false); setStudentSearch(""); setSelectedStudentId(""); toast({ title: "Child linked" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (role: string) => apiRequest("DELETE", `/api/admin/users/${userId}/roles/${role}`),
    onSuccess: () => { refetch(); setRemoveRoleOpen(false); toast({ title: "Role removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/users/${userId}/suspend`),
    onSuccess: () => { refetch(); toast({ title: "User suspended" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/users/${userId}/reactivate`),
    onSuccess: () => { refetch(); toast({ title: "User reactivated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!detail || detail.message) return <div className="text-center text-muted-foreground py-16">User not found.</div>;

  const primaryRole = normalizeRole(detail.role);
  const secondaryRoles: string[] = detail.secondaryRoles || [];
  const allRoles = [primaryRole, ...secondaryRoles];
  const isParent = allRoles.includes("parent");
  const isTeacher = allRoles.includes("teacher");
  const canAddParent = !isParent;
  const canAddTeacher = !isTeacher;
  const isSuspended = detail.status === "disabled";
  const isCurrentUser = currentUser?.id === detail.id;

  const ROLE_COLORS: Record<string, string> = {
    parent: "bg-purple-100 text-purple-700 border-purple-200",
    teacher: "bg-blue-100 text-blue-700 border-blue-200",
    school_admin: "bg-orange-100 text-orange-700 border-orange-200",
    finance: "bg-green-100 text-green-700 border-green-200",
    platform_owner: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigateTo("/admin/users")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </button>

      {/* Header card */}
      <Card className="border-border shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold">{detail.name}</h2>
                <Badge variant="outline" className={isSuspended ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}>
                  {isSuspended ? "Suspended" : "Active"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">@{detail.username}{detail.email ? ` · ${detail.email}` : ""}</p>
              {detail.schoolName && <p className="text-xs text-muted-foreground">{formatSchoolDisplay(detail)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("border text-xs", ROLE_COLORS[primaryRole] || "bg-muted text-muted-foreground")}>
                {roleLabel(detail.role)} (primary)
              </Badge>
              {secondaryRoles.map((r) => (
                <Badge key={r} variant="outline" className={cn("border text-xs", ROLE_COLORS[r] || "")}>
                  {roleLabel(r)} +secondary
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
            {canAddParent && (
              <Button size="sm" variant="outline" onClick={() => { setStudentSearch(""); setSelectedStudentId(""); setRelationship(""); setAddParentOpen(true); }}>
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Parent Role
              </Button>
            )}
            {canAddTeacher && (
              <Button size="sm" variant="outline" onClick={() => { setDepartment(""); setSubjects(""); setAddTeacherOpen(true); }}>
                <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> Add Teacher Role
              </Button>
            )}
            {isParent && (
              <Button size="sm" variant="outline" onClick={() => { setStudentSearch(""); setSelectedStudentId(""); setRelationship(""); setLinkChildOpen(true); }}>
                <Users className="w-3.5 h-3.5 mr-1.5" /> Link Child
              </Button>
            )}
            {secondaryRoles.length > 0 && (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setRoleToRemove(secondaryRoles[0]); setRemoveRoleOpen(true); }}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Remove {roleLabel(secondaryRoles[0])} Role
              </Button>
            )}
            {!isCurrentUser && !isProtectedPlatformOwner(detail.role) && (
              isSuspended
                ? <Button size="sm" variant="outline" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reactivate
                  </Button>
                : <Button size="sm" variant="outline" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                    onClick={() => suspendMutation.mutate()} disabled={suspendMutation.isPending}>
                    <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
                  </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked children */}
      {isParent && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Linked Children</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.parentLinks?.length > 0 ? (
              <div className="divide-y divide-border/30">
                {detail.parentLinks.map((link: any, i: number) => (
                  <div key={link.id || i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{link.student?.name || "Unknown Student"}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.student?.studentCode || ""}
                        {link.relationship ? ` · ${link.relationship}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{link.student?.className || "—"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No children linked yet. Use "Link Child" above.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assigned classes (teacher) */}
      {isTeacher && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Teacher Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.teacherProfile && (
              <div className="text-sm space-y-1">
                {detail.teacherProfile.department && <p><span className="text-muted-foreground">Department:</span> {detail.teacherProfile.department}</p>}
                {detail.teacherProfile.subjects && (() => {
                  try { const s = JSON.parse(detail.teacherProfile.subjects); return s.length > 0 ? <p><span className="text-muted-foreground">Subjects:</span> {s.join(", ")}</p> : null; } catch { return null; }
                })()}
              </div>
            )}
            {detail.assignedClasses?.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Assigned classes</p>
                <div className="flex flex-wrap gap-2">
                  {detail.assignedClasses.map((cls: any) => <Badge key={cls.id} variant="secondary">{cls.name}</Badge>)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No classes assigned yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Parent Role modal */}
      <Dialog open={addParentOpen} onOpenChange={setAddParentOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Parent Role</DialogTitle>
            <DialogDescription>Grant {detail.name} parent-level access so they can view books and payments for their linked children.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Relationship (optional)</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue placeholder="Select relationship..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                  <SelectItem value="Guardian">Guardian</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Link a child now (optional)</Label>
              <Input placeholder="Type student name or code to search..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
              {studentSearch.length >= 2 && studentResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-background">
                  {studentResults.map((s: any) => (
                    <button key={s.id} type="button"
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors", selectedStudentId === s.id && "bg-primary/10 font-medium")}
                      onClick={() => setSelectedStudentId(s.id)}>
                      {s.name} <span className="text-muted-foreground text-xs ml-1">{s.studentCode} · {s.className}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStudentId && <p className="text-xs text-emerald-600">✓ {studentResults.find((s: any) => s.id === selectedStudentId)?.name} selected</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddParentOpen(false)}>Cancel</Button>
            <Button onClick={() => addParentRoleMutation.mutate({ relationship: relationship || undefined, studentId: selectedStudentId || undefined })} disabled={addParentRoleMutation.isPending}>
              {addParentRoleMutation.isPending ? "Adding..." : "Add Parent Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Teacher Role modal */}
      <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Teacher Role</DialogTitle>
            <DialogDescription>Grant {detail.name} teacher-level access so they can manage class allocations.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Department (optional)</Label>
              <Input placeholder="e.g. Mathematics" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Subjects (optional, comma-separated)</Label>
              <Input placeholder="e.g. Maths, Physics" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTeacherOpen(false)}>Cancel</Button>
            <Button onClick={() => addTeacherRoleMutation.mutate({
              department: department || undefined,
              subjects: subjects ? subjects.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            })} disabled={addTeacherRoleMutation.isPending}>
              {addTeacherRoleMutation.isPending ? "Adding..." : "Add Teacher Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Child modal */}
      <Dialog open={linkChildOpen} onOpenChange={setLinkChildOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Link Child</DialogTitle>
            <DialogDescription>Search for a student and link them to {detail.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Search student</Label>
              <Input placeholder="Name or student code..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
              {studentSearch.length >= 2 && studentResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-background">
                  {studentResults.map((s: any) => (
                    <button key={s.id} type="button"
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/50", selectedStudentId === s.id && "bg-primary/10 font-medium")}
                      onClick={() => setSelectedStudentId(s.id)}>
                      {s.name} <span className="text-muted-foreground text-xs ml-1">{s.studentCode} · {s.className}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStudentId && <p className="text-xs text-emerald-600">✓ {studentResults.find((s: any) => s.id === selectedStudentId)?.name} selected</p>}
            </div>
            <div className="grid gap-2">
              <Label>Relationship (optional)</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                  <SelectItem value="Guardian">Guardian</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkChildOpen(false)}>Cancel</Button>
            <Button onClick={() => linkChildMutation.mutate({ studentId: selectedStudentId, relationship: relationship || undefined })}
              disabled={linkChildMutation.isPending || !selectedStudentId}>
              {linkChildMutation.isPending ? "Linking..." : "Link Child"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role dialog */}
      <AlertDialog open={removeRoleOpen} onOpenChange={setRemoveRoleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {roleLabel(roleToRemove)} Role</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the {roleLabel(roleToRemove)} secondary role from {detail.name}?
              Their primary role ({roleLabel(detail.role)}) remains unchanged.
              {roleToRemove === "parent" && " Existing child links will be retained."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeRoleMutation.mutate(roleToRemove)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── USERS ─────────────────────────────────────────────────────
function UsersSection() {
  const [_path, setPath] = useState(window.location.search);
  useEffect(() => {
    const handler = () => setPath(window.location.search);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  const detailUserId = new URLSearchParams(window.location.search).get("id");
  if (detailUserId) return <UserDetailPanel userId={detailUserId} />;
  return <UsersList />;
}

function UsersList() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const requesterIsOwner = normalizeRole(currentUser?.role) === "platform_owner";
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "" });
  const [inviteRole, setInviteRole] = useState("teacher");
  const [brandingPermissions, setBrandingPermissions] = useState<string[]>([]);

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/admin/users"], queryFn: getQueryFn({ on401: "throw" }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invites", { email: data.email, role: data.role }),
    onSuccess: () => {
      setAddOpen(false);
      resetForm();
      toast({ title: "Invite sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/admin/users/${selectedUser?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); setEditOpen(false); toast({ title: "User updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/users/${selectedUser?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); setDeleteOpen(false); toast({ title: "User deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() {
    setForm({ username: "", password: "", name: "", email: "" });
    setInviteRole("teacher");
    setBrandingPermissions([]);
  }

  const selectedUserIsIT = normalizeRole(selectedUser?.role) === "it_personnel";

  function toggleBrandingPermission(permission: string, checked: boolean) {
    setBrandingPermissions((current) => {
      if (checked) {
        if (current.includes(permission)) return current;
        return [...current, permission];
      }
      return current.filter((item) => item !== permission);
    });
  }

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).filter((u: any) => schoolFilter === "all" ? true : u.schoolId === schoolFilter);

  const schoolOptions = Array.from(new Map(
    users
      .filter((u: any) => !!u.schoolId)
      .map((u: any) => [
        u.schoolId,
        {
          value: u.schoolId,
          label: formatSchoolDisplay(u),
        },
      ]),
  ).values());

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage admin, teacher, and parent accounts.</p>
        </div>
        <Button data-testid="button-add-user" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Invite Staff
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search users..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {requesterIsOwner && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {schoolOptions.map((school: any) => (
                <SelectItem key={school.value} value={school.value}>{school.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Username</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Role</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">School</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Linked Children</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Created</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Last Login</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={isProtectedPlatformOwner(u.role) ? "default" : normalizeRole(u.role) === "teacher" ? "secondary" : "outline"}>
                      {roleLabel(u.role)}
                    </Badge>
                    {(u.secondaryRoles || []).map((r: string) => (
                      <Badge key={r} variant="outline" className="text-xs border-dashed opacity-80">{roleLabel(r)}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={u.status === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                    {u.status || "unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatSchoolDisplay(u)}</TableCell>
                <TableCell>{u.linkedChildrenCount ?? 0}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDateTime(u.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDateTime(u.lastLoginAt)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" title="View details" onClick={() => navigateTo(`/admin/users?id=${u.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {!isProtectedPlatformOwner(u.role) && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedUser(u);
                      setForm({ username: u.username || "", password: "", name: u.name || "", email: u.email || "" });
                      setBrandingPermissions(Array.isArray(u.brandingPermissions) ? u.brandingPermissions : []);
                      setEditOpen(true);
                    }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {currentUser?.id !== u.id && !isProtectedPlatformOwner(u.role) && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedUser(u); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{search ? "No matching users" : "No users found"}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>Send an invitation email so the staff member can set up their own account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sarah@school.edu" /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="school_admin">School Admin</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="it_personnel">IT Personnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ email: form.email, role: inviteRole })} disabled={createMutation.isPending || !form.email}>
              {createMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Role changes are restricted to secure onboarding workflows.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div className="grid gap-2"><Label>New Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            {currentUser?.id === selectedUser?.id ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Role locked</AlertTitle>
                <AlertDescription>You cannot change your own admin role.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Role changes disabled</AlertTitle>
                <AlertDescription>Use invite and onboarding workflows to assign parent, teacher, or admin roles safely.</AlertDescription>
              </Alert>
            )}
            {requesterIsOwner && selectedUserIsIT && (
              <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Branding Permissions</p>
                  <p className="text-xs text-muted-foreground">Choose what this IT user can do in school branding.</p>
                </div>
                <div className="grid gap-2">
                  {BRANDING_PERMISSION_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={brandingPermissions.includes(option.key)}
                        onChange={(event) => toggleBrandingPermission(option.key, event.target.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              const payload: any = { name: form.name, username: form.username, email: form.email };
              if (form.password) payload.password = form.password;
              if (requesterIsOwner && selectedUserIsIT) {
                payload.brandingPermissions = brandingPermissions;
              }
              updateMutation.mutate(payload);
            }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedUser?.name}"? This cannot be undone.</AlertDialogDescription>
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


export { UserDetailPanel, UsersSection };
