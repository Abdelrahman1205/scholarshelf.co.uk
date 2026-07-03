import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, ExternalLink, FileText, Globe, Palette, Settings, ShieldCheck, ShoppingCart, SquareStack } from "lucide-react";
import { navigateTo } from "./shared";

export function ItDashboardSection() {
  const { user } = useAuth();

  const { data: summary, isLoading, error } = useQuery<any>({
    queryKey: ["/api/it/website-summary"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schoolName = summary?.school?.name || user?.schoolName || "School";
  const schoolCode = summary?.school?.code || user?.schoolCode || "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = schoolCode ? `${baseUrl}/school/${encodeURIComponent(schoolCode)}` : null;

  const readinessChecks = [
    { label: "School profile", done: !!summary?.checklist?.schoolProfileComplete },
    { label: "Branding configured", done: !!summary?.checklist?.brandingDesignConfigured },
    { label: "Operational setup", done: !!summary?.checklist?.operationalSetupComplete },
  ];

  const completedChecks = readinessChecks.filter((item) => item.done).length;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-24 bg-muted/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, idx) => (
            <div key={idx} className="h-44 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Website control panel failed to load</AlertTitle>
        <AlertDescription>
          We could not load school website control data. Refresh the page or contact platform support if this keeps happening.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Website Control Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {schoolName}{schoolCode ? ` (${schoolCode})` : ""}
          </p>
        </div>
        <Badge variant="outline" className="w-fit bg-blue-50 text-blue-700 border-blue-200">
          IT Personnel
        </Badge>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Role separation is active</AlertTitle>
        <AlertDescription>
          This dashboard is limited to school website pages, design, public content, forms, and website shop configuration.
          Internal operations such as students, classes, payments, inventory, and staff administration remain School Admin only.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              School Website
            </CardTitle>
            <CardDescription>Public school landing page status and quick access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground break-all">{publicUrl || "School code missing"}</div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => { if (publicUrl) window.open(publicUrl, "_blank", "noopener,noreferrer"); }}
                disabled={!publicUrl}
              >
                <ExternalLink className="h-4 w-4 mr-2" />Open Public Page
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-600" />
              Branding And Theme
            </CardTitle>
            <CardDescription>Manage website look and school identity assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Keep logos, colors, and visual identity aligned with school standards.
            </div>
            <Button variant="outline" onClick={() => navigateTo("/admin/branding")}>Open Branding Tools</Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <SquareStack className="h-4 w-4 text-emerald-600" />
              Website Builder Modules
            </CardTitle>
            <CardDescription>Core modules for no-code public website management.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-md border px-3 py-2">Pages And Navigation</div>
              <div className="rounded-md border px-3 py-2">Announcements And News</div>
              <div className="rounded-md border px-3 py-2">Events And Galleries</div>
              <div className="rounded-md border px-3 py-2">Downloads And Policies</div>
            </div>
            <Button onClick={() => navigateTo("/admin/website-content")}>
              <Globe className="h-4 w-4 mr-2" />Edit Page Sections
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Website Readiness Checks
            </CardTitle>
            <CardDescription>
              {completedChecks} of {readinessChecks.length} checks complete
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {readinessChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{check.label}</span>
                <Badge
                  variant="outline"
                  className={check.done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}
                >
                  {check.done ? "Ready" : "Needs Work"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-700" />
              Website Operations And Settings
            </CardTitle>
            <CardDescription>Public site controls available to IT website personnel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">Payment app label</div>
              <div className="font-medium mt-1">{summary?.school?.paymentAppName || "Not configured"}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-md border px-3 py-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Forms And Enquiries
              </div>
              <div className="rounded-md border px-3 py-2 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Website Shop Items
              </div>
              <div className="rounded-md border px-3 py-2">SEO And Social Links</div>
              <div className="rounded-md border px-3 py-2">Footer, Contact, Map, Hours</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
