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

// ─── ALLOCATIONS ──────────────────────────────────────────────────────────────
function AllocationsSection() {
  const { toast } = useToast();
  const { data: allocations = [] } = useQuery<any[]>({ queryKey: ["/api/allocations"], queryFn: getQueryFn({ on401: "throw" }) });

  const confirmReceiptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/allocations/${id}/confirm`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/allocations"] }); toast({ title: "Receipt confirmed", description: "Books marked as received by student." }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const pendingAllocations = allocations.filter((a: any) => !["received"].includes(a.status));
  const receivedAllocations = allocations.filter((a: any) => a.status === "received");

  const counts = {
    total: allocations.length,
    received: allocations.filter((a: any) => a.status === "received").length,
    pending: allocations.filter((a: any) => a.status !== "received" && a.status !== "absent").length,
    absent: allocations.filter((a: any) => a.status === "absent").length,
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Distribution &amp; Allocations</h1>
        <p className="text-muted-foreground mt-1">
          Track book allocations and confirm receipt for any student — including a teacher's own child.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total },
          { label: "Received", value: counts.received, tone: "text-emerald-600" },
          { label: "Pending", value: counts.pending, tone: "text-amber-600" },
          { label: "Absent", value: counts.absent },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={cn("text-2xl font-bold mt-0.5", (k as any).tone || "text-foreground")}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Student</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Book</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Allocated</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Received</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.student?.name || "Unknown"}</TableCell>
                <TableCell>{a.book?.title || "Unknown"}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.receivedAt ? new Date(a.receivedAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  {a.status !== "received" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => confirmReceiptMutation.mutate(a.id)}
                      disabled={confirmReceiptMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Receipt
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {allocations.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No allocations yet. Confirm a payment to create allocations.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── EXTRA COPY REQUESTS ───────────────────────────────────────
function ExtraRequestsSection() {
  const { toast } = useToast();
  const { data: requests = [] } = useQuery<any[]>({ queryKey: ["/api/extra-requests"], queryFn: getQueryFn({ on401: "throw" }) });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extra-requests/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/extra-requests"] }); toast({ title: "Request approved" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extra-requests/${id}/reject`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/extra-requests"] }); toast({ title: "Request rejected" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const reasonLabels: Record<string, string> = {
    NEW_STUDENT: "New Student",
    DAMAGED_IN_CLASS: "Damaged in Class",
    LOST_REPLACEMENT: "Lost Replacement",
    SHORTAGE: "Shortage",
    OTHER: "Other",
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Extra Copy Requests</h1>
        <p className="text-muted-foreground mt-1">Review teacher requests for additional book copies.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Teacher</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Class</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Book</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Qty</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Reason</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.teacher?.name || "Unknown"}</TableCell>
                <TableCell>{r.class?.name || "—"}</TableCell>
                <TableCell>{r.book?.title || "Unknown"}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{reasonLabels[r.reason] || r.reason}</Badge></TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "pending" && (
                    <>
                      <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => rejectMutation.mutate(r.id)} disabled={rejectMutation.isPending}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No extra copy requests.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── COMMUNICATIONS OVERSIGHT ─────────────────────────────────

export { AllocationsSection, ExtraRequestsSection };
