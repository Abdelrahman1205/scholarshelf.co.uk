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

// ─── PARENTS ──────────────────────────────────────────────────────────────────
function ParentsSection() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  const endpoint = (() => {
    const params = new URLSearchParams();
    if (schoolFilter !== "all") params.set("schoolId", schoolFilter);
    const query = params.toString();
    return query ? `/api/admin/parents?${query}` : "/api/admin/parents";
  })();

  const {
    data: parents = [],
    isLoading,
    isError,
    error,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/parents", schoolFilter],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load parents");
      return res.json();
    },
  });

  const filtered = parents.filter((p: any) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ? true
      : statusFilter === "linked" ? (p.linkedChildrenCount ?? 0) > 0
      : statusFilter === "unlinked" ? (p.linkedChildrenCount ?? 0) === 0
      : statusFilter === "pending-signup" ? p.parentStatus === "invited"
      : statusFilter === "invite-pending" ? p.signupStatus === "Invite pending"
      : statusFilter === "unpaid" ? (p.unpaidBasketsCount ?? 0) > 0
      : statusFilter === "awaiting-collection" ? (p.paidAwaitingCollectionCount ?? 0) > 0
      : statusFilter === "completed-handover" ? p.collectionStatus === "completed"
      : p.parentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const schools = Array.from(new Map(
    parents
      .filter((p: any) => !!p.schoolId)
      .map((p: any) => [
        p.schoolId,
        {
          value: p.schoolId,
          label: formatSchoolDisplay(p),
        },
      ]),
  ).values()).sort((a: any, b: any) => a.label.localeCompare(b.label));

  const totalLinkedChildren = parents.reduce((acc, p: any) => acc + (p.linkedChildrenCount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parents</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor parent accounts, child links, and payment readiness.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Parents: {parents.length}</Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Linked Children: {totalLinkedChildren}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search parents..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {normalizeRole(currentUser?.role) === "platform_owner" && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map((school: any) => (
                <SelectItem key={school.value} value={school.value}>{school.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="linked">Linked parents</SelectItem>
            <SelectItem value="unlinked">Unlinked parents</SelectItem>
            <SelectItem value="pending-signup">Pending signup</SelectItem>
            <SelectItem value="invite-pending">Invite pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="unpaid">Unpaid baskets/orders</SelectItem>
            <SelectItem value="awaiting-collection">Paid awaiting collection</SelectItem>
            <SelectItem value="completed-handover">Completed handover</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <Card className="border-border shadow-none">
          <CardContent className="py-10 text-center text-muted-foreground">Loading parent accounts...</CardContent>
        </Card>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load parents</AlertTitle>
          <AlertDescription>{(error as Error)?.message || "Please try again."}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && (
        <Card className="border-border shadow-none">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Linked Children</TableHead>
                <TableHead>Linked Student Names</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead>Signup/Invite</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((parent: any) => (
                <TableRow key={parent.id}>
                  <TableCell className="font-medium">{parent.name || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground">{parent.email || "Not available"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={parent.parentStatus === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                      {parent.parentStatus || "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatSchoolDisplay(parent)}</TableCell>
                  <TableCell>{parent.linkedChildrenCount ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(parent.linkedStudents || []).length > 0
                      ? parent.linkedStudents.map((s: any) => s.name).filter(Boolean).join(", ")
                      : "Not available"}
                  </TableCell>
                  <TableCell>{parent.completedPaymentsCount ?? 0}/{parent.paymentsCount ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.lastPaymentAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{parent.signupStatus || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{parent.collectionStatus || "Not available"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(parent.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">{search || statusFilter !== "all" ? "No matching parents found" : "No parent accounts found"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── CLASSES ───────────────────────────────────────────────────

export { ParentsSection };
