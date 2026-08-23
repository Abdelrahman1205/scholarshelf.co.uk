import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Loader2, Search, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

// ─── PARENT INVITES / LINKING CODES (redesign) ──────────────────────────────
function LinkingCodesSection() {
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const counts = {
    total: codes.length,
    linked: codes.filter((c: any) => c.isUsed).length,
    pending: codes.filter((c: any) => !c.isUsed).length,
  };

  const filtered = codes.filter((c: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.student?.name?.toLowerCase().includes(q) || c.parentEmail?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" ? true : statusFilter === "linked" ? c.isUsed : !c.isUsed;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Parent Invites</h1>
        <p className="text-muted-foreground mt-1">
          Invites are sent automatically when a student is added with a parent email. Use <strong>Resend</strong> if a parent lost or didn't receive their email.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Invites", value: counts.total, tone: "text-foreground" },
          { label: "Linked", value: counts.linked, tone: "text-emerald-600" },
          { label: "Pending", value: counts.pending, tone: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={cn("text-2xl font-bold mt-0.5", k.tone)}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search student or email…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Student</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Parent Email</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider">Expires</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((code: any) => (
              <TableRow key={code.id}>
                <TableCell className="font-medium">{code.student?.name || "Unknown"}</TableCell>
                <TableCell className="text-muted-foreground">{code.parentEmail}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={code.isUsed ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                    {code.isUsed ? "Linked" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{code.expiresAt ? formatDate(code.expiresAt) : "—"}</TableCell>
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
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                <LinkIcon className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                {codes.length === 0 ? "No invites sent yet. Add a student with a parent email to get started." : "No matching invites."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { LinkingCodesSection };
