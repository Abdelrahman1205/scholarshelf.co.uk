import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Link as LinkIcon, History, CreditCard, Plus, BookOpen, Camera, X, Users, MessageSquare, Send, ArrowLeft, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Html5Qrcode } from "html5-qrcode";

interface ParentPageProps {
  section?: string;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "awaiting_reference":
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Awaiting Reference</Badge>;
    case "reference_submitted":
      return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">Reference Submitted</Badge>;
    case "confirmed":
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Payment Confirmed</Badge>;
    case "ready_for_collection":
      return <Badge className="bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20">Ready for Collection</Badge>;
    case "collected":
      return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Collected</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-500/10 text-gray-500 hover:bg-gray-500/20">Cancelled</Badge>;
    case "rejected":
    case "failed":
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Reference Rejected</Badge>;
    case "needs_review":
      return <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">Under Review</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function ParentDashboardSection({
  children,
  baskets,
  payments,
  isChildrenLoading,
  isBasketsLoading,
  isPaymentsLoading,
}: {
  children: any[];
  baskets: any[];
  payments: any[];
  isChildrenLoading: boolean;
  isBasketsLoading: boolean;
  isPaymentsLoading: boolean;
}) {
  const linkedChildren = children.length;
  const pendingBaskets = baskets.filter((b: any) => b.status === "pending").length;
  const lastPayment = payments[0];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Parent Portal</h1>
        <p className="text-muted-foreground mt-2">Quick overview of your children, baskets, and payments.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linked Children</div>
              <div className="text-2xl font-bold font-heading text-primary">{isChildrenLoading ? "..." : linkedChildren}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Baskets</div>
              <div className="text-2xl font-bold font-heading text-amber-600">{isBasketsLoading ? "..." : pendingBaskets}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Status</div>
              <div className="mt-1">
                {isPaymentsLoading ? (
                  <span className="text-sm text-muted-foreground">Loading...</span>
                ) : lastPayment ? (
                  <StatusBadge status={lastPayment.status} />
                ) : (
                  <span className="text-sm text-muted-foreground">No payments yet</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ParentLinkSection({
  linkCode,
  setLinkCode,
  scannerOpen,
  scannerError,
  startScanner,
  stopScanner,
  linkChildMutation,
  childrenQuery,
  children,
  createBasketMutation,
}: {
  linkCode: string;
  setLinkCode: (value: string) => void;
  scannerOpen: boolean;
  scannerError: string | null;
  startScanner: () => Promise<void>;
  stopScanner: () => Promise<void>;
  linkChildMutation: any;
  childrenQuery: any;
  children: any[];
  createBasketMutation: any;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<any>(null); // result from /preview
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/parent/link-code/preview", { code });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Invalid code"); }
      return res.json();
    },
    onSuccess: (data) => { setPreview(data); setPreviewError(null); },
    onError: (err: any) => { setPreviewError(err.message); setPreview(null); },
  });

  const confirmMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/parent/link-code/confirm", { code });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to link"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Child linked", description: `${preview?.studentName} has been linked to your account.` });
      setPreview(null);
      setPreviewError(null);
      setLinkCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/parent/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/baskets"] });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Link Child</h1>
        <p className="text-muted-foreground mt-2">Connect your child&apos;s profile using the link code provided by the school.</p>
      </div>

      <Card className="border-border max-w-3xl">
        <CardHeader>
          <CardTitle className="font-heading">Enter Child or Family Link Code</CardTitle>
          <CardDescription>
            Enter the link code sent by your school. You&apos;ll see a preview of the child before confirming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">Link Code</label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-link-code"
                  placeholder="e.g., A7B-9X2Z"
                  className="font-mono text-lg uppercase"
                  maxLength={10}
                  value={linkCode}
                  onChange={(e) => { setLinkCode(e.target.value.toUpperCase()); setPreviewError(null); }}
                />
                <Button
                  data-testid="button-link-child"
                  onClick={() => previewMutation.mutate(linkCode.trim())}
                  disabled={linkCode.length < 6 || previewMutation.isPending}
                >
                  {previewMutation.isPending ? "Checking..." : "Find Child"}
                </Button>
              </div>
              {previewError && <p className="text-sm text-destructive">{previewError}</p>}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {!scannerOpen ? (
                <Button data-testid="button-open-scanner" variant="outline" className="w-full gap-2" onClick={startScanner}>
                  <Camera className="w-4 h-4" />
                  Scan QR Code
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                    <div id="qr-reader" className="w-full" />
                    <Button data-testid="button-close-scanner" variant="ghost" size="sm" className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 hover:text-white z-10" onClick={stopScanner}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Point your camera at the QR code provided by the school.</p>
                </div>
              )}
              {scannerError && <p className="text-sm text-destructive">{scannerError}</p>}
            </div>
          ) : (
            // Step 2: preview — confirm before linking
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm text-muted-foreground">The following child was found:</p>
                <p className="text-lg font-semibold">{preview.studentName}</p>
                {preview.className && <p className="text-sm text-muted-foreground">Class: {preview.className}</p>}
                {preview.studentCode && <p className="text-xs text-muted-foreground font-mono">Code: {preview.studentCode}</p>}
              </div>
              <p className="text-sm text-muted-foreground">Is this your child? Click <strong>Yes, link this child</strong> to confirm.</p>
              <div className="flex gap-2">
                <Button
                  data-testid="button-confirm-link"
                  onClick={() => confirmMutation.mutate(linkCode.trim())}
                  disabled={confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? "Linking..." : "Yes, link this child"}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setPreviewError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="font-medium mb-4">Currently Linked Children</h3>
            {childrenQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : children.length === 0 ? (
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center h-[120px] text-center">
                  <p className="text-muted-foreground text-sm">No children linked yet. Use a link code above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {children.map((child: any) => (
                  <div
                    key={child.id}
                    className="flex justify-between items-center p-3 rounded-lg border border-border bg-card"
                    data-testid={`card-linked-child-${child.id}`}
                  >
                    <div>
                      <span className="font-medium">{child.student?.name || "Unknown"}</span>
                      <span className="text-muted-foreground text-sm ml-2">({child.student?.class?.name || "No class"})</span>
                      <span className="text-muted-foreground text-xs ml-2 font-mono">{child.student?.studentCode || ""}</span>
                    </div>
                    <Button
                      data-testid={`button-create-basket-link-${child.studentId || child.student?.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => createBasketMutation.mutate(child.studentId || child.student?.id)}
                      disabled={createBasketMutation.isPending}
                    >
                      <BookOpen className="w-4 h-4 mr-1" />
                      Create Book Basket
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ParentBasketsSection({
  basketsQuery,
  baskets,
  children,
  pendingBaskets,
  processedBaskets,
  childrenWithoutBaskets,
  createBasketMutation,
  setSelectedBasketForPayment,
  setPaymentResult,
  setPaymentDialogOpen,
  paymentDialogOpen,
  paymentResult,
  selectedBasketForPayment,
  paymentMutation,
  paymentAppName,
}: {
  basketsQuery: any;
  baskets: any[];
  children: any[];
  pendingBaskets: any[];
  processedBaskets: any[];
  childrenWithoutBaskets: any[];
  createBasketMutation: any;
  setSelectedBasketForPayment: (basket: any) => void;
  setPaymentResult: (result: any) => void;
  setPaymentDialogOpen: (open: boolean) => void;
  paymentDialogOpen: boolean;
  paymentResult: any;
  selectedBasketForPayment: any;
  paymentMutation: any;
  paymentAppName: string | null;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Book Baskets</h1>
        <p className="text-muted-foreground mt-2">Generate, review, and pay for your child&apos;s required books.</p>
      </div>

      {basketsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading baskets...</p>
      ) : baskets.length === 0 ? (
        <div className="space-y-4">
          <Card className="border-dashed border-2 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center h-[200px] text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-heading font-medium">No Baskets Yet</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                {children.length > 0
                  ? "Create a book basket for your linked children below."
                  : "Link a child first from the Link Child section, then create a book basket."}
              </p>
            </CardContent>
          </Card>
          {children.length > 0 && (
            <div className="space-y-3">
              {children.map((child: any) => (
                <Card key={child.id} className="border-border">
                  <CardContent className="flex justify-between items-center p-4">
                    <div>
                      <p className="font-medium" data-testid={`text-child-name-${child.id}`}>{child.student?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{child.student?.class?.name || "No class"}</p>
                    </div>
                    <Button
                      data-testid={`button-create-basket-${child.studentId || child.student?.id}`}
                      onClick={() => createBasketMutation.mutate(child.studentId || child.student?.id)}
                      disabled={createBasketMutation.isPending}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Book Basket
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {pendingBaskets.map((basket: any) => (
            <Card key={basket.id} className="border-border shadow-sm border-t-4 border-t-primary overflow-hidden" data-testid={`card-basket-${basket.id}`}>
              <CardHeader className="bg-muted/20 pb-4 border-b border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{basket.student?.name || "Child"}&apos;s Books</CardTitle>
                    <CardDescription className="mt-1">
                      {basket.student?.class?.name || "Class"} • Code: <span className="font-mono">{basket.student?.studentCode || "N/A"}</span>
                    </CardDescription>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Pending Payment</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-6">Title</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right px-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(basket.items || []).map((item: any, i: number) => (
                      <TableRow key={item.id || i}>
                        <TableCell className="px-6 font-medium" data-testid={`text-item-title-${item.id || i}`}>
                          {item.book?.title || "Book"}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity || 1}</TableCell>
                        <TableCell className="text-right">£{parseFloat(item.unitPrice || "0").toFixed(2)}</TableCell>
                        <TableCell className="text-right px-6">£{parseFloat(item.totalPrice || "0").toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between p-4 px-6 font-semibold bg-muted/10 border-t border-border">
                  <span>Total Required</span>
                  <span className="text-lg text-primary" data-testid={`text-basket-total-${basket.id}`}>
                    £{parseFloat(basket.totalAmount || "0").toFixed(2)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-6 bg-card flex justify-end items-center border-t border-border">
                <Button
                  data-testid={`button-pay-basket-${basket.id}`}
                  className="gap-2 shadow-sm"
                  onClick={() => {
                    const ts = Date.now().toString(36).toUpperCase();
                    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
                    const ref = `EDU-${ts}-${rand}`;
                    setSelectedBasketForPayment({ ...basket, generatedReference: ref });
                    setPaymentResult(null);
                    setPaymentDialogOpen(true);
                  }}
                >
                  <CreditCard className="w-4 h-4" />
                  Proceed to Payment
                </Button>
              </CardFooter>
            </Card>
          ))}

          {childrenWithoutBaskets.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-heading font-medium text-lg">Create Baskets</h3>
              {childrenWithoutBaskets.map((child: any) => (
                <Card key={child.id} className="border-border">
                  <CardContent className="flex justify-between items-center p-4">
                    <div>
                      <p className="font-medium">{child.student?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{child.student?.class?.name || "No class"}</p>
                    </div>
                    <Button
                      data-testid={`button-create-basket-${child.studentId || child.student?.id}`}
                      onClick={() => createBasketMutation.mutate(child.studentId || child.student?.id)}
                      disabled={createBasketMutation.isPending}
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Book Basket
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {processedBaskets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-heading font-medium text-lg">Processed Orders</h3>
              {processedBaskets.map((basket: any) => (
                <Card key={basket.id} className="border-border shadow-none opacity-75" data-testid={`card-basket-processed-${basket.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-muted-foreground">{basket.student?.name || "Child"}&apos;s Books</CardTitle>
                        <CardDescription>
                          {basket.student?.class?.name || "Class"} • £{parseFloat(basket.totalAmount || "0").toFixed(2)}
                        </CardDescription>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Paid & Allocated</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPaymentDialogOpen(false);
          setPaymentResult(null);
          setSelectedBasketForPayment(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {paymentResult ? "Order Created" : "Confirm Book Order"}
            </DialogTitle>
            <DialogDescription>
              {paymentResult
                ? `Your order has been created. Please pay using ${paymentAppName ? paymentAppName : "your school's payment app"}, then submit your payment reference.`
                : "Review the order details below and proceed to create your order."}
            </DialogDescription>
          </DialogHeader>

          {selectedBasketForPayment && !paymentResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Child</span>
                  <span className="font-medium">{selectedBasketForPayment.student?.name || "Child"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Class</span>
                  <span>{selectedBasketForPayment.student?.class?.name || "—"}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                  <span>Total Amount</span>
                  <span className="text-primary text-lg">£{parseFloat(selectedBasketForPayment.totalAmount || "0").toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-lg border-2 border-blue-500/30 p-4 bg-blue-500/5 text-sm space-y-2">
                <p className="font-semibold text-blue-700">How to Pay</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Create your order below</li>
                  <li>Pay using {paymentAppName ? <strong>{paymentAppName}</strong> : "your school's payment app"}</li>
                  <li>Come back to the <strong>Payments</strong> section and enter the reference number from {paymentAppName ? paymentAppName : "your school's payment app"}</li>
                  <li>The school will verify your payment and allocate the books</li>
                </ol>
              </div>
            </div>
          )}

          {paymentResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 p-4 bg-emerald-500/5 text-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Order Created Successfully
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Reference</span>
                  <span className="font-mono font-medium" data-testid="text-payment-reference">
                    {paymentResult.paymentReference}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-emerald-500/20 pt-2 mt-2">
                  <span>Amount Due</span>
                  <span className="text-primary text-lg">£{parseFloat(paymentResult.totalAmount || "0").toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 p-3 bg-amber-500/5 text-sm text-amber-700">
                <p className="font-medium">Next Step:</p>
                <p>Pay using {paymentAppName ? <strong>{paymentAppName}</strong> : "your school's payment app"}, then go to the <strong>Payments</strong> section to submit your payment reference number.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!paymentResult ? (
              <div className="flex gap-2 w-full justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setSelectedBasketForPayment(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="button-confirm-payment"
                  onClick={() => paymentMutation.mutate({ basketIds: [selectedBasketForPayment.id] })}
                  disabled={paymentMutation.isPending}
                  className="gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {paymentMutation.isPending ? "Creating Order..." : "Create Order"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 w-full justify-end">
                <Button
                  variant="outline"
                  data-testid="button-close-payment"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setPaymentResult(null);
                    setSelectedBasketForPayment(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  data-testid="button-go-to-payments"
                  className="gap-2"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setPaymentResult(null);
                    setSelectedBasketForPayment(null);
                    window.location.href = "/parent/payments";
                  }}
                >
                  <CreditCard className="w-4 h-4" />
                  Go to Payments
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParentPaymentsSection({
  paymentsQuery,
  payments,
  onSubmitReference,
}: {
  paymentsQuery: any;
  payments: any[];
  onSubmitReference: (payment: any) => void;
}) {
  // Payments needing reference (awaiting_reference, rejected, pending, failed)
  const awaitingReference = payments.filter((p: any) =>
    ["awaiting_reference", "rejected", "pending", "failed"].includes(p.status)
  );
  const submittedOrProcessed = payments.filter((p: any) =>
    !["awaiting_reference", "rejected", "pending", "failed"].includes(p.status)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-2">Submit your payment reference and track payment statuses.</p>
      </div>

      {paymentsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading payments...</p>
      ) : payments.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-heading font-medium">No Payments Yet</h3>
            <p className="text-muted-foreground max-w-sm mt-2">Create a book order from the Baskets section first, then submit your payment reference here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Orders awaiting payment reference */}
          {awaitingReference.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-heading font-medium text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-600" /> Action Required — Submit Payment Reference
              </h3>
              {awaitingReference.map((payment: any) => (
                <Card key={payment.id} className="border-border border-l-4 border-l-amber-500" data-testid={`card-awaiting-ref-${payment.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground">Order Reference</p>
                        <p className="font-mono font-medium">{payment.paymentReference}</p>
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Amount Due</span>
                      <span className="font-semibold text-lg text-primary">£{parseFloat(payment.totalAmount || "0").toFixed(2)}</span>
                    </div>
                    {(payment.status === "rejected" || payment.status === "failed") && payment.paymentReviewNote && (
                      <div className="rounded-lg border border-red-500/30 p-3 bg-red-500/5 text-sm text-red-700">
                        <p className="font-medium">Rejection reason:</p>
                        <p>{payment.paymentReviewNote}</p>
                      </div>
                    )}
                    <Button
                      onClick={() => onSubmitReference(payment)}
                      className="w-full gap-2"
                      data-testid={`button-submit-ref-${payment.id}`}
                    >
                      <CreditCard className="w-4 h-4" />
                      {(payment.status === "rejected" || payment.status === "failed") ? "Resubmit Payment Reference" : "Submit Payment Reference"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* All payments history */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-heading">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Order Ref</TableHead>
                    <TableHead>Payment Ref</TableHead>
                    <TableHead className="text-right px-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                      <TableCell className="px-6">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell data-testid={`text-payment-amount-${payment.id}`}>£{parseFloat(payment.totalAmount || "0").toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="font-mono bg-muted px-2 py-1 rounded text-sm">{payment.paymentReference}</span>
                      </TableCell>
                      <TableCell>
                        {payment.paymentReferenceNumber ? (
                          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">{payment.paymentReferenceNumber}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not submitted</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <StatusBadge status={payment.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}


function ParentMessagesSection({ children }: { children: any[] }) {
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const contactsQuery = useQuery<any[]>({
    queryKey: ["/api/parent/message-contacts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const threadsQuery = useQuery<any[]>({
    queryKey: ["/api/parent/message-threads"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

  const threadDetailQuery = useQuery<any>({
    queryKey: ["/api/parent/message-threads/" + selectedThreadId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedThreadId,
    refetchInterval: selectedThreadId ? 8000 : false,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { teacherUserId: string; studentId: string; subject: string; body: string }) => {
      const res = await apiRequest("POST", "/api/parent/message-threads", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Message Sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/message-threads"] });
      setNewMessageOpen(false);
      setSelectedChildId("");
      setSelectedTeacherId("");
      setSubject("");
      setBody("");
      // Auto-navigate to the new thread
      if (data?.threadId || data?.id) {
        setSelectedThreadId(data.threadId || data.id);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const res = await apiRequest("POST", `/api/parent/message-threads/${threadId}/messages`, { body });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reply Sent" });
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/parent/message-threads/" + selectedThreadId] }).then(scrollToBottom);
      queryClient.invalidateQueries({ queryKey: ["/api/parent/message-threads"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const contacts = contactsQuery.data || [];
  const threads = threadsQuery.data || [];
  const threadDetail = threadDetailQuery.data;

  // Auto-scroll to bottom when messages load/change
  const messageCount = threadDetail?.messages?.length ?? 0;
  useEffect(() => {
    if (messageCount > 0) scrollToBottom();
  }, [messageCount, selectedThreadId]);

  const uniqueChildren = Array.from(new Map(
    (children || [])
      .map((child: any) => {
        const studentId = String(child?.studentId || child?.student?.id || "");
        const studentName = child?.student?.name || child?.studentName || "Child";
        if (!studentId) return null;
        return [studentId, { studentId, studentName }];
      })
      .filter(Boolean) as Array<[string, { studentId: string; studentName: string }]>,
  ).values());

  const teachersForChild = contacts.filter((c: any) => String(c.studentId) === selectedChildId);

  // Thread detail view
  if (selectedThreadId && threadDetail) {
    const thread = threadDetail.thread;
    const messages = threadDetail.messages || [];
    const isClosed = thread?.status === "closed";

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Messages
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">{thread?.subject || "Message Thread"}</CardTitle>
                <CardDescription className="mt-1">
                  With {thread?.teacherName || "Teacher"} regarding {thread?.studentName || "Student"}
                </CardDescription>
              </div>
              <Badge className={isClosed ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"}>
                {isClosed ? "Closed" : "Open"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={messagesContainerRef} className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {messages.map((msg: any) => {
                const isOwn = msg.senderRole === "parent";
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg p-3 text-sm ${isOwn ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-xs">{msg.senderName || (isOwn ? "You" : "Teacher")}</span>
                        <span className="text-xs text-muted-foreground">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {isClosed ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-muted p-3 bg-muted/50 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" /> This thread has been closed. Replies are no longer allowed.
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
                <Button
                  size="sm"
                  className="self-end gap-2"
                  disabled={!replyBody.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate({ threadId: selectedThreadId, body: replyBody.trim() })}
                >
                  <Send className="w-4 h-4" />
                  {replyMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Thread list view
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Secure School Messages</h1>
          <p className="text-muted-foreground mt-2">Communicate with your children's teachers.</p>
        </div>
        <Button className="gap-2" onClick={() => setNewMessageOpen(true)}>
          <Plus className="w-4 h-4" /> New Message
        </Button>
      </div>

      {threadsQuery.isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading messages...</CardContent></Card>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No messages yet. Start a conversation with a teacher.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6">Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threads.map((thread: any) => (
                  <TableRow
                    key={thread.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <TableCell className="px-6 font-medium">
                      <div className="flex items-center gap-2">
                        {thread.subject}
                        {(thread.unreadByParent || 0) > 0 && (
                          <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                            {thread.unreadByParent}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{thread.teacherName || "Teacher"}</TableCell>
                    <TableCell>{thread.studentName || "Student"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {thread.updatedAt ? new Date(thread.updatedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Badge className={thread.status === "closed" ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"}>
                        {thread.status === "closed" ? "Closed" : "Open"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Message Dialog */}
      <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">New Message</DialogTitle>
            <DialogDescription>Send a message to your child's teacher.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Child</label>
              <Select value={selectedChildId} onValueChange={(v) => { setSelectedChildId(v); setSelectedTeacherId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueChildren.map((c: any) => (
                    <SelectItem key={c.studentId} value={String(c.studentId)}>{c.studentName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teacher</label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} disabled={!selectedChildId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedChildId ? "Select a teacher" : "Select a child first"} />
                </SelectTrigger>
                <SelectContent>
                  {teachersForChild.map((c: any) => (
                    <SelectItem key={c.teacherUserId} value={String(c.teacherUserId)}>
                      {c.teacherName} ({c.className})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input placeholder="Message subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea placeholder="Type your message..." value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMessageOpen(false)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={!selectedTeacherId || !subject.trim() || !body.trim() || createThreadMutation.isPending}
              onClick={() => createThreadMutation.mutate({
                teacherUserId: selectedTeacherId,
                studentId: selectedChildId,
                subject: subject.trim(),
                body: body.trim(),
              })}
            >
              <Send className="w-4 h-4" />
              {createThreadMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function ParentPage({ section = "dashboard" }: ParentPageProps) {
  const { toast } = useToast();
  const [linkCode, setLinkCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBasketForPayment, setSelectedBasketForPayment] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const childrenQuery = useQuery<any[]>({ queryKey: ['/api/parent/children'], queryFn: getQueryFn({ on401: 'throw' }) });
  const basketsQuery = useQuery<any[]>({ queryKey: ['/api/parent/baskets'], queryFn: getQueryFn({ on401: 'throw' }) });
  const paymentsQuery = useQuery<any[]>({ queryKey: ['/api/parent/payments'], queryFn: getQueryFn({ on401: 'throw' }) });
  const paymentInfoQuery = useQuery<any>({ queryKey: ['/api/school/payment-info'], queryFn: getQueryFn({ on401: 'returnNull' }), staleTime: 60_000 });
  const paymentAppName: string | null = paymentInfoQuery.data?.paymentAppName ?? null;

  const startScanner = async () => {
    setScannerError(null); setScannerOpen(true);
    try {
      const html5Qr = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qr;
      await html5Qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { const code = decodedText.trim().toUpperCase(); setLinkCode(code); stopScanner(); toast({ title: "Code Scanned", description: `Code "${code}" detected.` }); }, () => {});
    } catch (err: any) { setScannerError(err?.message || "Could not access camera."); setScannerOpen(false); }
  };
  const stopScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScannerOpen(false);
  };
  useEffect(() => { return () => { if (scannerRef.current) { try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {} } }; }, []);

  const linkChildMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/parent/link-child", { code: linkCode.toUpperCase() }); return res.json(); },
    onSuccess: () => { toast({ title: "Child Linked" }); setLinkCode(""); queryClient.invalidateQueries({ queryKey: ['/api/parent/children'] }); queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets'] }); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });
  const createBasketMutation = useMutation({
    mutationFn: async (studentId: string) => { const res = await apiRequest("POST", `/api/parent/children/${studentId}/basket`, {}); return res.json(); },
    onSuccess: () => { toast({ title: "Basket Created" }); queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets'] }); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });
  // Create order (awaiting external payment reference)
  const paymentMutation = useMutation({
    mutationFn: async ({ basketIds }: { basketIds: string[] }) => {
      const res = await apiRequest("POST", "/api/parent/payments", { basketIds });
      return res.json();
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/parent/baskets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/payments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Order Error", description: err.message, variant: "destructive" });
      setPaymentDialogOpen(false);
    },
  });

  // Submit external payment reference
  const submitReferenceMutation = useMutation({
    mutationFn: async ({ paymentId, referenceNumber, confirmed, notes }: { paymentId: string; referenceNumber: string; confirmed: boolean; notes?: string }) => {
      const res = await apiRequest("POST", `/api/parent/payments/${paymentId}/submit-reference`, { referenceNumber, confirmed, notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reference Submitted", description: "Your payment reference has been submitted for school review." });
      setReferenceDialogPayment(null);
      setRefNumber("");
      setRefConfirmed(false);
      setRefNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/parent/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parent/baskets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Submission Error", description: err.message, variant: "destructive" });
    },
  });

  // State for reference submission dialog
  const [referenceDialogPayment, setReferenceDialogPayment] = useState<any>(null);
  const [refNumber, setRefNumber] = useState("");
  const [refConfirmed, setRefConfirmed] = useState(false);
  const [refNotes, setRefNotes] = useState("");

  const children = childrenQuery.data || [];
  const baskets = basketsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const pendingBaskets = baskets.filter((b: any) => b.status === "pending");
  const processedBaskets = baskets.filter((b: any) => b.status !== "pending");
  const childrenWithoutBaskets = children.filter((c: any) => !baskets.some((b: any) => b.studentId === (c.studentId || c.student?.id)));

  const renderSection = () => {
    switch (section) {
      case "link":
        return <ParentLinkSection linkCode={linkCode} setLinkCode={setLinkCode} linkChildMutation={linkChildMutation} childrenQuery={childrenQuery} children={children} createBasketMutation={createBasketMutation} scannerOpen={scannerOpen} startScanner={startScanner} stopScanner={stopScanner} scannerError={scannerError} />;
      case "baskets":
        return <ParentBasketsSection basketsQuery={basketsQuery} baskets={baskets} children={children} pendingBaskets={pendingBaskets} processedBaskets={processedBaskets} childrenWithoutBaskets={childrenWithoutBaskets} createBasketMutation={createBasketMutation} setSelectedBasketForPayment={setSelectedBasketForPayment} setPaymentResult={setPaymentResult} setPaymentDialogOpen={setPaymentDialogOpen} paymentDialogOpen={paymentDialogOpen} paymentResult={paymentResult} selectedBasketForPayment={selectedBasketForPayment} paymentMutation={paymentMutation} paymentAppName={paymentAppName} />;
      case "payments":
        return <ParentPaymentsSection paymentsQuery={paymentsQuery} payments={payments} onSubmitReference={(p) => { setReferenceDialogPayment(p); setRefNumber(""); setRefConfirmed(false); setRefNotes(""); }} />;
      case "messages":
        return <ParentMessagesSection children={children} />;
      default:
        return <ParentDashboardSection children={children} baskets={baskets} payments={payments} isChildrenLoading={childrenQuery.isLoading} isBasketsLoading={basketsQuery.isLoading} isPaymentsLoading={paymentsQuery.isLoading} />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {renderSection()}
      {/* Reference Submission Dialog */}
      <Dialog open={!!referenceDialogPayment} onOpenChange={(open) => { if (!open) { setReferenceDialogPayment(null); setRefNumber(""); setRefConfirmed(false); setRefNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Submit Payment Reference</DialogTitle>
            <DialogDescription>
              Enter the payment reference number from {paymentAppName ? paymentAppName : "your school's payment app"} after completing your payment.
            </DialogDescription>
          </DialogHeader>
          {referenceDialogPayment && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Reference</span>
                  <span className="font-mono font-medium">{referenceDialogPayment.paymentReference}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                  <span>Amount</span>
                  <span className="text-primary text-lg">£{parseFloat(referenceDialogPayment.totalAmount || "0").toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref-number">Payment Reference Number *</Label>
                <Input
                  id="ref-number"
                  placeholder={`Enter reference from ${paymentAppName || "your school's payment app"}`}
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="font-mono"
                  data-testid="input-ref-number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref-notes">Additional Notes (optional)</Label>
                <Textarea
                  id="ref-notes"
                  placeholder="Any additional details about your payment..."
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="ref-confirmed"
                  checked={refConfirmed}
                  onChange={(e) => setRefConfirmed(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-confirm-payment"
                />
                <Label htmlFor="ref-confirmed" className="text-sm font-normal leading-snug cursor-pointer">
                  I confirm I have paid using the school&apos;s official payment system.
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => { setReferenceDialogPayment(null); setRefNumber(""); setRefConfirmed(false); setRefNotes(""); }}>
                Cancel
              </Button>
              <Button
                onClick={() => submitReferenceMutation.mutate({
                  paymentId: referenceDialogPayment.id,
                  referenceNumber: refNumber,
                  confirmed: refConfirmed,
                             notes: refNotes || undefined,
                })}
                disabled={submitReferenceMutation.isPending || !refNumber.trim() || !refConfirmed}
                data-testid="button-submit-reference"
              >
                {submitReferenceMutation.isPending ? "Submitting..." : "Submit Reference"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
