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

// ─── COMMUNICATIONS ───────────────────────────────────────────────────────────
function CommunicationsSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ── Thread list query
  const { data: threads = [], isLoading: threadsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/communications", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await apiRequest("GET", `/api/admin/communications${params}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  // ── Thread detail query
  const { data: threadDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/admin/communications", selectedThreadId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/communications/${selectedThreadId}`);
      return res.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: selectedThreadId ? 8000 : false,
  });

  // ── Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ threadId, status, reason }: { threadId: string; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/communications/${threadId}/status`, { status, reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thread status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communications"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    },
  });

  // ── Filter threads by search
  const filteredThreads = threads.filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.subject || "").toLowerCase().includes(q) ||
      (t.parentName || "").toLowerCase().includes(q) ||
      (t.teacherName || "").toLowerCase().includes(q) ||
      (t.studentName || "").toLowerCase().includes(q)
    );
  });

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "closed": return "secondary";
      case "archived": return "outline";
      default: return "default";
    }
  };

  // ── Detail view
  if (selectedThreadId) {
    const thread = threadDetail?.thread;
    const messages = threadDetail?.messages || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to threads
          </Button>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : thread ? (
          <>
            {/* Thread metadata */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{thread.subject || "No Subject"}</CardTitle>
                    <CardDescription className="mt-1">Thread #{thread.id}</CardDescription>
                  </div>
                  <Badge variant={statusBadgeVariant(thread.status)}>{thread.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Parent:</span> <span className="font-medium">{thread.parentName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Teacher:</span> <span className="font-medium">{thread.teacherName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{thread.studentName || "—"}</span></div>
                  <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{formatDateTime(thread.createdAt)}</span></div>
                </div>

                {/* Admin actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  {thread.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "closed" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Close Thread
                    </Button>
                  )}
                  {thread.status === "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "open" })}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Reopen Thread
                    </Button>
                  )}
                  {thread.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ threadId: thread.id, status: "archived" })}
                    >
                      <Archive className="h-4 w-4 mr-1" /> Archive Thread
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Messages ({messages.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No messages in this thread.</p>
                )}
                {messages.map((msg: any) => (
                  <div key={msg.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{msg.senderName || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Thread not found.</CardContent></Card>
        )}
      </div>
    );
  }

  // ── List view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Communication Oversight
        </h2>
        <p className="text-muted-foreground mt-1">Monitor and manage all parent-teacher conversations across the school.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or subject..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread table */}
      <Card>
        <CardContent className="p-0">
          {threadsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Parent</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Teacher</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Student</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-center">Messages</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredThreads.map((t: any) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedThreadId(t.id)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{t.subject || "No Subject"}</TableCell>
                    <TableCell>{t.parentName || "—"}</TableCell>
                    <TableCell>{t.teacherName || "—"}</TableCell>
                    <TableCell>{t.studentName || "—"}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge></TableCell>
                    <TableCell className="text-center">{t.totalMessages ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.updatedAt)}</TableCell>
                  </TableRow>
                ))}
                {filteredThreads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No threads match your search." : "No communication threads found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export { CommunicationsSection };
