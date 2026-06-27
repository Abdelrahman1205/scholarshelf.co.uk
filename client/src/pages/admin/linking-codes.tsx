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

// ─── LINKING CODES ────────────────────────────────────────────────────────────
function LinkingCodesSection() {
  const { toast } = useToast();
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ studentId: "", parentEmail: "" });

  const { data: codes = [] } = useQuery<any[]>({ queryKey: ["/api/linking-codes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: students = [] } = useQuery<any[]>({ queryKey: ["/api/students"], queryFn: getQueryFn({ on401: "throw" }) });

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateForm, setRotateForm] = useState({ studentId: "", parentEmail: "" });

  const generateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/students/${data.studentId}/linking-code`, { parentEmail: data.parentEmail }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] }); setGenOpen(false); toast({ title: "Linking code generated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const rotateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/students/${data.studentId}/linking-code/rotate`, { parentEmail: data.parentEmail }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] }); setRotateOpen(false); toast({ title: "Code rotated", description: "Previous codes invalidated. New code sent to parent." }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Linking Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and manage parent-student link codes. Rotate a code if it was shared incorrectly.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setRotateForm({ studentId: "", parentEmail: "" }); setRotateOpen(true); }}>
            Rotate Code
          </Button>
          <Button onClick={() => { setGenForm({ studentId: "", parentEmail: "" }); setGenOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Generate Code
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code: any) => (
              <TableRow key={code.id}>
                <TableCell className="font-mono font-semibold text-primary">{code.code}</TableCell>
                <TableCell>{code.student?.name || "Unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{code.parentEmail}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={code.isUsed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {code.isUsed ? "Used" : "Available"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No linking codes generated yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Generate Linking Code</DialogTitle><DialogDescription>Create a new code for a parent to link to their child.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Student</Label>
              <Select value={genForm.studentId} onValueChange={(v) => setGenForm({ ...genForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Parent Email</Label><Input type="email" value={genForm.parentEmail} onChange={(e) => setGenForm({ ...genForm, parentEmail: e.target.value })} placeholder="parent@example.com" /></div>
          </div>
          <DialogFooter><Button onClick={() => generateMutation.mutate(genForm)} disabled={generateMutation.isPending || !genForm.studentId || !genForm.parentEmail}>{generateMutation.isPending ? "Generating..." : "Generate Code"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rotate Link Code</DialogTitle>
            <DialogDescription>Invalidates all existing unused codes for this student and generates a new one. Use when a code has been leaked or shared incorrectly.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Student</Label>
              <Select value={rotateForm.studentId} onValueChange={(v) => setRotateForm({ ...rotateForm, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Parent Email (for new code)</Label><Input type="email" value={rotateForm.parentEmail} onChange={(e) => setRotateForm({ ...rotateForm, parentEmail: e.target.value })} placeholder="parent@example.com" /></div>
          </div>
          <DialogFooter><Button onClick={() => rotateMutation.mutate(rotateForm)} disabled={rotateMutation.isPending || !rotateForm.studentId || !rotateForm.parentEmail} className="bg-amber-600 hover:bg-amber-700">{rotateMutation.isPending ? "Rotating..." : "Rotate Code"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PAYMENTS ──────────────────────────────────────────────────

export { LinkingCodesSection };
