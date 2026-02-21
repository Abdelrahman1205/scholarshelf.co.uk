import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Link as LinkIcon, History, CreditCard, Plus, Mail, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ParentDashboard() {
  const { toast } = useToast();
  const [parentId, setParentId] = useState<string | null>(() => localStorage.getItem("parentIdentifier"));
  const [emailInput, setEmailInput] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBasketForPayment, setSelectedBasketForPayment] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const handleSetParentId = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    localStorage.setItem("parentIdentifier", trimmed);
    setParentId(trimmed);
  };

  const childrenQuery = useQuery<any[]>({
    queryKey: ['/api/parent/children?parentIdentifier=' + parentId],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!parentId,
  });

  const basketsQuery = useQuery<any[]>({
    queryKey: ['/api/parent/baskets?parentIdentifier=' + parentId],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!parentId,
  });

  const paymentsQuery = useQuery<any[]>({
    queryKey: ['/api/parent/payments?parentIdentifier=' + parentId],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!parentId,
  });

  const linkChildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/parent/link-child", { code: linkCode.toUpperCase(), parentIdentifier: parentId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Child Linked", description: "Child profile has been linked successfully." });
      setLinkCode("");
      queryClient.invalidateQueries({ queryKey: ['/api/parent/children?parentIdentifier=' + parentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets?parentIdentifier=' + parentId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createBasketMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await apiRequest("POST", `/api/parent/children/${studentId}/basket`, { parentIdentifier: parentId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Basket Created", description: "Book basket has been generated." });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets?parentIdentifier=' + parentId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (basketIds: string[]) => {
      const res = await apiRequest("POST", "/api/parent/payments", {
        basketIds,
        parentIdentifier: parentId,
        paymentMethod: "bank_transfer",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/parent/baskets?parentIdentifier=' + parentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/parent/payments?parentIdentifier=' + parentId] });
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
      setPaymentDialogOpen(false);
    },
  });

  if (!parentId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-heading">Welcome, Parent!</CardTitle>
            <CardDescription>Enter your email address to get started with the Parent Portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              data-testid="input-parent-email"
              type="email"
              placeholder="your@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetParentId()}
            />
            <Button
              data-testid="button-get-started"
              className="w-full"
              onClick={handleSetParentId}
              disabled={!emailInput.trim()}
            >
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                          setSelectedBasketForPayment(basket);
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
                  Enter the 7-digit linking code provided by the school to connect your child's profile to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Linking Code</label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-link-code"
                      placeholder="e.g., A7B9X2Z"
                      className="font-mono text-lg uppercase"
                      maxLength={7}
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                    />
                    <Button
                      data-testid="button-link-child"
                      onClick={() => linkChildMutation.mutate()}
                      disabled={linkCode.length < 7 || linkChildMutation.isPending}
                    >
                      Link Profile
                    </Button>
                  </div>
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
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {paymentResult ? "Payment Submitted" : "Confirm Payment"}
            </DialogTitle>
            <DialogDescription>
              {paymentResult
                ? "Your payment has been recorded. Please complete the bank transfer using the details below."
                : "Review the payment details and confirm to proceed."}
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
              <div className="rounded-lg border border-border p-4 bg-muted/20 text-sm space-y-1">
                <p className="font-medium">Bank Transfer Instructions</p>
                <p>Sort Code: 20-00-00</p>
                <p>Account: 12345678</p>
                <p>Reference: Will be generated upon confirmation</p>
              </div>
            </div>
          )}

          {paymentResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Reference</span>
                  <span className="font-mono font-medium bg-muted px-2 py-1 rounded" data-testid="text-payment-reference">
                    {paymentResult.paymentReference}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                  <span>Total Amount</span>
                  <span className="text-primary text-lg">£{parseFloat(paymentResult.totalAmount || "0").toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/20 text-sm space-y-1">
                <p className="font-medium">Bank Transfer Instructions</p>
                <p>Sort Code: 20-00-00</p>
                <p>Account: 12345678</p>
                <p>Reference: <span className="font-mono font-semibold">{paymentResult.paymentReference}</span></p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!paymentResult ? (
              <Button
                data-testid="button-confirm-payment"
                onClick={() => paymentMutation.mutate([selectedBasketForPayment.id])}
                disabled={paymentMutation.isPending}
                className="gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {paymentMutation.isPending ? "Processing..." : "Confirm Payment"}
              </Button>
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
