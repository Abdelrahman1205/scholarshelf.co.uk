import { useQuery } from "@tanstack/react-query";
import { Loader2, GraduationCap, BookOpen, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getQueryFn } from "@/lib/queryClient";
import { navigateTo } from "./shared";

// Rich student profile — assigned class, family, book list (bundle) and
// distribution/allocation status. Rendered inside the Students detail panel
// (reached via the family profile drill-in or the roster).
function StudentProfilePanel({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/students/${studentId}/profile`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!studentId,
  });

  if (isLoading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const s = data.student || {};
  const mono = "text-[10px] font-mono uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-3">
      {/* Academic details */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-lg border border-border p-3">
        <div><div className={mono}>Grade</div><div className="text-sm text-foreground">{s.gradeLevel || "—"}</div></div>
        <div><div className={mono}>Reading Level</div><div className="text-sm text-foreground">{s.preferredReadingLevel || "—"}</div></div>
        <div><div className={mono}>Date of Birth</div><div className="text-sm text-foreground">{s.dateOfBirth || "—"}</div></div>
        <div><div className={mono}>Gender</div><div className="text-sm text-foreground">{s.gender || "—"}</div></div>
        <div><div className={mono}>Class</div><div className="text-sm text-foreground">{data.class?.name || "No class"}</div></div>
        <div><div className={mono}>Status</div><div className="text-sm text-foreground capitalize">{s.status || "active"}</div></div>
      </div>

      {/* Family */}
      {data.family && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Home className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">{data.family.householdName}</span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">{data.family.familyCode}</span>
            </div>
            <button className="text-xs text-primary hover:underline shrink-0" onClick={() => navigateTo("/admin/families")}>Open family</button>
          </div>
          {(data.guardians || []).length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">Guardians: {data.guardians.map((g: any) => g.fullName).join(", ")}</div>
          )}
        </div>
      )}

      {/* Book list (bundle for the class) */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4 text-primary" /><span className="text-sm font-medium text-foreground">Book list{data.bundleName ? ` · ${data.bundleName}` : ""}</span></div>
        {(data.bookList || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No bundle assigned to this class yet.</p>
        ) : (
          <ul className="space-y-1">
            {data.bookList.map((b: any, i: number) => (
              <li key={i} className="text-xs text-foreground flex items-center justify-between"><span className="truncate">{b.title}</span><span className="text-muted-foreground shrink-0 ml-2">×{b.quantity}</span></li>
            ))}
          </ul>
        )}
      </div>

      {/* Distribution / allocations */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /> Distribution</span>
          <span className="text-xs text-muted-foreground">{data.allocationSummary?.received || 0}/{data.allocationSummary?.total || 0} received</span>
        </div>
        {(data.allocations || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No books allocated yet.</p>
        ) : (
          <ul className="space-y-1">
            {data.allocations.map((a: any, i: number) => (
              <li key={i} className="text-xs flex items-center justify-between gap-2">
                <span className="text-foreground truncate">{a.book}</span>
                <Badge variant="outline" className={(a.status === "received" || a.distributionStatus === "received") ? "bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0" : "shrink-0"}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { StudentProfilePanel };
