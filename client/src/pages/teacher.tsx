import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle2, Circle, Users, BookOpen, Package, LayoutDashboard, ClipboardList, AlertTriangle, Plus, MessageSquare, ArrowLeft, Send, Clock, Mail } from "lucide-react";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ClassItem { id: string; name: string; academicYear: string | null; teacherId: string | null; }

interface Allocation {
  id: string; studentId: string; bookId: string; basketId: string | null;
  status: "allocated" | "received" | "absent"; allocatedAt: string | null; receivedAt: string | null;
  student: { id: string; name: string; studentCode: string | null; class: { id: string; name: string } | null };
  book: { id: string; title: string; isbn: string | null };
}

interface StudentGroup {
  student: Allocation["student"];
  allocations: Allocation[];
  receivedCount: number;
  totalCount: number;
  allReceived: boolean;
}

interface ExtraRequest {
  id: string; teacherId: string; classId: string; bookId: string;
  quantity: number; reason: string; notes: string | null; status: string;
  adminNotes: string | null; createdAt: string; resolvedAt: string | null;
  book?: { id: string; title: string }; class?: { id: string; name: string };
}

interface BookItem { id: string; title: string; isbn: string | null; }

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    allocated: "bg-amber-500/10 text-amber-600",
    received: "bg-emerald-500/10 text-emerald-600",
    absent: "bg-red-500/10 text-red-600",
    pending: "bg-amber-500/10 text-amber-600",
    approved: "bg-emerald-500/10 text-emerald-600",
    rejected: "bg-red-500/10 text-red-600",
  };
  return (
    <Badge className={m[status] || "bg-muted text-muted-foreground"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

const REASONS = [
  { value: "NEW_STUDENT", label: "New Student" },
  { value: "DAMAGED_IN_CLASS", label: "Damaged in Class" },
  { value: "LOST_REPLACEMENT", label: "Lost Replacement" },
  { value: "SHORTAGE", label: "Shortage" },
  { value: "OTHER", label: "Other" },
];

function DashboardSection({ classes, allocations, extraRequests, isLoading }: {
  classes: ClassItem[]; allocations: Allocation[]; extraRequests: ExtraRequest[]; isLoading: boolean;
}) {
  const totalStudents = new Set(allocations.map((a) => a.studentId)).size;
  const total = allocations.length;
  const received = allocations.filter((a) => a.status === "received").length;
  const pending = total - received;
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  const pendingReqs = extraRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your classes and book distribution progress.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Classes</div>
              <div className="text-2xl font-bold font-heading text-primary">{isLoading ? "..." : classes.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Students</div>
              <div className="text-2xl font-bold font-heading text-blue-600">{isLoading ? "..." : totalStudents}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distributed</div>
              <div className="text-2xl font-bold font-heading text-emerald-600">{isLoading ? "..." : `${pct}%`}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</div>
              <div className="text-2xl font-bold font-heading text-amber-600">{isLoading ? "..." : pending}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      {(pending > 0 || pendingReqs > 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Package className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">{pending} books awaiting confirmation</p>
                  <p className="text-xs text-muted-foreground">Go to Book Distribution to confirm receipt</p>
                </div>
              </div>
            )}
            {pendingReqs > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{pendingReqs} extra copy request{pendingReqs !== 1 ? "s" : ""} pending</p>
                  <p className="text-xs text-muted-foreground">Awaiting admin approval</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DistributionSection({ classes, classesLoading }: { classes: ClassItem[]; classesLoading: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const assigned = classes?.find((c) => c.teacherId === user?.id);

  useEffect(() => {
    if (assigned && !selectedClassId) setSelectedClassId(assigned.id);
  }, [assigned, selectedClassId]);

  const activeClassId = selectedClassId || assigned?.id || (classes?.[0]?.id ?? "");

  const { data: allocations, isLoading: allocLoading } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations", activeClassId],
    queryFn: async () => {
      const r = await fetch(`/api/allocations?classId=${activeClassId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: !!activeClassId,
  });

  const confirmMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/allocations/${id}/confirm`); },
    onSuccess: () => { toast({ title: "Confirmed" }); queryClient.invalidateQueries({ queryKey: ["/api/allocations"] }); },
  });

  const absentMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/allocations/${id}/absent`); },
    onSuccess: () => { toast({ title: "Marked Absent" }); queryClient.invalidateQueries({ queryKey: ["/api/allocations"] }); },
  });

  const groups = useMemo(() => {
    if (!allocations) return [];
    const map = new Map<string, StudentGroup>();
    for (const a of allocations) {
      const e = map.get(a.studentId);
      if (e) {
        e.allocations.push(a);
        if (a.status === "received") e.receivedCount++;
        e.totalCount++;
        e.allReceived = e.receivedCount === e.totalCount;
      } else {
        const r = a.status === "received";
        map.set(a.studentId, { student: a.student, allocations: [a], receivedCount: r ? 1 : 0, totalCount: 1, allReceived: r });
      }
    }
    return Array.from(map.values());
  }, [allocations]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => g.student.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const total = allocations?.length ?? 0;
  const rcvd = allocations?.filter((a) => a.status === "received").length ?? 0;
  const pend = total - rcvd;
  const pct = total > 0 ? Math.round((rcvd / total) * 100) : 0;

  if (classesLoading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Book Distribution</h1>
          <p className="text-muted-foreground mt-1">Confirm textbook receipt and track absent students.</p>
        </div>
        {classes.length > 0 && (
          <div className="bg-card p-2 rounded-lg border border-border shadow-sm">
            <Select value={activeClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[220px] border-none bg-transparent shadow-none focus:ring-0">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.academicYear ? ` (${c.academicYear})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-muted-foreground">No Classes Assigned</h3>
            <p className="text-sm text-muted-foreground mt-1">Contact the administrator to be assigned to a class.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-none shadow-none">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Users className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Class Size</div>
                  <div className="text-2xl font-bold font-heading text-primary">{allocLoading ? "..." : groups.length}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/5 border-none shadow-none">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distributed</div>
                  <div className="text-2xl font-bold font-heading text-emerald-600">{allocLoading ? "..." : `${pct}%`}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-none shadow-none">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600"><BookOpen className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</div>
                  <div className="text-2xl font-bold font-heading text-amber-600">{allocLoading ? "..." : pend}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search student name..." className="pl-9 bg-card" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {allocLoading ? (
            <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading allocations...</p></div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-heading font-semibold text-muted-foreground">
                  {searchQuery ? "No Students Found" : "No Allocations"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? "No students matching your search." : "No book allocations for this class yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filtered.map((g) => (
                <Card key={g.student.id} className="overflow-hidden border-border hover:shadow-md transition-all">
                  <CardHeader className="bg-muted/30 pb-4 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {g.student.name}
                        {g.allReceived && <Badge className="bg-emerald-500/10 text-emerald-600 ml-2">All Received</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {g.student.studentCode || "No code"}{g.student.class ? ` • ${g.student.class.name}` : ""}
                      </CardDescription>
                    </div>
                    <div className="text-sm font-medium bg-card px-3 py-1 rounded-full border border-border">
                      {g.receivedCount} / {g.totalCount} Books
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {g.allocations.map((a) => {
                        const done = a.status === "received";
                        const abs = a.status === "absent";
                        const confirming = confirmMut.isPending && confirmMut.variables === a.id;
                        const marking = absentMut.isPending && absentMut.variables === a.id;
                        return (
                          <div key={a.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{a.book.title}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {a.book.isbn ? `ISBN: ${a.book.isbn}` : "No ISBN"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {done ? (
                                <Button variant="outline" size="sm" disabled className="text-emerald-600 border-emerald-200 bg-emerald-50 pointer-events-none">
                                  <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmed
                                </Button>
                              ) : abs ? (
                                <Button variant="outline" size="sm" disabled className="text-red-600 border-red-200 bg-red-50 pointer-events-none">
                                  <AlertTriangle className="w-4 h-4 mr-1" /> Absent
                                </Button>
                              ) : (
                                <>
                                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={marking || confirming} onClick={() => absentMut.mutate(a.id)}>
                                    <AlertTriangle className="w-4 h-4 mr-1" />{marking ? "..." : "Absent"}
                                  </Button>
                                  <Button variant="default" size="sm" disabled={confirming || marking}
                                    onClick={() => confirmMut.mutate(a.id)}>
                                    <Circle className="w-4 h-4 mr-1" />{confirming ? "..." : "Confirm"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExtraRequestsSection({ classes }: { classes: ClassItem[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [fClass, setFClass] = useState("");
  const [fBook, setFBook] = useState("");
  const [fReason, setFReason] = useState("");
  const [fQty, setFQty] = useState("1");
  const [fNotes, setFNotes] = useState("");

  const { data: requests, isLoading } = useQuery<ExtraRequest[]>({
    queryKey: ["/api/extra-requests"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: books } = useQuery<BookItem[]>({
    queryKey: ["/api/books"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const resetForm = () => {
    setFClass(""); setFBook(""); setFReason(""); setFQty("1"); setFNotes("");
  };

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/extra-requests", {
        classId: fClass, bookId: fBook, reason: fReason,
        quantity: parseInt(fQty) || 1, notes: fNotes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Request Submitted", description: "Your extra copy request has been sent to the admin." });
      setOpen(false); resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/extra-requests"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const pendingR = requests?.filter((r) => r.status === "pending") || [];
  const resolvedR = requests?.filter((r) => r.status !== "pending") || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Extra Copy Requests</h1>
          <p className="text-muted-foreground mt-1">Request additional book copies from the school admin.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : !requests || requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-muted-foreground">No Requests Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Submit your first extra copy request when you need additional books.
            </p>
            <Button onClick={() => setOpen(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> New Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingR.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Review</h2>
              <Card className="border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-6">Book</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right px-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingR.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="px-6 font-medium">{r.book?.title || "—"}</TableCell>
                          <TableCell>{r.class?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {REASONS.find((x) => x.value === r.reason)?.label || r.reason}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{r.quantity}</TableCell>
                          <TableCell className="text-right px-6"><StatusBadge status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
          {resolvedR.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resolved</h2>
              <Card className="border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-6">Book</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead>Admin Notes</TableHead>
                        <TableHead className="text-right px-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedR.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="px-6 font-medium">{r.book?.title || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {REASONS.find((x) => x.value === r.reason)?.label || r.reason}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{r.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.adminNotes || "—"}</TableCell>
                          <TableCell className="text-right px-6"><StatusBadge status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">New Extra Copy Request</DialogTitle>
            <DialogDescription>
              Request additional book copies for a class. The admin will review and approve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Class</label>
              <Select value={fClass} onValueChange={setFClass}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Book</label>
              <Select value={fBook} onValueChange={setFBook}>
                <SelectTrigger><SelectValue placeholder="Select a book" /></SelectTrigger>
                <SelectContent>
                  {(books || []).map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Select value={fReason} onValueChange={setFReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity</label>
              <Input type="number" min="1" max="50" value={fQty} onChange={(e) => setFQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea placeholder="Additional details..." value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!fClass || !fBook || !fReason || createMut.isPending}>
              {createMut.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MessageThread {
  id: string;
  subject: string;
  status: "open" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  parentUserId: string;
  teacherUserId: string;
  studentId: string;
  parentName: string;
  teacherName: string;
  studentName: string;
  studentClassId: string | null;
  totalMessages: number;
  unreadByParent: number;
  unreadByTeacher: number;
  lastMessage?: {
    senderRole: "parent" | "teacher" | "admin";
    body: string;
    createdAt: string;
  } | null;
}

interface ThreadDetail {
  thread: MessageThread & { parentEmail?: string; teacherEmail?: string };
  messages: ThreadMessage[];
}

interface ThreadMessage {
  id: string;
  threadId: string;
  senderUserId: string;
  senderRole: "parent" | "teacher" | "admin";
  body: string;
  isRead: boolean;
  createdAt: string;
}

function TeacherMessagesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const { data: threads, isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ["/api/teacher/message-threads"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

  const { data: threadDetail, isLoading: detailLoading } = useQuery<ThreadDetail>({
    queryKey: ["/api/teacher/message-threads", selectedThreadId],
    queryFn: async () => {
      const r = await fetch(`/api/teacher/message-threads/${selectedThreadId}`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: selectedThreadId ? 8000 : false,
  });

  // Auto-scroll when messages change
  const messageCount = threadDetail?.messages?.length ?? 0;
  useEffect(() => {
    if (messageCount > 0) scrollToBottom();
  }, [messageCount, selectedThreadId]);

  const replyMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/teacher/message-threads/${selectedThreadId}/messages`, { body: replyBody });
    },
    onSuccess: () => {
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/message-threads", selectedThreadId] }).then(scrollToBottom);
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/message-threads"] });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    },
  });

  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.parentName.toLowerCase().includes(q) ||
        t.studentName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  // Thread detail view
  if (selectedThreadId) {
    const thread = threadDetail?.thread;
    const messages = threadDetail?.messages || [];
    const isClosed = thread?.status === "closed";

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedThreadId(null); setReplyBody(""); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Messages
          </Button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading conversation...</p>
          </div>
        ) : thread ? (
          <>
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-heading">{thread.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      Parent: {thread.parentName} &middot; Student: {thread.studentName}
                    </CardDescription>
                  </div>
                  <Badge className={thread.status === "open" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}>
                    {thread.status === "open" ? "Open" : "Closed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent ref={messagesContainerRef} className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">No messages in this conversation yet.</p>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.senderRole === "teacher";
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-4 py-3 ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted border border-border"
                        }`}>
                          <div className={`text-xs font-medium mb-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {isOwn ? "You" : thread.parentName}
                            {msg.senderRole === "admin" && " (Admin)"}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className={`text-xs mt-2 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </CardContent>
            </Card>

            {isClosed ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">This conversation has been closed. No further replies can be sent.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => replyMut.mutate()}
                        disabled={!replyBody.trim() || replyMut.isPending}
                        className="gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {replyMut.isPending ? "Sending..." : "Send Reply"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-heading font-semibold text-muted-foreground">Thread Not Found</h3>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Thread list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Parent Messages</h1>
        <p className="text-muted-foreground mt-1">Secure communication with parents regarding their children.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by parent or student name..."
          className="pl-9 bg-card"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {threadsLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      ) : filteredThreads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-muted-foreground">
              {searchQuery ? "No Matching Conversations" : "No Messages Yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchQuery
                ? "No conversations match your search criteria."
                : "When parents send messages about their children, they will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0 divide-y divide-border">
            {filteredThreads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors flex items-start gap-4"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium truncate ${t.unreadByTeacher > 0 ? "text-foreground font-semibold" : "text-foreground"}`}>
                      {t.subject}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={t.status === "open" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}>
                        {t.status === "open" ? "Open" : "Closed"}
                      </Badge>
                      {t.unreadByTeacher > 0 && (
                        <Badge className="bg-primary text-primary-foreground">{t.unreadByTeacher}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Parent: {t.parentName} &middot; Student: {t.studentName}
                  </div>
                  {t.lastMessage && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {t.lastMessage.senderRole === "teacher" ? "You: " : ""}{t.lastMessage.body}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    {t.lastMessage ? formatTime(t.lastMessage.createdAt) : formatTime(t.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TeacherPage({ section = "dashboard" }: { section?: string }) {
  const { data: classes, isLoading: classesLoading } = useQuery<ClassItem[]>({
    queryKey: ["/api/classes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allAlloc } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: extraReqs } = useQuery<ExtraRequest[]>({
    queryKey: ["/api/extra-requests"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const c = classes || [];
  const a = allAlloc || [];
  const r = extraReqs || [];

  switch (section) {
    case "distribution":
      return <DistributionSection classes={c} classesLoading={classesLoading} />;
    case "requests":
      return <ExtraRequestsSection classes={c} />;
    case "messages":
      return <TeacherMessagesSection />;
    default:
      return <DashboardSection classes={c} allocations={a} extraRequests={r} isLoading={classesLoading} />;
  }
}
