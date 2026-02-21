import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, Circle, Users, BookOpen } from "lucide-react";

export default function TeacherDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Teacher Portal</h1>
          <p className="text-muted-foreground mt-2">Confirm textbook receipt for your students.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border shadow-sm">
          <Select defaultValue="class-4a">
            <SelectTrigger className="w-[180px] border-none bg-transparent shadow-none focus:ring-0">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="class-3a">Year 3 - Group A</SelectItem>
              <SelectItem value="class-4a">Year 4 - Group A</SelectItem>
              <SelectItem value="class-4b">Year 4 - Group B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <Card className="bg-primary/5 border-none shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Class Size</div>
              <div className="text-2xl font-bold font-heading text-primary">24 Students</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Books Distributed</div>
              <div className="text-2xl font-bold font-heading text-emerald-600">86%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Pending Receipt</div>
              <div className="text-2xl font-bold font-heading text-amber-600">14 Books</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input type="search" placeholder="Search student name..." className="pl-9 bg-card" />
      </div>

      <div className="space-y-4">
        {/* Student Cards Mockup */}
        {[
          { name: "Emma Thompson", received: 5, total: 5, status: "complete" },
          { name: "James Wilson", received: 2, total: 5, status: "pending" },
          { name: "Oliver Davis", received: 0, total: 5, status: "pending" }
        ].map((student, idx) => (
          <Card key={idx} className="overflow-hidden border-border transition-all hover:shadow-md">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {student.name}
                  {student.status === "complete" && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 ml-2">All Received</Badge>}
                </CardTitle>
                <CardDescription>Student ID: STU-{1000 + idx} • Year 4</CardDescription>
              </div>
              <div className="text-sm font-medium bg-card px-3 py-1 rounded-full border border-border">
                {student.received} / {student.total} Books
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map((book) => {
                  const isReceived = book <= student.received;
                  return (
                    <div key={book} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">Mathematics Year 4 - Volume {book}</span>
                        <span className="text-xs text-muted-foreground font-mono">ISBN: 978-1-2345-67{book}</span>
                      </div>
                      <Button 
                        variant={isReceived ? "outline" : "default"} 
                        size="sm"
                        className={isReceived ? "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 pointer-events-none" : "gap-2"}
                      >
                        {isReceived ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmed
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 mr-1" /> Confirm Receipt
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
