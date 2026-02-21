import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Admin Console</h1>
        <p className="text-muted-foreground mt-2">Manage the complete lifecycle of books, inventory, and distribution.</p>
      </div>

      <Tabs defaultValue="books" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1 bg-card border border-border rounded-lg gap-1">
          <TabsTrigger value="books" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Book className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Books</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <PackageSearch className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="levels" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Layers className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Book Levels</span>
          </TabsTrigger>
          <TabsTrigger value="codes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <Key className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Linking Codes</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <CreditCard className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="allocations" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 rounded-md transition-all">
            <BoxSelect className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Allocations</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="books" className="m-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search by title, author, or ISBN..." className="pl-9 bg-card" />
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add New Book
              </Button>
            </div>
            
            <Card className="border-border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Mock Data */}
                  {[
                    { title: "Mathematics Year 4", author: "Sarah Jenkins", isbn: "978-1-2345-6789-0", price: "£24.99", stock: 150, active: true },
                    { title: "English Literature Anthology", author: "David Smith", isbn: "978-0-9876-5432-1", price: "£18.50", stock: 85, active: true },
                    { title: "Science Explorer Pack", author: "C. Darwin", isbn: "978-3-4567-8901-2", price: "£32.00", stock: 12, active: true, lowStock: true },
                    { title: "History of the World", author: "M. Historian", isbn: "978-4-5678-9012-3", price: "£21.99", stock: 0, active: false },
                  ].map((book, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{book.title}</TableCell>
                      <TableCell className="text-muted-foreground">{book.author}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{book.isbn}</TableCell>
                      <TableCell>{book.price}</TableCell>
                      <TableCell>
                        <span className={book.lowStock ? "text-destructive font-medium" : ""}>
                          {book.stock}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={book.active ? "default" : "secondary"} className={book.active ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}>
                          {book.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Placeholder for other tabs */}
          {["inventory", "levels", "codes", "payments", "allocations"].map(tab => (
            <TabsContent key={tab} value={tab} className="m-0">
              <Card className="border-dashed border-2 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    {tab === "inventory" && <PackageSearch className="w-6 h-6" />}
                    {tab === "levels" && <Layers className="w-6 h-6" />}
                    {tab === "codes" && <Key className="w-6 h-6" />}
                    {tab === "payments" && <CreditCard className="w-6 h-6" />}
                    {tab === "allocations" && <BoxSelect className="w-6 h-6" />}
                  </div>
                  <h3 className="text-lg font-heading font-medium capitalize">{tab} Tab Content</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    This section will contain the management interface for {tab} as per the specification.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
