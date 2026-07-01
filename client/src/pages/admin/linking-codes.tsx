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
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: codes = [] } = useQuery<any[]>({ queryKey: ["/api/linking-codes"], queryFn: getQueryFn({ on401: "throw" }) });

  const resendMutation = useMutation({
    mutationFn: (code: any) => apiRequest("POST", `/api/students/${code.studentId}/linking-code/rotate`, { parentEmail: code.parentEmail }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/linking-codes"] });
      setResendingId(null);
      toast({ title: "Invite resent", description: "A fresh code has been sent to the parent." });
    },
    onError: (err: any) => { setResendingId(null); toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Parent Invites</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invites are sent automatically when a student is added with a parent email. Use <strong>Resend</strong> if a parent lost or didn't receive their email.
        </p>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code: any) => (
              <TableRow key={code.id}>
                <TableCell className="font-medium">{code.student?.name || "Unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{code.parentEmail}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={code.isUsed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {code.isUsed ? "Linked" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  {!code.isUsed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={resendingId === code.id || resendMutation.isPending}
                      onClick={() => { setResendingId(code.id); resendMutation.mutate(code); }}
                    >
                      {resendingId === code.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
                      Resend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No invites sent yet. Add a student with a parent email to get started.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── PAYMENTS ──────────────────────────────────────────────────


export { LinkingCodesSection };
