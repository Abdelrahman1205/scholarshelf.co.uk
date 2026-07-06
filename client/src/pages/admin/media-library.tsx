import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Upload, Trash2, FileText, ImageIcon, X, Loader2, Copy, Check, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All Assets" },
  { key: "image", label: "Images" },
  { key: "document", label: "Documents" },
  { key: "video", label: "Video" },
] as const;

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── MEDIA LIBRARY (IT / CMS asset gallery) ─────────────────────────────────
function MediaLibrarySection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: assets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/media"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/media", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Upload failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Asset uploaded" }); },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    onSettled: () => setUploading(false),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; title: string; caption: string }) => apiRequest("PATCH", `/api/media/${data.id}`, { title: data.title, caption: data.caption }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Details saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/media/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/media"] }); setSelected(null); toast({ title: "Asset deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  const openDetail = (a: any) => { setSelected(a); setTitle(a.title || ""); setCaption(a.caption || ""); setCopied(false); };

  const filtered = assets.filter((a: any) => {
    const matchesTab = tab === "all" || a.kind === tab;
    const matchesSearch = !search || (a.fileName || "").toLowerCase().includes(search.toLowerCase()) || (a.title || "").toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    all: assets.length,
    image: assets.filter((a: any) => a.kind === "image").length,
    document: assets.filter((a: any) => a.kind === "document").length,
    video: assets.filter((a: any) => a.kind === "video").length,
  };

  const copyLink = (uri: string) => { navigator.clipboard.writeText(uri); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const KindIcon = ({ kind, className }: { kind: string; className?: string }) =>
    kind === "document" ? <FileText className={className} /> : kind === "video" ? <Film className={className} /> : <ImageIcon className={className} />;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Media Library</h1>
          <p className="text-muted-foreground mt-1">Upload and manage images and documents for your school website.</p>
        </div>
        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,image/*,application/pdf" className="hidden" onChange={onPickFile} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? "Uploading…" : "Upload Asset"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Gallery */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  tab === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted/40",
                )}>
                  {t.label} <span className="opacity-60">{(counts as any)[t.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-56"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search assets…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{assets.length === 0 ? "No assets yet. Upload an image or document to get started." : "No assets match your filter."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((a: any) => (
                <button key={a.id} onClick={() => openDetail(a)} className={cn(
                  "group text-left rounded-xl border overflow-hidden bg-card hover:shadow-sm transition-all",
                  selected?.id === a.id ? "border-primary ring-1 ring-primary/30" : "border-border",
                )}>
                  <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center overflow-hidden">
                    {a.kind === "image" ? (
                      <img src={a.dataUri} alt={a.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground"><KindIcon kind={a.kind} className="w-8 h-8" /><span className="text-[10px] font-mono uppercase mt-1">{a.kind}</span></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-medium text-foreground truncate">{a.fileName}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{a.kind} · {formatSize(a.sizeBytes)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit lg:sticky lg:top-4">
          {!selected ? (
            <div className="text-center py-12"><ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select an asset to view details and edit.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-foreground">Asset Details</h2>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 aspect-[4/3] flex items-center justify-center overflow-hidden">
                {selected.kind === "image"
                  ? <img src={selected.dataUri} alt={selected.fileName} className="w-full h-full object-contain" />
                  : <div className="flex flex-col items-center text-muted-foreground"><KindIcon kind={selected.kind} className="w-10 h-10" /><span className="text-[10px] font-mono uppercase mt-1">{selected.kind}</span></div>}
              </div>

              <div className="text-sm">
                <div className="font-medium text-foreground truncate">{selected.fileName}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Type</div><div className="text-foreground text-xs">{selected.mimeType}</div></div>
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Size</div><div className="text-foreground text-xs">{formatSize(selected.sizeBytes)}</div></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid gap-1.5"><Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Caption</Label><Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a description…" /></div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Direct Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={selected.dataUri?.slice(0, 40) + "…"} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyLink(selected.dataUri)}>{copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}</Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => saveMutation.mutate({ id: selected.id, title, caption })} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save Details"}
                </Button>
                <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(selected.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { MediaLibrarySection };
