import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Link as LinkIcon, History, CreditCard, ChevronRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ParentDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Parent Portal</h1>
        <p className="text-muted-foreground mt-2">Manage your children's book requirements and payments.</p>
      </div>

      <Tabs defaultValue="baskets" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-card border border-border p-1 rounded-lg">
          <TabsTrigger value="baskets" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Baskets
          </TabsTrigger>
          <TabsTrigger value="link" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Child
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="baskets" className="m-0 space-y-6">
            
            <Alert className="bg-primary/5 border-primary/20 text-primary">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>
                You have 1 pending basket for the new academic year. Please complete payment before Sept 1st.
              </AlertDescription>
            </Alert>

            {/* Pending Basket Card */}
            <Card className="border-border shadow-sm border-t-4 border-t-primary overflow-hidden">
              <CardHeader className="bg-muted/20 pb-4 border-b border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Emma Thompson's Books</CardTitle>
                    <CardDescription className="mt-1">Year 4 Pack • Academic Year 2026/2027</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                    Pending Payment
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[
                    { title: "Mathematics Year 4", price: 24.99 },
                    { title: "English Literature Anthology", price: 18.50 },
                    { title: "Science Explorer Pack", price: 32.00 },
                    { title: "Art Supplies Starter Kit", price: 15.00 },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between p-4 px-6 text-sm">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-muted-foreground">£{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between p-4 px-6 font-semibold bg-muted/10">
                    <span>Total Required</span>
                    <span className="text-lg text-primary">£90.49</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-6 bg-card flex justify-between items-center border-t border-border">
                <p className="text-sm text-muted-foreground">Reference: <span className="font-mono bg-muted px-2 py-1 rounded">EDU-ABC1-1234</span></p>
                <Button className="gap-2 shadow-sm">
                  <CreditCard className="w-4 h-4" />
                  Proceed to Payment
                </Button>
              </CardFooter>
            </Card>

            {/* Completed Basket Card */}
            <Card className="border-border shadow-none opacity-75">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-muted-foreground">James Wilson's Books</CardTitle>
                    <CardDescription>Year 2 Pack • Paid on Aug 15</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                    Paid & Allocated
                  </Badge>
                </div>
              </CardHeader>
            </Card>

          </TabsContent>

          <TabsContent value="link" className="m-0 max-w-2xl">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Link Your Child</CardTitle>
                <CardDescription>
                  Enter the 7-digit linking code provided by the school to connect your child's profile to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Linking Code</label>
                  <div className="flex gap-2">
                    <Input placeholder="e.g., A7B-9X2" className="font-mono text-lg uppercase" maxLength={7} />
                    <Button>Link Profile</Button>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-medium mb-4">Currently Linked Children</h3>
                  <div className="space-y-3">
                    {["Emma Thompson (Year 4)", "James Wilson (Year 2)"].map((child, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border bg-card">
                        <span className="font-medium">{child}</span>
                        <Button variant="outline" size="sm">View Baskets</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="m-0">
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
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
