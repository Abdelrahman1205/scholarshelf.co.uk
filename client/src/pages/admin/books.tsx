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
import { BarcodeDisplay } from "./students";

import { Html5Qrcode } from "html5-qrcode";
import JsBarcode from "jsbarcode";
// ─── BOOKS ────────────────────────────────────────────────────────────────────
function BooksSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 });
  const [stockForm, setStockForm] = useState({ quantity: 0, type: "purchase", reason: "" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isbnLooking, setIsbnLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [barcodeBook, setBarcodeBook] = useState<any>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanNotFound, setScanNotFound] = useState(false);

  const { data: books = [] } = useQuery<any[]>({ queryKey: ["/api/books"], queryFn: getQueryFn({ on401: "throw" }) });

  async function lookupIsbn(isbn: string) {
    setIsbnLooking(true);
    try {
      const res = await fetch(`/api/isbn-lookup/${encodeURIComponent(isbn)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, isbn: data.isbn || prev.isbn, title: data.title || prev.title, author: data.author || prev.author, description: data.description || prev.description }));
        toast({ title: "Book Found", description: `"${data.title}" auto-filled.` });
      } else {
        setForm((prev) => ({ ...prev, isbn }));
        toast({ title: "ISBN Scanned", description: "Book not found in database — please fill in manually." });
      }
    } catch {
      setForm((prev) => ({ ...prev, isbn }));
    } finally { setIsbnLooking(false); }
  }

  async function startScanner() {
    setScannerError(null); setScannerOpen(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5Qr;
        await html5Qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 300, height: 150 } } as any,
          (decodedText) => { const code = decodedText.trim(); stopScanner(); setScanInput(code); handleScanInput(code); }, () => {});
      } catch (err: any) { setScannerError(err?.message || "Could not access camera."); setScannerOpen(false); }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScannerOpen(false);
  }

  useEffect(() => { return () => { if (scannerRef.current) { try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {} } }; }, []);

  async function handleScanInput(code: string) {
    if (!code.trim()) return;
    setScanNotFound(false); setScanResult(null);
    try {
      const res = await fetch(`/api/books/scan/${encodeURIComponent(code.trim())}`, { credentials: "include" });
      if (res.ok) { const book = await res.json(); setScanResult(book); setScanNotFound(false); }
      else { setScanNotFound(true); }
    } catch { setScanNotFound(true); }
  }

  function printBarcode(book: any) {
    const svg = document.querySelector("#barcode-print-area svg");
    if (!svg) return;
    const schoolLabel = (user as any)?.schoolName || (user as any)?.schoolCode || "";
    const win = window.open("", "_blank", "width=420,height=350");
    if (!win) return;
    win.document.write(`<html><head><title>Barcode - ${book.title}</title><style>body{text-align:center;font-family:sans-serif;padding:20px;margin:0}.school{font-size:11px;color:#888;margin-bottom:2px}.title{font-size:15px;font-weight:bold;margin:4px 0 2px}.author{font-size:12px;color:#666;margin:0 0 8px}.code{font-size:11px;color:#555;font-family:monospace;margin-top:6px}@media print{body{padding:8px}}</style></head><body>${schoolLabel ? `<p class="school">${schoolLabel}</p>` : ""}<p class="title">${book.title}</p>${book.author ? `<p class="author">${book.author}</p>` : ""}${svg.outerHTML}<p class="code">${book.bookCode}</p><script>window.print();window.close();</script></body></html>`);
    win.document.close();
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/books", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setAddOpen(false); resetForm(); toast({ title: "Book added" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/books/${selectedBook?.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setEditOpen(false); toast({ title: "Book updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/books/${selectedBook?.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setDeleteOpen(false); toast({ title: "Book deleted" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const stockMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/books/${selectedBook?.id}/stock`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/books"] }); setStockOpen(false); toast({ title: "Stock updated" }); },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function resetForm() { setForm({ title: "", author: "", isbn: "", price: "", description: "", isActive: true, stockQuantity: 0, lowStockThreshold: 10, reorderQuantity: 50 }); }

  const filtered = books.filter((b: any) => b.title?.toLowerCase().includes(search.toLowerCase()) || b.author?.toLowerCase().includes(search.toLowerCase()) || b.isbn?.toLowerCase().includes(search.toLowerCase()) || b.bookCode?.toLowerCase().includes(search.toLowerCase()));

  const bookFormFields = (
    <>
      {isbnLooking && <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md"><Loader2 className="h-4 w-4 animate-spin" /> Looking up book details...</div>}
      <div className="grid gap-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
        <div className="grid gap-2"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your book catalogue and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { resetForm(); startScanner(); }}><ScanBarcode className="w-4 h-4 mr-2" /> Scan</Button>
          <Button onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Book</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search by title, author, ISBN, or book code..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="relative max-w-xs">
          <ScanBarcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Scan or type book code..." className="pl-9 bg-card font-mono" value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { handleScanInput(scanInput); } }} />
        </div>
      </div>
      {scanResult && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Book Found</AlertTitle>
          <AlertDescription className="text-emerald-700">
            <strong>{scanResult.title}</strong> by {scanResult.author || "Unknown"} — Stock: {scanResult.stockQuantity || 0} — Code: <span className="font-mono">{scanResult.bookCode}</span>
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => { setScanResult(null); setScanInput(""); }}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}
      {scanNotFound && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>No book matches code "{scanInput}". <Button variant="ghost" size="sm" onClick={() => { setScanNotFound(false); setScanInput(""); }}>Dismiss</Button></AlertDescription>
        </Alert>
      )}

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Book Code</TableHead>
              <TableHead>ISBN</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((book: any) => {
              const isLow = (book.stockQuantity || 0) <= (book.lowStockThreshold || 10);
              return (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell className="text-muted-foreground">{book.author || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {book.bookCode ? (
                      <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1 font-mono text-xs" onClick={() => { setBarcodeBook(book); setBarcodeOpen(true); }}>{book.bookCode}</Button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{book.isbn || "—"}</TableCell>
                  <TableCell>£{parseFloat(book.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={isLow ? "text-amber-600 font-semibold" : ""}>{book.stockQuantity || 0}</span>
                    {isLow && <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />}
                  </TableCell>
                  <TableCell><Badge variant={book.isActive ? "default" : "secondary"} className={book.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>{book.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" title="Adjust Stock" onClick={() => { setSelectedBook(book); setStockForm({ quantity: 0, type: "purchase", reason: "" }); setStockOpen(true); }}>
                      <Package className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedBook(book); setForm({ title: book.title || "", author: book.author || "", isbn: book.isbn || "", price: book.price || "", description: book.description || "", isActive: book.isActive ?? true, stockQuantity: book.stockQuantity || 0, lowStockThreshold: book.lowStockThreshold || 10, reorderQuantity: book.reorderQuantity || 50 }); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelectedBook(book); setDeleteOpen(true); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{search ? "No matching books" : "No books yet. Add your first book above."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) stopScanner(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Scan Book Code (CODE128)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div id="barcode-reader" className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]" />
            {scannerError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{scannerError}</div>}
            <Button variant="outline" className="w-full" onClick={stopScanner}><X className="w-4 h-4 mr-2" /> Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? "Adding..." : "Add Book"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Book</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">{bookFormFields}</div>
          <DialogFooter><Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedBook?.title}</DialogTitle>
            <DialogDescription>Current stock: {selectedBook?.stockQuantity || 0}</DialogDescription>
          </DialogHeader>
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
          <DialogFooter><Button onClick={() => stockMutation.mutate(stockForm)} disabled={stockMutation.isPending}>{stockMutation.isPending ? "Updating..." : "Update Stock"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Book</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{selectedBook?.title}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode View/Print Dialog */}
      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Book Barcode (CODE128)</DialogTitle>
            <DialogDescription>{barcodeBook?.title}{barcodeBook?.author ? ` — ${barcodeBook.author}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 py-4" id="barcode-print-area">
            {(user as any)?.schoolName && <p className="text-xs text-muted-foreground">{(user as any).schoolName}</p>}
            {barcodeBook?.bookCode && <BarcodeDisplay value={barcodeBook.bookCode} />}
            <p className="text-sm font-mono font-medium">{barcodeBook?.bookCode}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeOpen(false)}>Close</Button>
            <Button onClick={() => printBarcode(barcodeBook)}><Printer className="w-4 h-4 mr-2" /> Print Label</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── BOOK LEVELS ───────────────────────────────────────────────

export { BooksSection };
