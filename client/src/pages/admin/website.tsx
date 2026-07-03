import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Globe, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const SECTION_TYPES = [
  { value: "hero", label: "Hero / Welcome" },
  { value: "about", label: "About the School" },
  { value: "announcement", label: "Announcement / News" },
  { value: "contact", label: "Contact Block" },
  { value: "custom", label: "Custom Section" },
] as const;

const TYPE_BADGES: Record<string, string> = {
  hero: "bg-violet-100 text-violet-700 border-violet-200",
  about: "bg-blue-100 text-blue-700 border-blue-200",
  announcement: "bg-amber-100 text-amber-700 border-amber-200",
  contact: "bg-emerald-100 text-emerald-700 border-emerald-200",
  custom: "bg-slate-100 text-slate-700 border-slate-200",
};

const EMPTY_FORM = { type: "custom", title: "", body: "", imageUrl: "", linkUrl: "", linkLabel: "" };

export function WebsiteSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);

  const { data: sections, isLoading } = useQuery<any[]>({
    queryKey: ["/api/website/sections"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/website/sections"] });
  const onError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/website/sections", data),
    onSuccess: () => { toast({ title: "Section added", description: "It's saved as a draft — publish it when ready." }); setDialogOpen(false); invalidate(); },
    onError,
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/website/sections/${id}`, data),
    onSuccess: () => { setDialogOpen(false); invalidate(); },
    onError,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/website/sections/${id}`),
    onSuccess: () => { toast({ title: "Section deleted" }); setDeleteId(null); invalidate(); },
    onError,
  });
  const moveMut = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      apiRequest("POST", `/api/website/sections/${id}/move`, { direction }),
    onSuccess: invalidate,
    onError,
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ type: s.type, title: s.title, body: s.body ?? "", imageUrl: s.imageUrl ?? "", linkUrl: s.linkUrl ?? "", linkLabel: s.linkLabel ?? "" });
    setDialogOpen(true);
  };
  const submit = () => {
    const data = {
      type: form.type, title: form.title.trim(), body: form.body || null,
      imageUrl: form.imageUrl.trim() || null, linkUrl: form.linkUrl.trim() || null,
      linkLabel: form.linkLabel.trim() || null,
    };
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const publicUrl = user?.schoolCode ? `/school/${user.schoolCode}` : null;
  const publishedCount = sections?.filter((s) => s.isPublished).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">School Website</h1>
          <p className="text-muted-foreground mt-1">
            Build and update your school's public page — no code needed. Draft sections are only visible here until published.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" /> View Live Page
              </a>
            </Button>
          )}
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Section
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Page Sections</CardTitle>
          <CardDescription>
            {sections?.length ?? 0} section{(sections?.length ?? 0) === 1 ? "" : "s"} · {publishedCount} published. Sections appear on the public page in this order.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Loading…</p>
          ) : !sections || sections.length === 0 ? (
            <div className="text-center py-14 px-6">
              <Globe className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold mb-1">No sections yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start building your school's public page — add a welcome message, news, or an about section.
              </p>
              <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Your First Section</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sections.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={i === 0 || moveMut.isPending}
                        onClick={() => moveMut.mutate({ id: s.id, direction: "up" })}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={i === sections.length - 1 || moveMut.isPending}
                        onClick={() => moveMut.mutate({ id: s.id, direction: "down" })}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{s.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${TYPE_BADGES[s.type] || TYPE_BADGES.custom}`}>
                          {SECTION_TYPES.find((t) => t.value === s.type)?.label || s.type}
                        </Badge>
                        {s.isPublished
                          ? <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]">Published</Badge>
                          : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                      </div>
                      {s.body && <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-md">{s.body}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" title={s.isPublished ? "Unpublish" : "Publish"}
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: s.id, data: { isPublished: !s.isPublished } })}>
                      {s.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Section" : "Add Section"}</DialogTitle>
            <DialogDescription>
              {editing ? "Changes save immediately; publishing is controlled from the list." : "New sections start as drafts."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Section Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Welcome to our school" />
            </div>
            <div className="grid gap-2">
              <Label>Content</Label>
              <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the section text here…" />
            </div>
            <div className="grid gap-2">
              <Label>Image URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Button Link <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://…" />
              </div>
              <div className="grid gap-2">
                <Label>Button Label</Label>
                <Input value={form.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                  placeholder="e.g. Read more" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : editing ? "Save Changes" : "Add Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from the public page immediately. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}>
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
