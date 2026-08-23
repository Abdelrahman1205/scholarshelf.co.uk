import { useState, useMemo } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── BOOK BUNDLES — ScholarShelf design (list view + details + assign flow) ──

async function fetchLevelItems(levelId: string) {
  const res = await fetch(`/api/book-levels/${levelId}/items`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function BookLevelsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [addItemForm, setAddItemForm] = useState({ bookId: "", quantity: 1 });
  const [assignForm, setAssignForm] = useState({ classId: "", bookLevelId: "" });
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: levels = [] } = useQuery<any[]>({ queryKey: ["/api/book-levels"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: classBookLevels = [] } = useQuery<any[]>({ queryKey: ["/api/class-book-levels"], queryFn: getQueryFn({ on401: "throw" }) });

  // Item lists for every bundle (bundle counts are small) — powers "Books Included" column
  const itemQueries = useQueries({
    queries: levels.map((l: any) => ({
      queryKey: ["/api/book-levels", l.id, "items"],
      queryFn: () => fetchLevelItems(l.id),
      staleTime: 30_000,
    })),
  });
  const itemsByLevel: Record<string, any[]> = useMemo(() => {
    const map: Record<string, any[]> = {};
    levels.forEach((l: any, i: number) => { map[l.id] = (itemQueries[i]?.data as any[]) || []; });
    return map;
  }, [levels, itemQueries]);

  const createLevelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddOpen(false); setForm({ name: "", description: "" }); toast({ title: "Bundle created" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { levelId: string; bookId: string; quantity: number }) => apiRequest("POST", `/api/book-levels/${data.levelId}/items`, { bookId: data.bookId, quantity: data.quantity }),
    onSuccess: (_r, vars) => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels", vars.levelId, "items"] }); queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); setAddItemForm({ bookId: "", quantity: 1 }); toast({ title: "Book added to bundle" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/book-level-items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/book-levels"] }); queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "/api/book-levels" }); toast({ title: "Book removed from bundle" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/class-book-levels", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); setAssignOpen(false); setAssignForm({ classId: "", bookLevelId: "" }); toast({ title: "Bundle assigned to class" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  /**
   * C3: removing a class↔bundle assignment fired straight from an unlabelled
   * icon — no confirmation, no undo. That single click changes what an entire
   * class is billed for, and the two places it appears (a small × in a list and
   * a smaller × in a chip) are the easiest things on the page to hit by mistake.
   *
   * Confirm names the class and the bundle, so a misclick is caught by reading
   * rather than by remembering what was under the cursor.
   */
  const [pendingRemoval, setPendingRemoval] = useState<any>(null);

  const removeAssignmentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/class-book-levels/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/class-book-levels"] }); toast({ title: "Assignment removed" }); setPendingRemoval(null); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const selectedLevel = levels.find((l: any) => l.id === selectedLevelId) || null;
  const selectedItems = selectedLevelId ? itemsByLevel[selectedLevelId] || [] : [];
  const selectedAssignments = classBookLevels.filter((cbl: any) => cbl.bookLevelId === selectedLevelId || cbl.bookLevel?.id === selectedLevelId);
  const bundleValue = (items: any[]) => items.reduce((s, it) => s + (it.quantity || 1) * parseFloat(it.book?.price || "0"), 0);
  const totalBooksIncluded = Object.values(itemsByLevel).reduce((s, items) => s + items.reduce((a, it) => a + (it.quantity || 1), 0), 0);

  const assignBundle = levels.find((l: any) => l.id === assignForm.bookLevelId);
  const assignClass = classes.find((c: any) => c.id === assignForm.classId);

  const stats = [
    { icon: "library_books", label: "Total Bundles", value: levels.length, sub: null },
    { icon: "assignment_ind", label: "Class Assignments", value: classBookLevels.length, sub: null },
    { icon: "auto_stories", label: "Books Included", value: totalBooksIncluded, sub: "Across all sets" },
    { icon: "menu_book", label: "Books Catalogued", value: books.length, sub: null },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>Books &amp; Stock</span>
          <MaterialSymbol name="chevron_right" className="text-sm" />
          <span className="text-foreground font-medium">Bundles</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Book Bundles</h1>
            <p className="text-muted-foreground mt-1">Manage curated reading sets and textbook collections for all academic levels.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setAssignForm({ classId: "", bookLevelId: selectedLevelId || "" }); setAssignOpen(true); }}>
              <MaterialSymbol name="assignment_ind" className="text-base mr-2" /> Assign to Class
            </Button>
            <Button onClick={() => { setForm({ name: "", description: "" }); setAddOpen(true); }}>
              <MaterialSymbol name="add" className="text-base mr-2" /> Create New Bundle
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-secondary-container text-on-secondary-container">
                <MaterialSymbol name={k.icon} className="text-xl" />
              </span>
            </div>
            <div className="text-2xl font-bold mt-3 text-foreground">{k.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}{k.sub && <span className="text-muted-foreground/60"> · {k.sub}</span>}</div>
          </div>
        ))}
      </div>

      {/* Bundle table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-sm">
          <span className="text-muted-foreground">Showing</span> <strong className="text-foreground">{levels.length}</strong> <span className="text-muted-foreground">bundle{levels.length !== 1 ? "s" : ""}</span>
        </div>
        {levels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MaterialSymbol name="library_books" className="text-5xl text-muted-foreground/30" />
            <h3 className="text-base font-semibold text-muted-foreground mt-3">No Bundles</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a bundle to group books together for classes.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}><MaterialSymbol name="add" className="text-base mr-2" /> Create First Bundle</Button>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-container-low">
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Bundle Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Books Included</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Total Value</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Assigned Classes</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level: any) => {
                  const items = itemsByLevel[level.id] || [];
                  const bookCount = items.reduce((s, it) => s + (it.quantity || 1), 0);
                  const assignCount = classBookLevels.filter((cbl: any) => cbl.bookLevelId === level.id || cbl.bookLevel?.id === level.id).length;
                  const active = selectedLevelId === level.id;
                  return (
                    <tr key={level.id} onClick={() => setSelectedLevelId(active ? null : level.id)} className={cn("border-b border-border last:border-0 cursor-pointer hover:bg-surface-container-low transition-colors", active && "bg-secondary-container/30")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-secondary-container text-on-secondary-container shrink-0">
                            <MaterialSymbol name="auto_stories" className="text-lg" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{level.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{level.description || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{bookCount} Book{bookCount !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3 text-sm font-medium hidden md:table-cell">£{bundleValue(items).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", assignCount > 0 ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-muted-foreground")}>
                          {assignCount > 0 ? `${assignCount} Class${assignCount !== 1 ? "es" : ""}` : "Unassigned"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setAssignForm({ classId: "", bookLevelId: level.id }); setAssignOpen(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-container hover:text-foreground transition-colors" aria-label="Assign bundle">
                          <MaterialSymbol name="assignment_ind" className="text-lg" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedLevelId(active ? null : level.id); }} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-container hover:text-foreground transition-colors" aria-label="Bundle details">
                          <MaterialSymbol name={active ? "expand_less" : "expand_more"} className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bundle details — design: Bundle Details & Assignments */}
      {selectedLevel && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border bg-surface-container-low">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">Active Resource</span>
                <h2 className="text-xl font-bold text-foreground mt-2">{selectedLevel.name}</h2>
                {selectedLevel.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{selectedLevel.description}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => { setAssignForm({ classId: "", bookLevelId: selectedLevel.id }); setAssignOpen(true); }}>
                  <MaterialSymbol name="add_circle" className="text-base mr-2" /> Assign to Class
                </Button>
                <button onClick={() => setSelectedLevelId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-container hover:text-foreground" aria-label="Close details"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 max-w-md">
              <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Total Books</div><div className="text-lg font-bold text-foreground">{selectedItems.reduce((s: number, it: any) => s + (it.quantity || 1), 0)}</div></div>
              <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Total Value</div><div className="text-lg font-bold text-foreground">£{bundleValue(selectedItems).toFixed(2)}</div></div>
              <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Assigned Classes</div><div className="text-lg font-bold text-foreground">{String(selectedAssignments.length).padStart(2, "0")}</div></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Included books */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <MaterialSymbol name="library_books" className="text-lg text-on-secondary-container" />
                <h3 className="font-semibold text-foreground text-sm">Included Books ({selectedItems.length})</h3>
              </div>
              {selectedItems.length > 0 ? (
                <div className="space-y-2">
                  {selectedItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container text-muted-foreground shrink-0">
                        <MaterialSymbol name="menu_book" className="text-base" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-foreground truncate">{item.book?.title || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">Qty {item.quantity} · £{parseFloat(item.book?.price || "0").toFixed(2)}</div>
                      </div>
                      <button onClick={() => removeItemMutation.mutate(item.id)} disabled={removeItemMutation.isPending} className="p-1.5 rounded-lg text-muted-foreground hover:bg-error-container hover:text-on-error-container transition-colors" aria-label="Remove book">
                        <MaterialSymbol name="close" className="text-base" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No books in this bundle yet.</p>
              )}
              {/* Add book row */}
              <div className="flex gap-2 items-end mt-4 pt-4 border-t border-border">
                <div className="flex-1">
                  <Label className="text-xs">Add Book to Bundle</Label>
                  <Select value={addItemForm.bookId} onValueChange={(v) => setAddItemForm({ ...addItemForm, bookId: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select book" /></SelectTrigger>
                    <SelectContent>{books.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min="1" className="h-9" value={addItemForm.quantity} onChange={(e) => setAddItemForm({ ...addItemForm, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <Button size="sm" className="h-9" onClick={() => addItemMutation.mutate({ levelId: selectedLevel.id, bookId: addItemForm.bookId, quantity: addItemForm.quantity })} disabled={!addItemForm.bookId || addItemMutation.isPending}>
                  <MaterialSymbol name="add_circle" className="text-base mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Active assignments */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <MaterialSymbol name="assignment_ind" className="text-lg text-on-secondary-container" />
                <h3 className="font-semibold text-foreground text-sm">Active Assignments ({selectedAssignments.length})</h3>
              </div>
              {selectedAssignments.length > 0 ? (
                <div className="space-y-2">
                  {selectedAssignments.map((cbl: any) => (
                    <div key={cbl.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant shrink-0">
                        <MaterialSymbol name="school" className="text-base" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-foreground truncate">{cbl.class?.name || "?"}</div>
                        <div className="text-xs text-muted-foreground">Assigned bundle: {cbl.bookLevel?.name || selectedLevel.name}</div>
                      </div>
                      <button onClick={() => setPendingRemoval(cbl)} disabled={removeAssignmentMutation.isPending} className="p-1.5 rounded-lg text-muted-foreground hover:bg-error-container hover:text-on-error-container transition-colors" aria-label={`Remove ${cbl.bookLevel?.name || "bundle"} from ${cbl.class?.name || "class"}`} title={`Remove ${cbl.bookLevel?.name || "bundle"} from ${cbl.class?.name || "class"}`}>
                        <MaterialSymbol name="close" className="text-base" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Not assigned to any class yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All class assignments (compact) */}
      {!selectedLevel && classBookLevels.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MaterialSymbol name="assignment_ind" className="text-lg text-on-secondary-container" />
            <h3 className="font-semibold text-foreground text-sm">Class Assignments</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {classBookLevels.map((cbl: any) => (
              <span key={cbl.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-container-low py-1 px-3 text-xs">
                <span className="font-medium text-foreground">{cbl.class?.name || "?"}</span>
                <MaterialSymbol name="arrow_forward" className="text-xs text-muted-foreground" />
                <span className="text-muted-foreground">{cbl.bookLevel?.name || "?"}</span>
                <button
                  onClick={() => setPendingRemoval(cbl)}
                  disabled={removeAssignmentMutation.isPending}
                  className="ml-0.5 rounded-full text-muted-foreground hover:text-on-error-container transition-colors"
                  aria-label={`Remove ${cbl.bookLevel?.name || "bundle"} from ${cbl.class?.name || "class"}`}
                  title={`Remove ${cbl.bookLevel?.name || "bundle"} from ${cbl.class?.name || "class"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Create bundle dialog — design: Bundle Identity */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MaterialSymbol name="info" className="text-xl text-on-secondary-container" /> Bundle Identity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Bundle Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Year 3 Core Reading Set" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Standardized curriculum pack" />
            </div>
            <div className="rounded-lg bg-secondary-container/40 border border-secondary-container p-3 flex gap-2 text-xs text-on-secondary-container">
              <MaterialSymbol name="verified" className="text-base shrink-0" />
              <span>After creating the bundle, add books to it from the bundle details panel, then assign it to classes.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Discard</Button>
            <Button onClick={() => createLevelMutation.mutate(form)} disabled={!form.name.trim() || createLevelMutation.isPending}>
              <MaterialSymbol name="save" className="text-base mr-2" />{createLevelMutation.isPending ? "Creating…" : "Save Bundle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign flow dialog — design: Assign Bundle (select → review) */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MaterialSymbol name="assignment_ind" className="text-xl text-on-secondary-container" /> Assign Bundle</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">01 · Select Bundle</Label>
              <Select value={assignForm.bookLevelId} onValueChange={(v) => setAssignForm({ ...assignForm, bookLevelId: v })}>
                <SelectTrigger><SelectValue placeholder="Select bundle" /></SelectTrigger>
                <SelectContent>{levels.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">02 · Select Target Class</Label>
              <Select value={assignForm.classId} onValueChange={(v) => setAssignForm({ ...assignForm, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {assignBundle && assignClass && (
              <div className="rounded-lg border border-border bg-surface-container-low p-3 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MaterialSymbol name="fact_check" className="text-sm" /> Final Review</div>
                <div className="text-sm text-foreground"><strong>{assignBundle.name}</strong> ({(itemsByLevel[assignBundle.id] || []).reduce((s: number, it: any) => s + (it.quantity || 1), 0)} books) → <strong>{assignClass.name}</strong></div>
                <div className="text-xs text-muted-foreground">Allocations will be created for every student in this class.</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Back</Button>
            <Button onClick={() => assignMutation.mutate(assignForm)} disabled={!assignForm.classId || !assignForm.bookLevelId || assignMutation.isPending}>
              <MaterialSymbol name="check_circle" className="text-base mr-2" />{assignMutation.isPending ? "Assigning…" : "Finalize Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C3: confirmation for the one click that rebills a whole class. */}
      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => { if (!open) setPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingRemoval?.bookLevel?.name || "this bundle"} from{" "}
              {pendingRemoval?.class?.name || "this class"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every pupil in {pendingRemoval?.class?.name || "this class"} will stop being billed for
              this bundle&rsquo;s books. Orders already placed are not affected. You can assign the
              bundle again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemoval && removeAssignmentMutation.mutate(pendingRemoval.id)}
              disabled={removeAssignmentMutation.isPending}
            >
              {removeAssignmentMutation.isPending ? "Removing…" : "Remove assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { BookLevelsSection };
