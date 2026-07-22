import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { Html5Qrcode } from "html5-qrcode";
import {
  Package, Printer, ScanBarcode, Camera, X, Check, CheckCircle2,
  Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Book Copies — per-physical-copy tracking (intake).
// Flow: pick a title → generate a batch of uniquely-coded copies → print the
// barcode label sheet → apply labels → "Confirm labels" scans each to verify.
// Wired to: POST/GET /api/books/:id/copies, POST /api/book-copies/verify,
// PATCH /api/book-copies/:id. Teachers never touch this; admins only.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  in_stock: "bg-blue-50 text-blue-700 border-blue-200",
  allocated: "bg-amber-50 text-amber-700 border-amber-200",
  sold: "bg-emerald-50 text-emerald-700 border-emerald-200",
  damaged: "bg-red-50 text-red-700 border-red-200",
  lost: "bg-gray-100 text-gray-600 border-gray-200",
  returned: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function BookCopiesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [bookId, setBookId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [academicYear, setAcademicYear] = useState<string>("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanFeed, setScanFeed] = useState<{ code: string; result: string }[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const { data: books = [] } = useQuery<any[]>({
    queryKey: ["/api/books"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: copyData, isLoading: copiesLoading, refetch } = useQuery<any>({
    queryKey: ["/api/books", bookId, "copies"],
    queryFn: () => fetch(`/api/books/${bookId}/copies`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!bookId,
  });

  const copies: any[] = copyData?.copies || [];
  const counts: Record<string, number> = copyData?.counts || {};
  const selectedBook = books.find((b: any) => b.id === bookId);
  const total = copies.length;
  const verifiedCount = useMemo(() => copies.filter((c) => c.verifiedAt).length, [copies]);
  const unverified = useMemo(() => copies.filter((c) => !c.verifiedAt), [copies]);

  const generateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/books/${bookId}/copies`, body),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      setQuantity("");
      qc.invalidateQueries({ queryKey: ["/api/books", bookId, "copies"] });
      toast({ title: `Generated ${data.generated ?? ""} copies`, description: "Now print the labels and apply them." });
    },
    onError: (e: any) => toast({ title: "Couldn't generate copies", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => apiRequest("POST", "/api/book-copies/verify", { code }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      setScanFeed((f) => [{ code: data?.copy?.copyCode || "?", result: data?.result || "confirmed" }, ...f].slice(0, 12));
      qc.invalidateQueries({ queryKey: ["/api/books", bookId, "copies"] });
    },
    onError: async (e: any) => {
      const code = e?.body?.copy?.copyCode || lastScanRef.current.code || "?";
      setScanFeed((f) => [{ code, result: e?.status === 404 ? "unknown" : "error" }, ...f].slice(0, 12));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/book-copies/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/books", bookId, "copies"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  // ── Scanner lifecycle (mirrors the parent portal scanner) ──
  async function startScanner() {
    setScanOpen(true);
    setScanFeed([]);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("copy-scan-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 140 } },
          (decoded: string) => {
            const now = Date.now();
            if (decoded === lastScanRef.current.code && now - lastScanRef.current.at < 2500) return;
            lastScanRef.current = { code: decoded, at: now };
            verifyMutation.mutate(decoded.trim());
          },
          () => {},
        );
      } catch {
        toast({ title: "Camera unavailable", description: "Allow camera access, or type codes to confirm.", variant: "destructive" });
      }
    }, 50);
  }
  async function stopScanner() {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanOpen(false);
  }
  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  // ── Print label sheet: render static SVG barcodes in-app, write to a print window ──
  function printLabels(list: any[]) {
    if (!list.length) { toast({ title: "Nothing to print" }); return; }
    const title = selectedBook?.title || "";
    const labels = list.map((c) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try { JsBarcode(svg, c.copyCode, { format: "CODE128", displayValue: false, width: 1.5, height: 42, margin: 2 }); } catch {}
      const svgStr = new XMLSerializer().serializeToString(svg);
      const safeTitle = title.replace(/[<>&]/g, "");
      return `<div class="lbl"><div class="bc">${svgStr}</div><div class="code">${c.copyCode}</div><div class="ttl">${safeTitle}</div></div>`;
    }).join("");
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to print labels.", variant: "destructive" }); return; }
    win.document.write(
      `<html><head><title>ScholarShelf labels</title><style>
        *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
        body{margin:12px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .lbl{border:1px solid #ccc;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid}
        .bc svg{max-width:100%;height:44px}
        .code{font-family:monospace;font-weight:bold;font-size:12px;margin-top:2px}
        .ttl{font-size:10px;color:#555;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      </style></head><body><div class="grid">${labels}</div></body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch {} }, 300);
  }

  const stat = (label: string, value: number, tone = "text-foreground") => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold mt-0.5", tone)}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Book Copies</h1>
        <p className="text-muted-foreground text-sm mt-1">Register, label, and track every physical book individually.</p>
      </div>

      {/* Book picker + generate */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">Book title</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder="Choose a book…" /></SelectTrigger>
              <SelectContent>
                {books.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}{b.bookCode ? ` · ${b.bookCode}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" min={1} max={2000} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 40" className="w-28" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Academic year</Label>
            <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026/27" className="w-32" />
          </div>
          <Button
            onClick={() => generateMutation.mutate({ quantity: parseInt(quantity, 10), academicYear: academicYear || undefined })}
            disabled={!bookId || !quantity || generateMutation.isPending}
          >
            {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</> : <><Package className="w-4 h-4 mr-1.5" /> Generate copies</>}
          </Button>
        </div>
        {!bookno(books) && <p className="text-xs text-muted-foreground">No books yet — add a book first from the Books page.</p>}
      </div>

      {bookId && (
        <>
          {/* Status summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stat("Total copies", total)}
            {stat("In stock", counts.in_stock || 0, "text-blue-600")}
            {stat("Verified", verifiedCount, "text-emerald-600")}
            {stat("Sold", counts.sold || 0, "text-emerald-600")}
            {stat("Damaged / lost", (counts.damaged || 0) + (counts.lost || 0), "text-red-600")}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => printLabels(copies)} disabled={!copies.length}>
              <Printer className="w-4 h-4 mr-1.5" /> Print all labels ({copies.length})
            </Button>
            <Button variant="outline" onClick={() => printLabels(unverified)} disabled={!unverified.length}>
              <Printer className="w-4 h-4 mr-1.5" /> Print unverified ({unverified.length})
            </Button>
            {!scanOpen ? (
              <Button onClick={startScanner}><ScanBarcode className="w-4 h-4 mr-1.5" /> Confirm labels (scan)</Button>
            ) : (
              <Button variant="outline" onClick={stopScanner}><X className="w-4 h-4 mr-1.5" /> Stop scanning</Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          </div>

          {/* Scanner */}
          {scanOpen && (
            <div className="rounded-2xl border border-border bg-card p-4 grid md:grid-cols-2 gap-4">
              <div>
                <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                  <div id="copy-scan-reader" className="w-full" />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Point the camera at each printed label to confirm it.</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Scan results</p>
                {scanFeed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Scanned labels will appear here.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {scanFeed.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm rounded-md border border-border px-3 py-1.5">
                        <span className="font-mono">{f.code}</span>
                        {f.result === "confirmed" && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Confirmed</span>}
                        {f.result === "already" && <span className="flex items-center gap-1 text-muted-foreground"><Check className="w-4 h-4" /> Already done</span>}
                        {f.result === "unknown" && <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-4 h-4" /> Unknown code</span>}
                        {f.result === "error" && <span className="text-red-600">Error</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Copies list */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-sm font-medium">Copies ({total})</div>
            {copiesLoading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : copies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No copies yet. Generate a batch above.</div>
            ) : (
              <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                {copies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm">{c.copyCode}</span>
                      {c.verifiedAt
                        ? <span className="text-xs text-emerald-600 flex items-center gap-0.5"><Check className="w-3.5 h-3.5" /> verified</span>
                        : <span className="text-xs text-muted-foreground">unverified</span>}
                      {c.academicYear && <span className="text-xs text-muted-foreground">· {c.academicYear}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs", STATUS_STYLE[c.status] || "")}>{c.status}</Badge>
                      <Select value={c.status} onValueChange={(v) => statusMutation.mutate({ id: c.id, status: v })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["in_stock", "allocated", "sold", "damaged", "lost", "returned"].map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function bookno(books: any[]) { return (books?.length || 0) > 0; }

export { BookCopiesSection };
