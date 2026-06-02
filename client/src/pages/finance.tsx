import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface FinancePageProps {
  section?: string;
}

export default function FinancePage({ section = "dashboard" }: FinancePageProps) {
  const { user } = useAuth();

  if (section !== "dashboard") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Finance Workspace</h1>
          <p className="text-muted-foreground mt-2">Section not found. Redirect to dashboard from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome {user?.name || "Finance User"}. Your finance account is active.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</div>
              <div className="text-base font-semibold text-emerald-700">Finance</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Scope</div>
              <Badge variant="secondary" className="mt-1">School Scoped</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-none shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</div>
              <div className="text-base font-semibold text-amber-700">Enabled</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-heading">Next Step</CardTitle>
          <CardDescription>
            Finance account routing is now active. If you want, I can add payment-review tools and finance reports in this area next.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
