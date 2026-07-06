import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, X, Loader2, MessageSquare, XCircle, RefreshCw, Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./shared";

// ─── COMMUNICATIONS (master-detail redesign) ────────────────────────────────
function CommunicationsSection() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/communications", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await apiRequest("GET", `/api/admin/communications${params}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: threadDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/admin/communications", selectedThreadId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/communications/${selectedThreadId}`);
      return res.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: selectedThreadId ? 8000 : false,
  });

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

  const statusTone = (status: string) =>
    status === "open" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : status === "closed" ? "bg-muted text-muted-foreground border-border"
    : "bg-amber-100 text-amber-700 border-amber-200";

  const counts = {
    open: threads.filter((t: any) => t.status === "open").length,
    closed: threads.filter((t: any) => t.status === "closed").length,
    archived: threads.filter((t: any) => t.status === "archived").length,
  };

  const thread = threadDetail?.thread;
  const messages = threadDetail?.messages || [];

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Communication Oversight
        </h1>
        <p className="text-muted-foreground mt-1">Monitor and manage all parent-teacher conversations across the school.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open", value: counts.open, tone: "text-emerald-600" },
          { label: "Closed", value: counts.closed, tone: "text-foreground" },
          { label: "Archived", value: counts.archived, tone: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={cn("text-2xl font-bold mt-0.5", k.tone)}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        {/* Thread list */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search name or subject…" className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {threadsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredThreads.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{searchQuery ? "No threads match your search." : "No communication threads found."}</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredThreads.map((t: any) => (
                <button key={t.id} onClick={() => setSelectedThreadId(t.id)} className={cn("w-full text-left px-5 py-3 hover:bg-muted/20", selectedThreadId === t.id && "bg-primary/5")}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground truncate">{t.subject || "No Subject"}</span>
                    <Badge variant="outline" className={cn("shrink-0", statusTone(t.status))}>{t.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>{t.parentName || "—"} ↔ {t.teacherName || "—"}</span>
                    <span>·</span>
                    <span>{t.studentName || "—"}</span>
                    <span>·</span>
                    <span>{t.totalMessages ?? 0} msg</span>
                    <span>·</span>
                    <span>{formatDateTime(t.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit lg:sticky lg:top-4">
          {!selectedThreadId ? (
            <div className="text-center py-12"><MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select a thread to read messages and manage it.</p></div>
          ) : detailLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !thread ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Thread not found.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{thread.subject || "No Subject"}</div>
                  <Badge variant="outline" className={cn("mt-1", statusTone(thread.status))}>{thread.status}</Badge>
                </div>
                <button onClick={() => setSelectedThreadId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Parent</div><div className="text-foreground">{thread.parentName || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Teacher</div><div className="text-foreground">{thread.teacherName || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Student</div><div className="text-foreground">{thread.studentName || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Created</div><div className="text-foreground text-xs">{formatDateTime(thread.createdAt)}</div></div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-border pt-3">
                {thread.status !== "closed" && (
                  <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ threadId: thread.id, status: "closed" })}>
                    <XCircle className="h-4 w-4 mr-1" /> Close
                  </Button>
                )}
                {thread.status === "closed" && (
                  <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ threadId: thread.id, status: "open" })}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reopen
                  </Button>
                )}
                {thread.status !== "archived" && (
                  <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ threadId: thread.id, status: "archived" })}>
                    <Archive className="h-4 w-4 mr-1" /> Archive
                  </Button>
                )}
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-2">Messages ({messages.length})</div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No messages in this thread.</p>}
                  {messages.map((msg: any) => (
                    <div key={msg.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs text-foreground">{msg.senderName || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { CommunicationsSection };
