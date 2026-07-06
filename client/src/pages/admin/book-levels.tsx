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

// ─── BOOK LEVELS ──────────────────────────────────────────────────────────────
function BookLevelsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [addItemForm, setAddItemForm] = useState({ bookId: "", quantity: 1 });
  const [assignForm, setAssignForm] = useState({ classId: "", bookLevelId: "" });
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: levels = [] } = useQuery<any[]>({ queryKey: ["/api/book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classBookLevels = [] } = useQuery<any[]>({ queryKey: ["/api/class-book-levels"], queryFn: getQueryFn({ on401: "throw" }) });

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddOpen(false); setForm({ name: "", description: "" }); toast({ title: "Book level created" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { levelId: string; bookId: string; quantity: number }) => apiRequest("POST", `/api/book-levels/${data.levelId}/items`, { bookId: data.bookId, quantity: data.quantity }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddItemForm({ bookId: "", quantity: 1 }); toast({ title: "Book added to level" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/book-level-items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); toast({ title: "Book removed from level" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/class-book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); setAssignOpen(false); toast({ title: "Level assigned to class" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/class-book-levels/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); toast({ title: "Assignment removed" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bundles</h1>
          <p className="text-muted-foreground mt-1">Create book bundles and assign them to classes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignOpen(true)}><GraduationCap className="w-4 h-4 mr-2" /> Assign to Class</Button>
          <Button onClick={() => { setForm({ name: "", description: "" }); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> New Level</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bundles", value: levels.length },
          { label: "Class Assignments", value: classBookLevels.length },
          { label: "Books Catalogued", value: books.length },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-bold mt-0.5 text-foreground">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Assigned classes */}
      {classBookLevels.length > 0 && (
        <Card className="border-border shadow-none rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Class Assignments</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {classBookLevels.map((cbl: any) => (
                <Badge key={cbl.id} variant="outline" className="py-1 px-3 flex items-center gap-1.5">
                  {cbl.class?.name || "?"} → {cbl.bookLevel?.name || "?"}
                  <button
                    onClick={() => removeAssignmentMutation.mutate(cbl.id)}
                    disabled={removeAssignmentMutation.isPending}
                    className="ml-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove assignment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {levels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-base font-semibold text-muted-foreground">No Bundles</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a bundle to group books together for classes.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create First Bundle</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {levels.map((level: any) => (
            <LevelCard key={level.id} level={level} expanded={expandedLevel === level.id}
              onToggle={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}
              books={books} addItemForm={addItemForm} setAddItemForm={setAddItemForm}
              addItemMutation={addItemMutation} removeItemMutation={removeItemMutation} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>New Bundle</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 3 Books" /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={() => createLevelMutation.mutate(form)} disabled={createLevelMutation.isPending}>{createLevelMutation.isPending ? "Creating..." : "Create Bundle"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Assign Level to Class</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={assignForm.classId} onValueChange={(v) => setAssignForm({ ...assignForm, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Book Level</Label>
              <Select value={assignForm.bookLevelId} onValueChange={(v) => setAssignForm({ ...assignForm, bookLevelId: v })}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{levels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => assignMutation.mutate(assignForm)} disabled={assignMutation.isPending}>{assignMutation.isPending ? "Assigning..." : "Assign"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LevelCard({ level, expanded, onToggle, books, addItemForm, setAddItemForm, addItemMutation, removeItemMutation }: any) {
  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["/api/book-levels", level.id, "items"],
    queryFn: async () => { const res = await fetch(`/api/book-levels/${level.id}/items`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
    enabled: expanded,
  });

  return (
    <Card className="border-border shadow-none rounded-2xl">
      <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{level.name}</CardTitle>
            {level.description && <CardDescription className="mt-1">{level.description}</CardDescription>}
          </div>
          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          {items.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Book</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Qty</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Price</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.book?.title || "Unknown"}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>£{parseFloat(item.book?.price || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => removeItemMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No books in this level yet.</p>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Add Book</Label>
              <Select value={addItemForm.bookId} onValueChange={(v) => setAddItemForm({ ...addItemForm, bookId: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select book" /></SelectTrigger>
                <SelectContent>{books.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Label className="text-xs">Qty</Label>
              <Input type="number" min="1" className="h-9" value={addItemForm.quantity} onChange={(e) => setAddItemForm({ ...addItemForm, quantity: parseInt(e.target.value) || 1 })} />
            </div>
            <Button size="sm" className="h-9" onClick={() => addItemMutation.mutate({ levelId: level.id, bookId: addItemForm.bookId, quantity: addItemForm.quantity })} disabled={!addItemForm.bookId || addItemMutation.isPending}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── LINKING CODES ─────────────────────────────────────────────

export { BookLevelsSection };
