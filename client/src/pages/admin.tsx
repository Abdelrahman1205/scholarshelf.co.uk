import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus, Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight, QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users } from "lucide-react";
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
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { useToast } from "@/hooks/use-toast";

function UsersTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "teacher", email: "" });

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setAddOpen(false); resetForm(); toast({ title: "User created successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/users/${selectedUser?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setEditOpen(false); toast({ title: "User updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/users/${selectedUser?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setDeleteOpen(false); toast({ title: "User deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() {
    setForm({ username: "", password: "", name: "", role: "teacher", email: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-heading font-semibold">All Users</h3>
        <Button data-testid="button-add-user" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u: any) => (
              <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "-"}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : u.role === "teacher" ? "secondary" : "outline"} data-testid={`badge-role-${u.id}`}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button data-testid={`button-edit-user-${u.id}`} variant="ghost" size="sm" onClick={() => {
                    setSelectedUser(u);
                    setForm({ username: u.username || "", password: "", name: u.name || "", role: u.role || "teacher", email: u.email || "" });
                    setEditOpen(true);
                  }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`button-delete-user-${u.id}`} variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedUser(u); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new teacher or parent account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input data-testid="input-user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ms. Sarah Ahmed" />
            </div>
            <div className="grid gap-2">
              <Label>Username</Label>
              <Input data-testid="input-user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. sarah" />
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input data-testid="input-user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter password" />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input data-testid="input-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. sarah@school.edu" />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-add-user" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input data-testid="input-edit-user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Username</Label>
              <Input data-testid="input-edit-user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input data-testid="input-edit-user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input data-testid="input-edit-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-edit-user" onClick={() => {
              const payload: any = { name: form.name, username: form.username, email: form.email, role: form.role };
              if (form.password) payload.password = form.password;
              updateMutation.mutate(payload);
            }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedUser?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-user" onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassesTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [form, setForm] = useState({ name: "", academicYear: "2025-2026", teacherId: "" });

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });
  const teachers = users.filter((u: any) => u.role === "teacher");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/classes", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setAddOpen(false); resetForm(); toast({ title: "Class created successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/classes/${selectedClass?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setEditOpen(false); toast({ title: "Class updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/classes/${selectedClass?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/classes"] }); setDeleteOpen(false); toast({ title: "Class deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() {
    setForm({ name: "", academicYear: "2025-2026", teacherId: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-heading font-semibold">All Classes</h3>
        <Button data-testid="button-add-class" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Class
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Academic Year</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((cls: any) => (
              <TableRow key={cls.id} data-testid={`row-class-${cls.id}`}>
                <TableCell className="font-medium">{cls.name}</TableCell>
                <TableCell className="text-muted-foreground">{cls.academicYear || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{users.find((u: any) => u.id === cls.teacherId)?.name || "Not assigned"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button data-testid={`button-edit-class-${cls.id}`} variant="ghost" size="sm" onClick={() => {
                    setSelectedClass(cls);
                    setForm({ name: cls.name || "", academicYear: cls.academicYear || "2025-2026", teacherId: cls.teacherId || "none" });
                    setEditOpen(true);
                  }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`button-delete-class-${cls.id}`} variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedClass(cls); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No classes found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>Fill in the details to add a new class.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input data-testid="input-class-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Academic Year</Label>
              <Input data-testid="input-class-academic-year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger data-testid="select-class-teacher">
                  <SelectValue placeholder="Select teacher (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-add-class" onClick={() => createMutation.mutate({ ...form, teacherId: form.teacherId === "none" || !form.teacherId ? null : form.teacherId })} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update the class details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input data-testid="input-edit-class-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Academic Year</Label>
              <Input data-testid="input-edit-class-academic-year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger data-testid="select-class-teacher">
                  <SelectValue placeholder="Select teacher (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-edit-class" onClick={() => updateMutation.mutate({ ...form, teacherId: form.teacherId === "none" || !form.teacherId ? null : form.teacherId })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedClass?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-class" onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentsTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [form, setForm] = useState({ name: "", classId: "" });

  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });

  const classMap = Object.fromEntries(classes.map((c: any) => [c.id, c]));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/students", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setAddOpen(false); resetForm(); toast({ title: "Student created successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/students/${selectedStudent?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setEditOpen(false); toast({ title: "Student updated successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/students/${selectedStudent?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); setDeleteOpen(false); toast({ title: "Student deleted successfully" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() {
    setForm({ name: "", classId: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-heading font-semibold">All Students</h3>
        <Button data-testid="button-add-student" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Student Code</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student: any) => (
              <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">{student.studentCode || "-"}</TableCell>
                <TableCell className="text-muted-foreground">{classMap[student.classId]?.name || "-"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button data-testid={`button-edit-student-${student.id}`} variant="ghost" size="sm" onClick={() => {
                    setSelectedStudent(student);
                    setForm({ name: student.name || "", classId: student.classId || "" });
                    setEditOpen(true);
                  }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`button-delete-student-${student.id}`} variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedStudent(student); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No students found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>Fill in the details to add a new student.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input data-testid="input-student-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select data-testid="select-student-class" value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger data-testid="select-student-class-trigger"><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-add-student" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update the student details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input data-testid="input-edit-student-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select data-testid="select-edit-student-class" value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger data-testid="select-edit-student-class-trigger"><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-edit-student" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedStudent?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-student" onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BooksTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isbnLooking, setIsbnLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });

  async function lookupIsbn(isbn: string) {
    setIsbnLooking(true);
    try {
      const res = await fetch(`/api/isbn-lookup/${encodeURIComponent(isbn)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({
          ...prev,
          isbn: data.isbn || prev.isbn,
          title: data.title || prev.title,
          author: data.author || prev.author,
          description: data.description || prev.description,
        }));
        toast({ title: "Book Found", description: `"${data.title}" details auto-filled from barcode.` });
      } else {
        setForm((prev) => ({ ...prev, isbn }));
        toast({ title: "ISBN Scanned", description: `ISBN ${isbn} captured. Book details not found in database — please fill in manually.` });
      }
    } catch {
      setForm((prev) => ({ ...prev, isbn }));
      toast({ title: "ISBN Scanned", description: `ISBN ${isbn} captured. Could not look up details — please fill in manually.` });
    } finally {
      setIsbnLooking(false);
    }
  }

  async function startScanner() {
    setScannerError(null);
    setScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 300, height: 150 },
          } as any,
          (decodedText) => {
            const isbn = decodedText.trim().replace(/[^0-9X]/gi, "");
            stopScanner();
            if (!addOpen) setAddOpen(true);
            lookupIsbn(isbn);
          },
          () => {}
        );
      } catch (err: any) {
        setScannerError(err?.message || "Could not access camera. Please check permissions.");
        setScannerOpen(false);
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScannerOpen(false);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      }
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/books", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setAddOpen(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/books/${selectedBook?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setEditOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/books/${selectedBook?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setDeleteOpen(false); },
  });

  function resetForm() {
    setForm({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 });
  }

  const filtered = books.filter((b: any) =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-books" type="search" placeholder="Search by title, author, or ISBN..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button data-testid="button-scan-barcode" variant="outline" onClick={() => { resetForm(); startScanner(); }}>
            <ScanBarcode className="w-4 h-4 mr-2" />
            Scan Barcode
          </Button>
          <Button data-testid="button-add-book" onClick={() => { resetForm(); setAddOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Book
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((book: any) => (
              <TableRow key={book.id} data-testid={`row-book-${book.id}`}>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell className="text-muted-foreground">{book.author}</TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">{book.isbn}</TableCell>
                <TableCell>£{parseFloat(book.price).toFixed(2)}</TableCell>
                <TableCell>
                  <span className={book.stockQuantity <= (book.lowStockThreshold || 10) ? "text-destructive font-medium" : ""}>
                    {book.stockQuantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={book.isActive ? "default" : "secondary"} className={book.isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}>
                    {book.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button data-testid={`button-edit-book-${book.id}`} variant="ghost" size="sm" onClick={() => {
                    setSelectedBook(book);
                    setForm({ title: book.title || "", author: book.author || "", isbn: book.isbn || "", price: book.price || "", description: book.description || "", isActive: book.isActive ?? true, stockQuantity: book.stockQuantity || 0, lowStockThreshold: book.lowStockThreshold || 10, reorderQuantity: book.reorderQuantity || 50 });
                    setEditOpen(true);
                  }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`button-delete-book-${book.id}`} variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedBook(book); setDeleteOpen(true); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No books found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              Scan Book Barcode
            </DialogTitle>
            <DialogDescription>Point your camera at the book's barcode (ISBN). It will be detected automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div id="barcode-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]" />
            {scannerError && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {scannerError}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={stopScanner}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Book</DialogTitle>
            <DialogDescription>Fill in the details to add a new book to the catalogue.</DialogDescription>
          </DialogHeader>
          {isbnLooking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up book details...
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input data-testid="input-book-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Author</Label>
                <Input data-testid="input-book-author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>ISBN</Label>
                <div className="flex gap-1">
                  <Input data-testid="input-book-isbn" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="button-scan-isbn"
                    onClick={() => { setAddOpen(false); startScanner(); }}
                    title="Scan barcode"
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Price (£)</Label>
                <Input data-testid="input-book-price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Stock Quantity</Label>
                <Input data-testid="input-book-stock" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Low Stock Threshold</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label>Reorder Quantity</Label>
                <Input type="number" value={form.reorderQuantity} onChange={(e) => setForm({ ...form, reorderQuantity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea data-testid="input-book-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-add-book" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Book</DialogTitle>
            <DialogDescription>Update the book details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input data-testid="input-edit-book-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Author</Label>
                <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>ISBN</Label>
                <Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Price (£)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Active</Label>
                <Select value={form.isActive ? "true" : "false"} onValueChange={(v) => setForm({ ...form, isActive: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-edit-book" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedBook?.title}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-book" onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InventoryTab() {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: 0, type: "purchase", reason: "" });

  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: lowStockBooks = [] } = useQuery<any[]>({ queryKey: ["/api/books/low-stock"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: transactions = [] } = useQuery<any[]>({ queryKey: ["/api/inventory-transactions"], queryFn: getQueryFn({ on401: "throw" }) });

  const adjustMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/books/${selectedBook?.id}/stock`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transactions"] });
      setAdjustOpen(false);
    },
  });

  const bookMap = Object.fromEntries(books.map((b: any) => [b.id, b]));

  return (
    <div className="space-y-4">
      {lowStockBooks.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-600 font-heading">Low Stock Alert</AlertTitle>
          <AlertDescription className="text-amber-600">
            {lowStockBooks.length} book{lowStockBooks.length > 1 ? "s" : ""} below stock threshold: {lowStockBooks.map((b: any) => b.title).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Stock Adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((book: any) => (
                <TableRow key={book.id} data-testid={`row-inventory-${book.id}`}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell>{book.stockQuantity}</TableCell>
                  <TableCell className="text-muted-foreground">{book.lowStockThreshold}</TableCell>
                  <TableCell>
                    {book.stockQuantity <= (book.lowStockThreshold || 10) ? (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Low Stock</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button data-testid={`button-adjust-stock-${book.id}`} variant="outline" size="sm" onClick={() => {
                      setSelectedBook(book);
                      setAdjustForm({ quantity: 0, type: "purchase", reason: "" });
                      setAdjustOpen(true);
                    }}>
                      Adjust Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Stock Change</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx: any) => (
                <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                  <TableCell className="font-medium">{bookMap[tx.bookId]?.title || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{tx.transactionType}</Badge>
                  </TableCell>
                  <TableCell>{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{tx.previousQuantity} → {tx.newQuantity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "-"}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No transactions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock - {selectedBook?.title}</DialogTitle>
            <DialogDescription>Current stock: {selectedBook?.stockQuantity}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Adjustment Type</Label>
              <Select data-testid="select-adjust-type" value={adjustForm.type} onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v })}>
                <SelectTrigger data-testid="select-adjust-type-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input data-testid="input-adjust-quantity" type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="grid gap-2">
              <Label>Reason / Notes</Label>
              <Textarea data-testid="input-adjust-reason" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-adjust" onClick={() => adjustMutation.mutate(adjustForm)} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookLevelsTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [levelForm, setLevelForm] = useState({ name: "", description: "" });
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [addBookForm, setAddBookForm] = useState({ bookId: "", quantity: 1 });
  const [assignForm, setAssignForm] = useState({ classId: "", bookLevelId: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<any>(null);

  const { data: levels = [] } = useQuery<any[]>({ queryKey: ["/api/book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: assignments = [] } = useQuery<any[]>({ queryKey: ["/api/class-book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: levelItems = [] } = useQuery<any[]>({
    queryKey: ["/api/book-levels", expandedLevel, "items"],
    queryFn: async () => {
      if (!expandedLevel) return [];
      const res = await fetch(`/api/book-levels/${expandedLevel}/items`, { credentials: "include" });
      return res.json();
    },
    enabled: !!expandedLevel,
  });

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setCreateOpen(false); setLevelForm({ name: "", description: "" }); },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/book-levels/${selectedLevel?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setDeleteOpen(false); },
  });

  const addBookToLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/book-levels/${expandedLevel}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-levels", expandedLevel, "items"] });
      setAddBookForm({ bookId: "", quantity: 1 });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/book-level-items/${itemId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels", expandedLevel, "items"] }); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/class-book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); setAssignForm({ classId: "", bookLevelId: "" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-heading font-semibold">Book Levels</h3>
        <Button data-testid="button-create-level" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Level
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {levels.map((level: any) => (
            <div key={level.id} className="border-b last:border-b-0">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" data-testid={`row-level-${level.id}`} onClick={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}>
                <div className="flex items-center gap-2">
                  {expandedLevel === level.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-medium">{level.name}</span>
                  {level.description && <span className="text-muted-foreground text-sm">— {level.description}</span>}
                </div>
                <Button data-testid={`button-delete-level-${level.id}`} variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedLevel(level); setDeleteOpen(true); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {expandedLevel === level.id && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Add Book</Label>
                      <Select value={addBookForm.bookId} onValueChange={(v) => setAddBookForm({ ...addBookForm, bookId: v })}>
                        <SelectTrigger data-testid="select-add-book-to-level"><SelectValue placeholder="Select a book" /></SelectTrigger>
                        <SelectContent>
                          {books.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qty</Label>
                      <Input data-testid="input-level-book-quantity" type="number" value={addBookForm.quantity} onChange={(e) => setAddBookForm({ ...addBookForm, quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <Button data-testid="button-add-book-to-level" size="sm" onClick={() => addBookToLevelMutation.mutate(addBookForm)} disabled={!addBookForm.bookId}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Book</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.book?.title || "Unknown"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            <Button data-testid={`button-remove-level-item-${item.id}`} variant="ghost" size="sm" className="text-destructive" onClick={() => removeItemMutation.mutate(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {levelItems.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No books in this level</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
          {levels.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No book levels created yet</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Assign Levels to Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Class</Label>
              <Select value={assignForm.classId} onValueChange={(v) => setAssignForm({ ...assignForm, classId: v })}>
                <SelectTrigger data-testid="select-assign-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Book Level</Label>
              <Select value={assignForm.bookLevelId} onValueChange={(v) => setAssignForm({ ...assignForm, bookLevelId: v })}>
                <SelectTrigger data-testid="select-assign-level"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button data-testid="button-assign-level" onClick={() => assignMutation.mutate(assignForm)} disabled={!assignForm.classId || !assignForm.bookLevelId}>
              Assign
            </Button>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Book Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => (
                <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                  <TableCell className="font-medium">{a.class?.name || "Unknown"}</TableCell>
                  <TableCell>{a.bookLevel?.name || "Unknown"}</TableCell>
                </TableRow>
              ))}
              {assignments.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No assignments yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Book Level</DialogTitle>
            <DialogDescription>Define a new book level grouping.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input data-testid="input-level-name" value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} placeholder="e.g. Year 4 Core Books" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea data-testid="input-level-description" value={levelForm.description} onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-create-level" onClick={() => createLevelMutation.mutate(levelForm)} disabled={createLevelMutation.isPending || !levelForm.name}>
              {createLevelMutation.isPending ? "Creating..." : "Create Level"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Level</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedLevel?.name}"? This will also remove all book items in this level.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-level" onClick={() => deleteLevelMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinkingCodesTab() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedQrCode, setSelectedQrCode] = useState<any>(null);
  const [studentForm, setStudentForm] = useState({ name: "", classId: "", parentEmail: "" });
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQrCode = useCallback(() => {
    if (!qrRef.current || !selectedQrCode) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement("a");
      a.download = `linking-code-${selectedQrCode.code}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }, [selectedQrCode]);

  const { data: codes = [] } = useQuery<any[]>({ queryKey: ["/api/linking-codes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });

  const createStudentAndCodeMutation = useMutation({
    mutationFn: async (data: { name: string; classId: string; parentEmail: string }) => {
      const studentRes = await apiRequest("POST", "/api/students", { name: data.name, classId: data.classId });
      const student = await studentRes.json();
      await apiRequest("POST", `/api/students/${student.id}/linking-code`, { parentEmail: data.parentEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setAddOpen(false);
      setStudentForm({ name: "", classId: "", parentEmail: "" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (code: any) => {
      await apiRequest("POST", `/api/students/${code.studentId}/linking-code`, { parentEmail: code.parentEmail });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] }); },
  });

  const filtered = codes.filter((c: any) =>
    c.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.parentEmail?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-codes" type="search" placeholder="Search by student name, code, or email..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button data-testid="button-add-student-code" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Student & Send Code
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Linking Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row: any) => (
              <TableRow key={row.id} data-testid={`row-code-${row.id}`}>
                <TableCell className="font-medium">{row.student?.name || "Unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{row.class?.name || row.student?.classId || "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{row.parentEmail}</TableCell>
                <TableCell>
                  <code className="bg-muted px-2 py-1 rounded font-mono text-sm">{row.code}</code>
                </TableCell>
                <TableCell>
                  {row.isUsed ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Linked</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Pending Link</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    data-testid={`button-show-qr-${row.id}`}
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => { setSelectedQrCode(row); setQrDialogOpen(true); }}
                  >
                    <QrCode className="w-4 h-4 mr-1" />
                    QR
                  </Button>
                  {!row.isUsed ? (
                    <Button data-testid={`button-resend-code-${row.id}`} variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={() => resendMutation.mutate(row)}>
                      Resend Email
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>Linked</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No linking codes found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading">QR Linking Code</DialogTitle>
            <DialogDescription>
              Share this QR code with the parent. They can scan it to link their child's profile.
            </DialogDescription>
          </DialogHeader>
          {selectedQrCode && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div ref={qrRef} className="bg-white p-4 rounded-lg border border-border">
                <QRCodeSVG
                  value={selectedQrCode.code}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="font-medium">{selectedQrCode.student?.name || "Unknown"}</p>
                <p className="font-mono text-lg tracking-widest bg-muted px-4 py-2 rounded-lg mt-2">
                  {selectedQrCode.code}
                </p>
              </div>
              <Button
                data-testid="button-download-qr"
                variant="outline"
                className="gap-2"
                onClick={downloadQrCode}
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>Create a student record and automatically email a linking code to their parent.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="student-name">Student Name</Label>
              <Input data-testid="input-student-name" id="student-name" placeholder="e.g. Liam Taylor" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-class">Assign to Class</Label>
              <Select value={studentForm.classId} onValueChange={(v) => setStudentForm({ ...studentForm, classId: v })}>
                <SelectTrigger data-testid="select-student-class"><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">This automatically assigns the required book level to the student.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parent-email">Parent Email Address</Label>
              <Input data-testid="input-parent-email" id="parent-email" type="email" placeholder="parent@example.com" value={studentForm.parentEmail} onChange={(e) => setStudentForm({ ...studentForm, parentEmail: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-submit-student-code" className="w-full sm:w-auto" onClick={() => createStudentAndCodeMutation.mutate(studentForm)} disabled={createStudentAndCodeMutation.isPending || !studentForm.name || !studentForm.classId || !studentForm.parentEmail}>
              <Mail className="w-4 h-4 mr-2" />
              {createStudentAndCodeMutation.isPending ? "Creating..." : "Create & Email Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTab() {
  const { toast } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: payments = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/payments"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: baskets = [] } = useQuery<any[]>({ queryKey: ["/api/admin/baskets"], queryFn: getQueryFn({ on401: "throw" }) });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({ title: "Payment confirmed", description: "Books have been allocated to the student." });
      setDetailOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/payments/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({ title: "Payment rejected", description: "The basket has been returned to pending." });
      setDetailOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function statusBadge(status: string) {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Pending Verification</Badge>;
      case "completed": return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Confirmed</Badge>;
      case "failed": return <Badge variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const getBasketForPayment = (paymentId: string) => {
    return baskets.filter((b: any) => b.status !== "pending" || true).find((b: any) => {
      return baskets.some((bk: any) => bk.id === b.id);
    });
  };

  const filtered = filterStatus === "all" ? payments : payments.filter((p: any) => p.status === filterStatus);

  const totalPending = payments.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + parseFloat(p.totalAmount || 0), 0);
  const totalConfirmed = payments.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + parseFloat(p.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-heading font-semibold">Payment Management</h3>
        <div className="flex gap-2">
          {["all", "pending", "completed", "failed"].map((s) => (
            <Button
              key={s}
              data-testid={`button-filter-${s}`}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              className="capitalize"
            >
              {s === "all" ? "All" : s === "completed" ? "Confirmed" : s === "failed" ? "Rejected" : "Pending"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Payments</p>
            <p className="text-2xl font-bold font-heading mt-1" data-testid="text-total-payments">{payments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-600">Pending Verification</p>
            <p className="text-2xl font-bold font-heading text-amber-600 mt-1" data-testid="text-pending-amount">
              £{totalPending.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-emerald-600">Total Confirmed Revenue</p>
            <p className="text-2xl font-bold font-heading text-emerald-600 mt-1" data-testid="text-confirmed-amount">
              £{totalConfirmed.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4">Date</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
            )}
            {filtered.map((p: any) => (
              <TableRow key={p.id} data-testid={`row-payment-${p.id}`} className="cursor-pointer hover:bg-muted/30" onClick={() => { setSelectedPayment(p); setDetailOpen(true); }}>
                <TableCell className="px-4 text-sm text-muted-foreground">
                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </TableCell>
                <TableCell className="text-sm">{p.parentIdentifier}</TableCell>
                <TableCell>
                  <code className="bg-muted px-2 py-1 rounded font-mono text-xs">{p.paymentReference}</code>
                </TableCell>
                <TableCell className="font-semibold">£{parseFloat(p.totalAmount).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground capitalize text-sm">{(p.paymentMethod || "").replace(/_/g, " ")}</TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">
                  {p.externalPaymentId ? (
                    <code className="bg-muted px-1 py-0.5 rounded">{p.externalPaymentId}</code>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-right px-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {p.status === "pending" && (
                      <>
                        <Button data-testid={`button-confirm-payment-${p.id}`} variant="outline" size="sm" className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10" onClick={(e) => { e.stopPropagation(); confirmMutation.mutate(p.id); }} disabled={confirmMutation.isPending}>
                          Confirm
                        </Button>
                        <Button data-testid={`button-reject-payment-${p.id}`} variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(p.id); }} disabled={rejectMutation.isPending}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {selectedPayment && (
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="font-heading">Payment Detail</DialogTitle>
              <DialogDescription>Full record for reference <span className="font-mono">{selectedPayment.paymentReference}</span></DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Parent</p>
                  <p className="font-medium">{selectedPayment.parentIdentifier}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Amount</p>
                  <p className="font-bold text-lg text-primary">£{parseFloat(selectedPayment.totalAmount).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Payment Method</p>
                  <p className="capitalize">{(selectedPayment.paymentMethod || "").replace(/_/g, " ")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Status</p>
                  <p>{statusBadge(selectedPayment.status)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Initiated</p>
                  <p>{selectedPayment.paidAt ? new Date(selectedPayment.paidAt).toLocaleString("en-GB") : "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Confirmed</p>
                  <p>{selectedPayment.confirmedAt ? new Date(selectedPayment.confirmedAt).toLocaleString("en-GB") : "—"}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2 text-sm">
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">EduBook Reference</p>
                <p className="font-mono text-base font-bold tracking-widest">{selectedPayment.paymentReference}</p>
              </div>
              {selectedPayment.externalPaymentId && (
                <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2 text-sm">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">External System ID</p>
                  <p className="font-mono">{selectedPayment.externalPaymentId}</p>
                  {selectedPayment.externalPaymentStatus && (
                    <p className="text-muted-foreground">External Status: <span className="capitalize font-medium">{selectedPayment.externalPaymentStatus}</span></p>
                  )}
                </div>
              )}
              {selectedPayment.notes && (
                <div className="rounded-lg border border-border p-3 bg-muted/20 text-sm">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">Notes</p>
                  <p>{selectedPayment.notes}</p>
                </div>
              )}
            </div>
            {selectedPayment.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => rejectMutation.mutate(selectedPayment.id)} disabled={rejectMutation.isPending}>
                  Reject Payment
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmMutation.mutate(selectedPayment.id)} disabled={confirmMutation.isPending}>
                  {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm & Allocate Books
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function AllocationsTab() {
  const { data: allocations = [] } = useQuery<any[]>({ queryKey: ["/api/allocations"], queryFn: getQueryFn({ on401: "throw" }) });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-semibold">All Allocations</h3>
      <Card className="border-border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allocated Date</TableHead>
              <TableHead>Received Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((a: any) => (
              <TableRow key={a.id} data-testid={`row-allocation-${a.id}`}>
                <TableCell className="font-medium">{a.student?.name || "Unknown"}</TableCell>
                <TableCell>{a.book?.title || "Unknown"}</TableCell>
                <TableCell>
                  {a.status === "received" ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Received</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Allocated</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.receivedAt ? new Date(a.receivedAt).toLocaleDateString() : "-"}</TableCell>
              </TableRow>
            ))}
            {allocations.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No allocations found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Admin Console</h1>
        <p className="text-muted-foreground mt-2">Manage the complete lifecycle of books, inventory, and distribution.</p>
      </div>

      <Tabs defaultValue="books" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 h-auto p-1 bg-card border border-border rounded-lg gap-1">
          <TabsTrigger data-testid="tab-users" value="users" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <UserPlus className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-classes" value="classes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <GraduationCap className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Classes</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-students" value="students" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Students</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-books" value="books" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Book className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Books</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-inventory" value="inventory" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <PackageSearch className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-levels" value="levels" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Layers className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Book Levels</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-codes" value="codes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Key className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Linking Codes</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-payments" value="payments" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <CreditCard className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger data-testid="tab-allocations" value="allocations" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <BoxSelect className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Allocations</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="users" className="m-0">
            <UsersTab />
          </TabsContent>
          <TabsContent value="classes" className="m-0">
            <ClassesTab />
          </TabsContent>
          <TabsContent value="students" className="m-0">
            <StudentsTab />
          </TabsContent>
          <TabsContent value="books" className="m-0">
            <BooksTab />
          </TabsContent>
          <TabsContent value="inventory" className="m-0">
            <InventoryTab />
          </TabsContent>
          <TabsContent value="levels" className="m-0">
            <BookLevelsTab />
          </TabsContent>
          <TabsContent value="codes" className="m-0">
            <LinkingCodesTab />
          </TabsContent>
          <TabsContent value="payments" className="m-0">
            <PaymentsTab />
          </TabsContent>
          <TabsContent value="allocations" className="m-0">
            <AllocationsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
