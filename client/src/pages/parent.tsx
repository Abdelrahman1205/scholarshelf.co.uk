import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Link as LinkIcon, History, CreditCard, Plus, Mail, BookOpen, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

export default function ParentDashboard() {
  const { toast } = useToast();
  const [linkCode, setLinkCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBasketForPayment, setSelectedBasketForPayment] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const childrenQuery = useQuery<any[]>({
    queryKey: ['/api/parent/children'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const basketsQuery = useQuery<any[]>({
    queryKey: ['/api/parent/baskets'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const paymentsQuery = useQuery<any[]>({
    queryKey: ['/api/parent/payments'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  const startScanner = async () => {
    setScannerError(null);
    setScannerOpen(true);
    try {
      const html5Qr = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const code = decodedText.trim().toUpperCase();
          setLinkCode(code);
          stopScanner();
          toast({ title: "Code Scanned", description: `Linking code "${code}" detected.` });
        },
        () => {}
      );
    } catch (err: any) {
      setScannerError(err?.message || "Could not access camera. Please check permissions.");
      setScannerOpen(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      }
    };
  }, []);

  const linkChildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/parent/link-child", { code: linkCode.toUpperCase() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Child Linked", description: "Child profile has been linked successfully." });
      setLinkCode("");
      queryClient.invalidateQueries({ queryKey: ['/api/parent/children'] });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets'] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createBasketMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await apiRequest("POST", `/api/parent/children/${studentId}/basket`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Basket Created", description: "Book basket has been generated." });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets'] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ basketIds, reference }: { basketIds: string[]; reference: string }) => {
      const res = await apiRequest("POST", "/api/parent/payments", {
        basketIds,
        paymentMethod: "bank_transfer",
        paymentReference: reference,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/payments'] });
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
      setPaymentDialogOpen(false);
    },
  });

  const children = childrenQuery.data || [];
  const baskets = basketsQuery.data || [];
  const payments = paymentsQuery.data || [];

  const pendingBaskets = baskets.filter((b: any) => b.status === "pending");
  const processedBaskets = baskets.filter((b: any) => b.status !== "pending");

  const childrenWithoutBaskets = children.filter(
    (c: any) => !baskets.some((b: any) => b.studentId === (c.studentId || c.student?.id))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">{status}</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">{status}</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Parent Portal</h1>
        <p className="text-muted-foreground mt-2">Manage your children's book requirements and payments.</p>
      </div>

      <Tabs defaultValue="baskets" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-card border border-border p-1 rounded-lg">
          <TabsTrigger data-testid="tab-baskets" value="baskets" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Baskets
          </TabsTrigger>
          <TabsTrigger data-testid="tab-link" value="link" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Child
          </TabsTrigger>
          <TabsTrigger data-testid="tab-history" value="history" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Baskets Tab */}
          <TabsContent value="baskets" className="m-0 space-y-6">
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
                        : "Link a child first using the Link Child tab, then create a book basket."}
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
                          <CardTitle className="text-xl">{basket.student?.name || "Child"}'s Books</CardTitle>
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
                              <CardTitle className="text-lg text-muted-foreground">{basket.student?.name || "Child"}'s Books</CardTitle>
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
          </TabsContent>

          {/* Link Child Tab */}
          <TabsContent value="link" className="m-0 max-w-2xl">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading">Link Your Child</CardTitle>
                <CardDescription>
                  Enter the linking code or scan the QR code provided by the school to connect your child's profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Linking Code</label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-link-code"
                      placeholder="e.g., A7B-9X2Z"
                      className="font-mono text-lg uppercase"
                      maxLength={8}
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                    />
                    <Button
                      data-testid="button-link-child"
                      onClick={() => linkChildMutation.mutate()}
                      disabled={linkCode.length < 8 || linkChildMutation.isPending}
                    >
                      Link Profile
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {!scannerOpen ? (
                    <Button
                      data-testid="button-open-scanner"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={startScanner}
                    >
                      <Camera className="w-4 h-4" />
                      Scan QR Code
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                        <div id="qr-reader" className="w-full" />
                        <Button
                          data-testid="button-close-scanner"
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 hover:text-white z-10"
                          onClick={stopScanner}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Point your camera at the QR code provided by the school.
                      </p>
                    </div>
                  )}
                  {scannerError && (
                    <p className="text-sm text-destructive">{scannerError}</p>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-medium mb-4">Currently Linked Children</h3>
                  {childrenQuery.isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading...</p>
                  ) : children.length === 0 ? (
                    <Card className="border-dashed border-2 bg-transparent shadow-none">
                      <CardContent className="flex flex-col items-center justify-center h-[120px] text-center">
                        <p className="text-muted-foreground text-sm">No children linked yet. Use a linking code above.</p>
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
                            <span className="text-muted-foreground text-sm ml-2">
                              ({child.student?.class?.name || "No class"})
                            </span>
                            <span className="text-muted-foreground text-xs ml-2 font-mono">
                              {child.student?.studentCode || ""}
                            </span>
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
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="history" className="m-0">
            {paymentsQuery.isLoading ? (
              <p className="text-muted-foreground">Loading payments...</p>
            ) : payments.length === 0 ? (
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <History className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-heading font-medium">Payment History</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    A list of past transactions and receipts will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
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
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right px-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment: any) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="px-6">
                            {payment.paidAt
                              ? new Date(payment.paidAt).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell data-testid={`text-payment-amount-${payment.id}`}>
                            £{parseFloat(payment.totalAmount || "0").toFixed(2)}
                          </TableCell>
                          <TableCell className="capitalize">{(payment.paymentMethod || "").replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            <span className="font-mono bg-muted px-2 py-1 rounded text-sm" data-testid={`text-payment-ref-${payment.id}`}>
                              {payment.paymentReference}
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            {getStatusBadge(payment.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Payment Dialog */}
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
              {paymentResult ? "Transfer Confirmed" : "Bank Transfer Details"}
            </DialogTitle>
            <DialogDescription>
              {paymentResult
                ? "Your payment has been recorded. The school will verify your transfer shortly."
                : "Please use the details below to make your bank transfer. Include the reference number exactly as shown."}
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
              <div className="rounded-lg border-2 border-primary/30 p-4 bg-primary/5 text-sm space-y-2">
                <p className="font-semibold text-primary">Bank Transfer Details</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sort Code</span>
                    <span className="font-mono font-medium">20-00-00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-mono font-medium">12345678</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-medium">EduBook School Ltd</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-primary/20 pt-2 mt-2">
                    <span className="text-muted-foreground">Payment Reference</span>
                    <span className="font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-md text-base" data-testid="text-payment-reference-preview">
                      {selectedBasketForPayment.generatedReference || "Generating..."}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 p-3 bg-amber-500/5 text-sm text-amber-700">
                <p className="font-medium">Important:</p>
                <p>Use the exact reference above when making your bank transfer so the school can match your payment.</p>
              </div>
            </div>
          )}

          {paymentResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 p-4 bg-emerald-500/5 text-sm space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Payment Recorded
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-medium" data-testid="text-payment-reference">
                    {paymentResult.paymentReference}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-emerald-500/20 pt-2 mt-2">
                  <span>Amount</span>
                  <span className="text-primary text-lg">£{parseFloat(paymentResult.totalAmount || "0").toFixed(2)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The school will verify your bank transfer and confirm the payment. You can track the status in your Payment History tab.
              </p>
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
                  onClick={() => paymentMutation.mutate({ basketIds: [selectedBasketForPayment.id], reference: selectedBasketForPayment.generatedReference })}
                  disabled={paymentMutation.isPending}
                  className="gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {paymentMutation.isPending ? "Processing..." : "I've Made the Transfer"}
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-close-payment"
                onClick={() => {
                  setPaymentDialogOpen(false);
                  setPaymentResult(null);
                  setSelectedBasketForPayment(null);
                }}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
