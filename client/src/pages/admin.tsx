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

          <TabsContent value="codes" className="m-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search by student name or code..." className="pl-9 bg-card" />
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Generate Codes (Bulk)
              </Button>
            </div>
            
            <Card className="border-border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Linking Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { student: "Emma Thompson", grade: "Year 4", code: "A7B-9X2", status: "Used", expires: "2026-09-01" },
                    { student: "Oliver Davis", grade: "Year 4", code: "M3V-8P1", status: "Unused", expires: "2026-09-01" },
                    { student: "James Wilson", grade: "Year 2", code: "K9R-2L4", status: "Used", expires: "2026-09-01" },
                    { student: "Sophia Martinez", grade: "Year 3", code: "-", status: "Not Generated", expires: "-" },
                  ].map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.student}</TableCell>
                      <TableCell className="text-muted-foreground">{row.grade}</TableCell>
                      <TableCell>
                        {row.code !== "-" ? (
                          <code className="bg-muted px-2 py-1 rounded font-mono text-sm">{row.code}</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status === "Used" && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Used</Badge>}
                        {row.status === "Unused" && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Unused</Badge>}
                        {row.status === "Not Generated" && <Badge variant="outline" className="text-muted-foreground">Not Generated</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.expires}</TableCell>
                      <TableCell className="text-right">
                        {row.status === "Not Generated" ? (
                          <Button variant="outline" size="sm">Generate</Button>
                        ) : row.status === "Unused" ? (
                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">Copy / Print</Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>Linked</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Placeholder for other tabs */}
          {["inventory", "levels", "payments", "allocations"].map(tab => (
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
