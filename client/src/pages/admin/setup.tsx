import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen, PackageSearch, Layers, Key, CreditCard, BoxSelect, Search, Plus,
  Mail, UserPlus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight,
  QrCode, Download, ScanBarcode, Camera, X, Loader2, GraduationCap, Users,
  Package, TrendingUp, TrendingDown, ClipboardList, CheckCircle2, Clock,
  XCircle, Eye, History, BarChart2, Settings, MessageSquare, ArrowLeft,
  Archive, RefreshCw, Printer, ShieldAlert, ShieldOff, Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  navigateTo, formatSchoolDisplay, StatusBadge, formatDateTime,
  normalizeRole, roleLabel, isProtectedPlatformOwner, BRANDING_PERMISSION_OPTIONS
} from "./shared";

// ─── SETUP ────────────────────────────────────────────────────────────────────
function SetupSection() {
  const { toast } = useToast();

  const { data: setup, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/setup-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/setup-complete", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Setup completed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const inviteStatusLabel: Record<string, string> = {
    not_invited: "Not invited",
    pending: "Invite pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
  };

  const setupStatusLabel: Record<string, string> = {
    school_created: "School created",
    pending_admin_invite: "Pending admin invite",
    pending_admin_acceptance: "Pending admin acceptance",
    admin_accepted: "Admin accepted",
    operational_setup_in_progress: "Setup in progress",
    operational_setup_complete: "Operational setup complete",
    complete: "Complete",
    active: "Active",
  };

  const canGoDashboard = !!setup?.firstAdminAccepted && (setup?.setupStatus === "operational_setup_in_progress" || setup?.setupStatus === "operational_setup_complete" || setup?.setupStatus === "complete" || setup?.setupStatus === "active");
  const setupComplete = !!setup?.operationalSetupCompleted && !!setup?.schoolActive;
  const firstInvitePending = setup?.firstAdminInviteStatus === "pending";
  const readyForOperationalCompletion = !!setup?.readyForOperationalCompletion;

  const setupChecklistOrder = [
    { key: "schoolProfileComplete", label: "School profile complete" },
    { key: "classesCreated", label: "Classes created" },
    { key: "booksAdded", label: "Books added" },
    { key: "bookLevelsCreated", label: "Book levels created" },
    { key: "bookLevelsAssignedToClasses", label: "Book levels assigned to classes" },
    { key: "studentsAdded", label: "Students added" },
    { key: "parentCodesGenerated", label: "Parent invites sent" },
    { key: "parentsLinked", label: "Parents linked" },
    { key: "paymentSetupReviewed", label: "Payment setup reviewed" },
    { key: "operationalSetupComplete", label: "Operational setup complete" },
  ];

  const checklistSteps = setupChecklistOrder.map((step) => ({
    ...step,
    done: !!setup?.checklist?.[step.key],
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Continue School Setup</h1>
          <p className="text-muted-foreground text-sm mt-1">Finish the remaining onboarding steps for your school tenant.</p>
        </div>
        {canGoDashboard && (
          <Button onClick={() => navigateTo("/admin")} variant="outline">Go to Dashboard</Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">School</p>
            <p className="text-lg font-semibold mt-1">{setup?.school?.name || "School setup"}</p>
            <p className="text-sm text-muted-foreground mt-1">{setup?.school?.code || "Awaiting school details"}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">Status: {(setup?.schoolStatus || setup?.school?.status || "pending_setup").replace(/_/g, " ")}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Setup status</p>
            <p className="text-lg font-semibold mt-1">{setupStatusLabel[setup?.setupStatus || ""] || "Pending"}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{(setup?.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">First admin invite</p>
            <p className="text-lg font-semibold mt-1">{setup?.firstAdminEmail || setup?.invite?.email || "Not invited"}</p>
            <p className="text-sm text-muted-foreground mt-1">{inviteStatusLabel[setup?.firstAdminInviteStatus || "not_invited"] || "Not invited"}</p>
          </CardContent>
        </Card>
      </div>

      {setup && (
        <Alert className={setupComplete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          {setupComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
          <AlertTitle>{setupComplete ? "Setup complete" : firstInvitePending ? "Waiting for invite acceptance" : "Setup in progress"}</AlertTitle>
          <AlertDescription>{setup.nextStep}</AlertDescription>
        </Alert>
      )}

      {firstInvitePending && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle>Waiting for admin to accept invite</AlertTitle>
          <AlertDescription>
            The first School Admin invitation is still pending. Ask the owner to resend the invite from the Schools page if needed.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Setup checklist</CardTitle>
          <CardDescription>
            {setup?.setupProgress
              ? `${setup.setupProgress.done} of ${setup.setupProgress.total} steps complete (${setup.setupProgress.percent}%).`
              : "Track the handoff from school creation to full operational readiness."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading setup progress...</p>}
          {checklistSteps.map((step) => (
            <div key={step.label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium">{step.label}</span>
              <Badge variant="outline" className={step.done ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                {step.done ? "Done" : "Pending"}
              </Badge>
            </div>
          ))}

          {!!setup?.missingSteps?.length && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Missing steps</AlertTitle>
              <AlertDescription>{setup.missingSteps.join(" · ")}</AlertDescription>
            </Alert>
          )}

          {!!setup?.completionRules?.length && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Completion rules</p>
              <div className="space-y-1">
                {setup.completionRules.map((rule: string) => (
                  <p key={rule} className="text-sm text-muted-foreground">• {rule}</p>
                ))}
              </div>
            </div>
          )}

          {!setupComplete && (
            <div className="pt-2 flex flex-wrap gap-2">
              <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || !setup?.firstAdminAccepted || !readyForOperationalCompletion}>
                {completeMutation.isPending ? "Completing..." : "Mark Setup Complete"}
              </Button>
              {!readyForOperationalCompletion && (
                <p className="text-xs text-muted-foreground self-center">Complete all prerequisite setup steps first.</p>
              )}
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] })}>
                Refresh Status
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export { SetupSection };
