import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, ExternalLink, Globe, MessageSquare, Palette, Settings, ShieldCheck, Users } from "lucide-react";
import { navigateTo } from "./shared";

export function ItDashboardSection() {
  const { user } = useAuth();

  const { data: setup, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/setup-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: schoolSettings } = useQuery<any>({
    queryKey: ["/api/admin/school/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schoolName = setup?.school?.name || user?.schoolName || "School";
  const schoolCode = setup?.school?.code || user?.schoolCode || "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = schoolCode ? `${baseUrl}/school/${encodeURIComponent(schoolCode)}` : null;

  const readinessChecks = [
    { label: "School profile", done: !!setup?.checklist?.schoolProfileComplete },
    { label: "Branding configured", done: !!setup?.checklist?.brandingDesignConfigured },
    { label: "Communications ready", done: !!setup?.checklist?.parentsLinked },
    { label: "Operational setup", done: !!setup?.checklist?.operationalSetupComplete },
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
              <Button variant="outline" onClick={() => navigateTo("/admin/setup")}>Setup</Button>
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
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              Website Communications
            </CardTitle>
            <CardDescription>Monitor inbound conversations and reply workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Review current message threads and maintain response quality.
            </div>
            <Button variant="outline" onClick={() => navigateTo("/admin/communications")}>Open Communications</Button>
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
              Website Operations
            </CardTitle>
            <CardDescription>Core data used on public and admin-facing school pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">Payment app label</div>
              <div className="font-medium mt-1">{schoolSettings?.paymentAppName || "Not configured"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigateTo("/admin/users")}>
                <Users className="h-4 w-4 mr-2" />Manage Access
              </Button>
              <Button variant="outline" onClick={() => navigateTo("/admin/setup")}>Setup And Settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
