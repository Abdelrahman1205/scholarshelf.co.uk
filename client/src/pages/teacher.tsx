import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, Circle, Users, BookOpen, Package } from "lucide-react";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface ClassItem {
  id: string;
  name: string;
  academicYear: string | null;
  teacherId: string | null;
}

interface Allocation {
  id: string;
  studentId: string;
  bookId: string;
  basketId: string | null;
  status: "allocated" | "received";
  allocatedAt: string | null;
  receivedAt: string | null;
  student: {
    id: string;
    name: string;
    studentCode: string | null;
    class: {
      id: string;
      name: string;
    } | null;
  };
  book: {
    id: string;
    title: string;
    isbn: string | null;
  };
}

interface StudentGroup {
  student: Allocation["student"];
  allocations: Allocation[];
  receivedCount: number;
  totalCount: number;
  allReceived: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: classes, isLoading: classesLoading } = useQuery<ClassItem[]>({
    queryKey: ["/api/classes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const assignedClass = classes?.find((c) => c.teacherId === user?.id);

  useEffect(() => {
    if (assignedClass && !selectedClassId) {
      setSelectedClassId(assignedClass.id);
    }
  }, [assignedClass, selectedClassId]);

  const activeClassId = selectedClassId || assignedClass?.id || (classes?.[0]?.id ?? "");

  const { data: allocations, isLoading: allocationsLoading } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations", `?classId=${activeClassId}`],
    queryFn: async () => {
      const res = await fetch(`/api/allocations?classId=${activeClassId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!activeClassId,
  });

  const confirmMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      await apiRequest("POST", `/api/allocations/${allocationId}/confirm-receipt`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
    },
  });

  const studentGroups = useMemo(() => {
    if (!allocations) return [];
    const groupMap = new Map<string, StudentGroup>();
    for (const alloc of allocations) {
      const existing = groupMap.get(alloc.studentId);
      if (existing) {
        existing.allocations.push(alloc);
        if (alloc.status === "received") existing.receivedCount++;
        existing.totalCount++;
        existing.allReceived = existing.receivedCount === existing.totalCount;
      } else {
        const isReceived = alloc.status === "received";
        groupMap.set(alloc.studentId, {
          student: alloc.student,
          allocations: [alloc],
          receivedCount: isReceived ? 1 : 0,
          totalCount: 1,
          allReceived: isReceived,
        });
      }
    }
    return Array.from(groupMap.values());
  }, [allocations]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return studentGroups;
    const q = searchQuery.toLowerCase();
    return studentGroups.filter((g) => g.student.name.toLowerCase().includes(q));
  }, [studentGroups, searchQuery]);

  const uniqueStudents = studentGroups.length;
  const totalAllocations = allocations?.length ?? 0;
  const receivedAllocations = allocations?.filter((a) => a.status === "received").length ?? 0;
  const pendingAllocations = totalAllocations - receivedAllocations;
  const distributedPercent = totalAllocations > 0 ? Math.round((receivedAllocations / totalAllocations) * 100) : 0;

  const isLoading = classesLoading || allocationsLoading;

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="loading-state">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Teacher Portal
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-page-subtitle">
            Confirm textbook receipt for your students.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border shadow-sm">
          {classes && classes.length > 0 ? (
            <Select
              value={activeClassId}
              onValueChange={setSelectedClassId}
            >
              <SelectTrigger className="w-[220px] border-none bg-transparent shadow-none focus:ring-0" data-testid="select-class">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id} data-testid={`select-class-option-${cls.id}`}>
                    {cls.name}{cls.academicYear ? ` (${cls.academicYear})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground px-3" data-testid="text-no-classes">No classes available</span>
          )}
        </div>
      </div>

      {!classes || classes.length === 0 ? (
        <Card className="border-dashed" data-testid="empty-state-no-classes">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-muted-foreground">No Classes Found</h3>
            <p className="text-sm text-muted-foreground mt-1">There are no classes set up yet. Please contact the administrator.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary/5 border-none shadow-none" data-testid="stat-class-size">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Class Size</div>
                  <div className="text-2xl font-bold font-heading text-primary" data-testid="text-class-size">
                    {allocationsLoading ? "..." : `${uniqueStudents} Student${uniqueStudents !== 1 ? "s" : ""}`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-500/5 border-none shadow-none" data-testid="stat-books-distributed">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Books Distributed</div>
                  <div className="text-2xl font-bold font-heading text-emerald-600" data-testid="text-books-distributed">
                    {allocationsLoading ? "..." : `${distributedPercent}%`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-none shadow-none" data-testid="stat-pending-receipt">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Pending Receipt</div>
                  <div className="text-2xl font-bold font-heading text-amber-600" data-testid="text-pending-receipt">
                    {allocationsLoading ? "..." : `${pendingAllocations} Book${pendingAllocations !== 1 ? "s" : ""}`}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search student name..."
              className="pl-9 bg-card"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-student"
            />
          </div>

          {allocationsLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="loading-allocations">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <Card className="border-dashed" data-testid="empty-state-no-allocations">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-heading font-semibold text-muted-foreground">
                  {searchQuery ? "No Students Found" : "No Allocations"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? `No students matching "${searchQuery}" in this class.`
                    : "No book allocations found for this class yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <Card
                  key={group.student.id}
                  className="overflow-hidden border-border transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500"
                  data-testid={`card-student-${group.student.id}`}
                >
                  <CardHeader className="bg-muted/30 pb-4 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-student-name-${group.student.id}`}>
                        {group.student.name}
                        {group.allReceived && (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 ml-2"
                            data-testid={`badge-all-received-${group.student.id}`}
                          >
                            All Received
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription data-testid={`text-student-info-${group.student.id}`}>
                        {group.student.studentCode ? `${group.student.studentCode}` : "No code"}
                        {group.student.class ? ` • ${group.student.class.name}` : ""}
                      </CardDescription>
                    </div>
                    <div
                      className="text-sm font-medium bg-card px-3 py-1 rounded-full border border-border"
                      data-testid={`text-book-count-${group.student.id}`}
                    >
                      {group.receivedCount} / {group.totalCount} Books
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {group.allocations.map((alloc) => {
                        const isReceived = alloc.status === "received";
                        const isConfirming = confirmMutation.isPending && confirmMutation.variables === alloc.id;
                        return (
                          <div
                            key={alloc.id}
                            className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
                            data-testid={`row-allocation-${alloc.id}`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-sm" data-testid={`text-book-title-${alloc.id}`}>
                                {alloc.book.title}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono" data-testid={`text-book-isbn-${alloc.id}`}>
                                {alloc.book.isbn ? `ISBN: ${alloc.book.isbn}` : "No ISBN"}
                              </span>
                            </div>
                            {isReceived ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 pointer-events-none"
                                data-testid={`button-confirmed-${alloc.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmed
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-2"
                                disabled={isConfirming}
                                onClick={() => confirmMutation.mutate(alloc.id)}
                                data-testid={`button-confirm-${alloc.id}`}
                              >
                                <Circle className="w-4 h-4 mr-1" />
                                {isConfirming ? "Confirming..." : "Confirm Receipt"}
                              </Button>
                            )}
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
