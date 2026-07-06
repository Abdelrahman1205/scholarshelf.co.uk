import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Plus, ScanBarcode, X, Loader2, Package, Pencil, Trash2,
  Printer, BookOpen, AlertTriangle, QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { BarcodeDisplay } from "./students";
import { Html5Qrcode } from "html5-qrcode";

// ─── BOOKS (master-detail rebuild) ──────────────────────────────────────────
function BooksSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [detailBook, setDetailBook] = useState<any>(null);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 });
  const [stockForm, setStockForm] = useState({ quantity: 0, type: "purchase", reason: "" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isbnLooking, setIsbnLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });

  async function lookupIsbn(isbn: string) {
    setIsbnLooking(true);
    try {
      const res = await fetch(`/api/isbn-lookup/${encodeURIComponent(isbn)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, isbn: data.isbn || prev.isbn, title: data.title || prev.title, author: data.author || prev.author, description: data.description || prev.description }));
        toast({ title: "Book found", description: `"${data.title}" auto-filled.` });
      } else {
        setForm((prev) => ({ ...prev, isbn }));
        toast({ title: "ISBN scanned", description: "Not found — please fill in manually." });
      }
    } catch { setForm((prev) => ({ ...prev, isbn })); } finally { setIsbnLooking(false); }
  }

  async function handleScanInput(code: string) {
    if (!code.trim()) return;
    try {
      const res = await fetch(`/api/books/scan/${encodeURIComponent(code.trim())}`, { credentials: "include" });
      if (res.ok) { const book = await res.json(); setDetailBook(book); toast({ title: "Book found", description: book.title }); }
      else toast({ title: "Not found", description: `No book matches "${code}".`, variant: "destructive" });
    } catch { toast({ title: "Scan failed", variant: "destructive" }); }
  }

  async function startScanner() {
    setScannerError(null); setScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5Qr;
        await html5Qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 300, height: 150 } } as any,
          (decodedText) => { const code = decodedText.trim(); stopScanner(); handleScanInput(code); }, () => {});
      } catch (err: any) { setScannerError(err?.message || "Could not access camera."); setScannerOpen(false); }
    }, 100);
  }
  async function stopScanner() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScannerOpen(false);
  }
  useEffect(() => () => { if (scannerRef.current) { try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {} } }, []);

  function printBarcode(book: any) {
    const svg = document.querySelector("#barcode-print-area svg");
    if (!svg) return;
    const schoolLabel = (user as any)?.schoolName || (user as any)?.schoolCode || "";
    const win = window.open("", "_blank", "width=420,height=350");
    if (!win) return;
    win.document.write(`<html><head><title>Barcode - ${book.title}</title><style>body{text-align:center;font-family:sans-serif;padding:20px;margin:0}.school{font-size:11px;color:#888;margin-bottom:2px}.title{font-size:15px;font-weight:bold;margin:4px 0 2px}.author{font-size:12px;color:#666;margin:0 0 8px}.code{font-size:11px;color:#555;font-family:monospace;margin-top:6px}@media print{body{padding:8px}}</style></head><body>${schoolLabel ? `<p class="school">${schoolLabel}</p>` : ""}<p class="title">${book.title}</p>${book.author ? `<p class="author">${book.author}</p>` : ""}${svg.outerHTML}<p class="code">${book.bookCode}</p><script>window.print();window.close();</script></body></html>`);
    win.document.close();
  }

  const createMutation = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/books", data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setAddOpen(false); resetForm(); toast({ title: "Book added" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const updateMutation = useMutation({ mutationFn: (data: any) => apiRequest("PATCH", `/api/books/${selectedBook?.id}`, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setEditOpen(false); toast({ title: "Book updated" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const deleteMutation = useMutation({ mutationFn: () => apiRequest("DELETE", `/api/books/${selectedBook?.id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setDeleteOpen(false); setDetailBook(null); toast({ title: "Book deleted" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });
  const stockMutation = useMutation({ mutationFn: (data: any) => apiRequest("POST", `/api/books/${selectedBook?.id}/stock`, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setStockOpen(false); toast({ title: "Stock updated" }); }, onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) });

  function resetForm() { setForm({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 }); }
  const isLow = (b: any) => (b.stockQuantity || 0) <= (b.lowStockThreshold || 10);

  const filtered = books.filter((b: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.isbn?.toLowerCase().includes(q) || b.bookCode?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? b.isActive : !b.isActive);
    const matchesLow = !lowOnly || isLow(b);
    return matchesSearch && matchesStatus && matchesLow;
  });

  const openEdit = (b: any) => { setSelectedBook(b); setForm({ title: b.title || "", author: b.author || "", isbn: b.isbn || "", price: b.price || "", description: b.description || "", isActive: b.isActive ?? true, stockQuantity: b.stockQuantity || 0, lowStockThreshold: b.lowStockThreshold || 10, reorderQuantity: b.reorderQuantity || 50 }); setEditOpen(true); };
  const bookFormFields = (
    <>
      {isbnLooking && <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md"><Loader2 className="h-4 w-4 animate-spin" /> Looking up book details…</div>}
      <div className="grid gap-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
        <div className="grid gap-2"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} onBlur={(e) => e.target.value && lookupIsbn(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Price (£)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Stock Quantity</Label><Input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Low Stock Threshold</Label><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 10 })} /></div>
        <div className="grid gap-2"><Label>Reorder Quantity</Label><Input type="number" value={form.reorderQuantity} onChange={(e) => setForm({ ...form, reorderQuantity: parseInt(e.target.value) || 50 })} /></div>
      </div>
      <div className="grid gap-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
    </>
  );

  const b = detailBook;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Book Catalogue</h1>
          <p className="text-muted-foreground mt-1">Manage titles, stock levels, and printable barcodes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetForm(); startScanner(); }}><ScanBarcode className="w-4 h-4 mr-2" /> Scan</Button>
          <Button onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Book</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-4">
        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Filters</h2>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setLowOnly(false); }} className="text-xs text-primary hover:underline">Reset</button>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Quick Find</div>
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Title, author, ISBN, code…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded border-border" />
            <span className="text-foreground">Low stock only</span>
          </label>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm"><strong className="text-foreground">{filtered.length}</strong> <span className="text-muted-foreground">book{filtered.length !== 1 ? "s" : ""}</span></div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-muted-foreground py-10">{search ? "No matching books." : "No books yet — add your first."}</td></tr>
                ) : filtered.map((book: any) => (
                  <tr key={book.id} onClick={() => setDetailBook(book)} className={cn("border-b border-border cursor-pointer hover:bg-muted/20", detailBook?.id === book.id && "bg-primary/5")}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{book.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">{book.bookCode || "—"}{book.author ? ` · ${book.author}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">£{parseFloat(book.price || "0").toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={isLow(book) ? "text-amber-600 font-semibold" : "text-foreground"}>{book.stockQuantity || 0}</span>{isLow(book) && <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          {!b ? (
            <div className="text-center py-12"><BookOpen className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Select a book to see details.</p></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-foreground">{b.title}</div><div className="text-xs text-muted-foreground">{b.author || "—"}</div></div>
                <button onClick={() => setDetailBook(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Code</div><div className="font-mono text-foreground">{b.bookCode || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">ISBN</div><div className="font-mono text-foreground">{b.isbn || "—"}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Price</div><div className="text-foreground">£{parseFloat(b.price || "0").toFixed(2)}</div></div>
                <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Stock</div><div className={isLow(b) ? "text-amber-600 font-semibold" : "text-foreground"}>{b.stockQuantity || 0}</div></div>
              </div>
              {b.bookCode && (
                <div className="rounded-lg border border-border p-3 flex flex-col items-center gap-1" id="barcode-print-area">
                  <BarcodeDisplay value={b.bookCode} />
                  <p className="text-xs font-mono">{b.bookCode}</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="justify-start" onClick={() => { setSelectedBook(b); setStockForm({ quantity: 0, type: "purchase", reason: "" }); setStockOpen(true); }}><Package className="w-4 h-4 mr-2" /> Adjust stock</Button>
                {b.bookCode && <Button variant="outline" size="sm" className="justify-start" onClick={() => printBarcode(b)}><Printer className="w-4 h-4 mr-2" /> Print barcode</Button>}
                <Button variant="outline" size="sm" className="justify-start" onClick={() => openEdit(b)}><Pencil className="w-4 h-4 mr-2" /> Edit book</Button>
                <Button variant="outline" size="sm" className="justify-start text-destructive hover:text-destructive" onClick={() => { setSelectedBook(b); setDeleteOpen(true); }}><Trash2 className="w-4 h-4 mr-2" /> Delete book</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Scan Book Code</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div id="barcode-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]" />
            {scannerError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{scannerError}</div>}
            <Button variant="outline" className="w-full" onClick={stopScanner}><X className="w-4 h-4 mr-2" /> Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => createMutation.mutate(form)} disabled={!form.title.trim() || createMutation.isPending}>{createMutation.isPending ? "Adding…" : "Add Book"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Adjust Stock — {selectedBook?.title}</DialogTitle><DialogDescription>Current stock: {selectedBook?.stockQuantity || 0}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={stockForm.type} onValueChange={(v) => setStockForm({ ...stockForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase (add stock)</SelectItem>
                  <SelectItem value="return">Return (add stock)</SelectItem>
                  <SelectItem value="damage">Damage (reduce stock)</SelectItem>
                  <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Quantity</Label><Input type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid gap-2"><Label>Reason (optional)</Label><Input value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => stockMutation.mutate(stockForm)} disabled={stockMutation.isPending}>{stockMutation.isPending ? "Updating…" : "Update Stock"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Book</AlertDialogTitle><AlertDialogDescription>Delete "{selectedBook?.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { BooksSection };
