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

// ─── OWNER SECTIONS ───────────────────────────────────────────────────────────
function OwnerDashboardSection() {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/owner/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: schoolsData } = useQuery<any>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schools = Array.isArray(schoolsData) ? schoolsData : (schoolsData?.items || []);
  const schoolLabelById = new Map<string, string>(
    schools.map((school: any) => [school.id, `${school.name || "School"}${school.code ? ` (${school.code})` : ""}`]),
  );

  const formatTargetLabel = (item: any): string => {
    if (item?.targetLabel) return item.targetLabel;
    const rawTarget = String(item?.target || "");
    if (rawTarget.startsWith("school:")) {
      const schoolId = rawTarget.slice("school:".length);
      return schoolLabelById.get(schoolId) || "School";
    }
    return rawTarget || "Platform";
  };

  if (isLoading) {
    return <Card className="border-border shadow-none"><CardContent className="py-10 text-center text-muted-foreground">Loading owner dashboard...</CardContent></Card>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Owner dashboard unavailable</AlertTitle>
        <AlertDescription>{(error as Error)?.message || "Please try again."}</AlertDescription>
      </Alert>
    );
  }

  const cards = [
    { label: "Total schools", value: data?.totalSchools },
    { label: "Pending setup schools", value: data?.pendingSetupSchools },
    { label: "Pending admin invite", value: data?.pendingAdminInviteSchools },
    { label: "Pending admin acceptance", value: data?.pendingAdminAcceptanceSchools },
    { label: "Setup in progress", value: data?.setupInProgressSchools },
    { label: "Active schools", value: data?.activeSchools },
    { label: "Suspended schools", value: data?.suspendedSchools },
    { label: "Pending first admin invites", value: data?.pendingInvites },
    { label: "Expired first admin invites", value: data?.expiredInvites },
    { label: "Schools needing attention", value: data?.schoolsNeedingAttention },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">BytHub Platform Owner</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform onboarding and school lifecycle control center outside Support Mode.</p>
        </div>
        <Button variant="outline" onClick={() => navigateTo("/admin/schools")}>Manage Schools</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="border-border shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value ?? "Not available"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Recent setup and support activity</CardTitle>
          <CardDescription>Latest owner-level onboarding and support actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recentActivity || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No recent setup/support activity available.</p>
          )}
          {(data?.recentActivity || []).map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium capitalize">{String(item.action || "activity").replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatTargetLabel(item)}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerPendingSetupsSection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/pending-setups"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading pending setups...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load pending setups</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pending Setups</h1>
        <p className="text-muted-foreground text-sm mt-1">Schools that are not fully onboarded yet.</p>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Setup Status</TableHead>
              <TableHead>Invite Status</TableHead>
              <TableHead>First Admin Email</TableHead>
              <TableHead>Recommended Action</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items || []).map((item: any) => (
              <TableRow key={item.schoolId}>
                <TableCell className="font-medium">{item.schoolName}</TableCell>
                <TableCell>{item.schoolCode}</TableCell>
                <TableCell className="capitalize">{String(item.setupStatus || "").replace(/_/g, " ")}</TableCell>
                <TableCell className="capitalize">{String(item.firstAdminInviteStatus || "").replace(/_/g, " ")}</TableCell>
                <TableCell>{item.firstAdminEmail || "Not invited"}</TableCell>
                <TableCell>{item.recommendedNextAction}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(item.schoolId)}`)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
            {(data?.items || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No pending setups.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerAdminInvitesSection() {
  const { toast } = useToast();
  const { data: schools = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => apiRequest("POST", `/api/owner/invites/${inviteId}/resend`),
    onSuccess: async (response) => {
      const payload = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      if (payload.inviteLink && (payload.manualInviteLinkAllowed || import.meta.env.DEV || !payload.emailSent)) {
        navigator.clipboard.writeText(payload.inviteLink).catch(() => {});
      }
      toast({
        title: "Invite resent",
        description: payload.emailSent
          ? "Invite email sent."
          : "Email sending is not configured. Copy the invite link and send manually.",
      });
    },
    onError: (err: any) => toast({ title: "Resend failed", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => apiRequest("POST", `/api/owner/invites/${inviteId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      toast({ title: "Invite revoked" });
    },
    onError: (err: any) => toast({ title: "Revoke failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading invites...</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Admin Invites</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor and manage first School Admin invites.</p>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>First Admin Email</TableHead>
              <TableHead>Invite Status</TableHead>
              <TableHead>Setup Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school: any) => (
              <TableRow key={school.id}>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.firstAdminEmail || "Not invited"}</TableCell>
                <TableCell className="capitalize">{String(school.firstAdminInviteStatus || "not_invited").replace(/_/g, " ")}</TableCell>
                <TableCell className="capitalize">{String(school.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!school.latestInviteId || resendMutation.isPending}
                    onClick={() => school.latestInviteId && resendMutation.mutate(school.latestInviteId)}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!school.latestInviteId || revokeMutation.isPending || school.firstAdminInviteStatus === "accepted"}
                    onClick={() => school.latestInviteId && revokeMutation.mutate(school.latestInviteId)}
                  >
                    Revoke
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
            {schools.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No schools available.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerEmailStatusSection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/email-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading email status...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load email status</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Email Status</h1>
        <p className="text-muted-foreground text-sm mt-1">Invite delivery and manual fallback monitoring.</p>
      </div>

      <Alert className={data?.emailConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        {data?.emailConfigured ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        <AlertTitle>Email configured: {data?.emailConfigured ? "Yes" : "No"}</AlertTitle>
        <AlertDescription>{data?.message}</AlertDescription>
      </Alert>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Recent first-admin invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recentInvites || []).length === 0 && <p className="text-sm text-muted-foreground">No invite activity available.</p>}
          {(data?.recentInvites || []).map((invite: any) => (
            <div key={invite.inviteId} className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{invite.schoolName}</p>
                <p className="text-xs text-muted-foreground mt-1">{invite.email} · {String(invite.status || "pending").replace(/_/g, " ")}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(invite.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerActivitySection() {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/activity"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: schoolsData } = useQuery<any>({
    queryKey: ["/api/owner/schools"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const schools = Array.isArray(schoolsData) ? schoolsData : (schoolsData?.items || []);
  const schoolLabelById = new Map<string, string>(
    schools.map((school: any) => [school.id, `${school.name || "School"}${school.code ? ` (${school.code})` : ""}`]),
  );

  const formatTarget = (item: any): string => {
    if (item?.targetLabel) return item.targetLabel;

    const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : null;
    const metadataSchoolName = metadata?.schoolName || metadata?.name || metadata?.school?.name;
    if (metadataSchoolName) return metadataSchoolName;

    const rawTarget = String(item?.target || "");
    if (rawTarget.startsWith("school:")) {
      const schoolId = rawTarget.slice("school:".length);
      return schoolLabelById.get(schoolId) || "School";
    }

    return rawTarget || "Platform";
  };

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading activity logs...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load activity logs</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Owner-level audit events for onboarding and support actions.</p>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items || []).map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="capitalize">{String(item.action || "").replace(/_/g, " ")}</TableCell>
                <TableCell>{formatTarget(item)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.actorName || item.actorUserId || "System"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</TableCell>
              </TableRow>
            ))}
            {(data?.items || []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No activity available.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OwnerSettingsSection() {
  const { data } = useQuery<any>({
    queryKey: ["/api/owner/email-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Owner Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-level owner controls and protected account state.</p>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Platform profile</CardTitle>
          <CardDescription>Read-only owner-level settings in this build.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Organisation:</span> BytHub</p>
          <p><span className="font-medium">Support email configured:</span> {data?.emailConfigured ? "Yes" : "No"}</p>
          <p><span className="font-medium">Invite expiry:</span> 7 days</p>
          <p><span className="font-medium">Owner account:</span> Protected from standard role-change and delete flows</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerSchoolDetailsSection() {
  const params = new URLSearchParams(window.location.search);
  const schoolId = params.get("schoolId") || "";

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/owner/schools/detail", schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/owner/schools/${encodeURIComponent(schoolId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load school details");
      return res.json();
    },
    enabled: !!schoolId,
  });

  if (!schoolId) {
    return <Alert><AlertTitle>No school selected</AlertTitle><AlertDescription>Select a school from the Schools page.</AlertDescription></Alert>;
  }

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading school details...</CardContent></Card>;
  if (isError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Failed to load school details</AlertTitle></Alert>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">School details, setup lifecycle, and first admin status.</p>
        </div>
        <Button variant="outline" onClick={() => navigateTo("/admin/schools")}>Back to Schools</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">School code</p><p className="text-lg font-semibold mt-1">{data.code}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">School status</p><p className="text-lg font-semibold mt-1 capitalize">{String(data.status || "pending_setup").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Setup status</p><p className="text-lg font-semibold mt-1 capitalize">{String(data.setupStatus || "pending_admin_invite").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">First admin email</p><p className="text-sm font-medium mt-1">{data.firstAdminEmail || "Not invited"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Invite status</p><p className="text-sm font-medium mt-1 capitalize">{String(data.firstAdminInviteStatus || "not_invited").replace(/_/g, " ")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Updated</p><p className="text-sm font-medium mt-1">{formatDateTime(data.updatedAt)}</p></CardContent></Card>
      </div>
    </div>
  );
}

function SchoolsSection() {
  const { toast } = useToast();
  const { enterSupportMode, isEnteringSupport } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [inviteSummary, setInviteSummary] = useState<{ schoolName: string; inviteLink: string; emailSent: boolean; manualInviteLinkAllowed?: boolean } | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    status: "pending_setup",
    firstAdminName: "",
    firstAdminEmail: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    notes: "",
  });

  // Danger Zone state
  const [dangerAction, setDangerAction] = useState<"suspend" | "archive" | "restore" | "request_deletion" | "delete" | null>(null);
  const [dangerSchool, setDangerSchool] = useState<any>(null);
  const [dangerReason, setDangerReason] = useState("");
  const [dangerConfirmText, setDangerConfirmText] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);

  async function handleEnterSupport(schoolId: string) {
    try {
      await enterSupportMode(schoolId);
      toast({ title: "Support mode activated" });
      navigateTo("/admin");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const { data: schools = [] } = useQuery<any[]>({
    queryKey: ["/api/owner/schools", statusFilter === "deleted" ? "includeDeleted" : ""],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter === "deleted") params.set("includeDeleted", "true");
      if (statusFilter !== "all" && statusFilter !== "deleted") params.set("status", statusFilter);
      const res = await fetch(`/api/owner/schools?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load schools");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const schoolResponse = await apiRequest("POST", "/api/owner/schools", data.school);
      const school = await schoolResponse.json();
      let invite: any = null;
      if (data.firstAdminName && data.firstAdminEmail) {
        const inviteResponse = await apiRequest("POST", `/api/owner/schools/${school.id}/invite-admin`, {
          adminName: data.firstAdminName,
          adminEmail: data.firstAdminEmail,
        });
        invite = await inviteResponse.json();
      }
      return { school, invite };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setAddOpen(false);
      if (result.invite) {
        setInviteSummary({
          schoolName: result.school.name,
          inviteLink: result.invite.inviteLink,
          emailSent: result.invite.emailSent,
          manualInviteLinkAllowed: result.invite.manualInviteLinkAllowed,
        });
      }
      if (result.invite?.inviteLink && (result.invite.manualInviteLinkAllowed || import.meta.env.DEV || !result.invite.emailSent)) {
        navigator.clipboard.writeText(result.invite.inviteLink).catch(() => {});
      }
      toast({
        title: "School created",
        description: result.invite
          ? result.invite.emailSent
            ? "The first School Admin invitation has been sent."
            : "Invitation email was not sent; the setup link was copied for manual sharing."
          : "School created in pending setup. Send the first admin invite when ready.",
      });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/owner/schools/${selectedSchool?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setEditOpen(false);
      toast({ title: "School updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const inviteAdminMutation = useMutation({
    mutationFn: ({ schoolId, adminName, adminEmail }: { schoolId: string; adminName: string; adminEmail: string }) =>
      apiRequest("POST", `/api/owner/schools/${schoolId}/invite-admin`, { adminName, adminEmail }),
    onSuccess: async (response) => {
      const payload = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      setInviteSummary({
        schoolName: payload.school?.name || "School",
        inviteLink: payload.inviteLink,
        emailSent: payload.emailSent,
        manualInviteLinkAllowed: payload.manualInviteLinkAllowed,
      });
      toast({
        title: "Invite sent",
        description: payload.emailSent
          ? "First School Admin invite was sent."
          : "Email is not configured; copy and share the secure invite link.",
      });
    },
    onError: (err: any) => toast({ title: "Invite failed", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({
      name: "",
      code: "",
      status: "pending_setup",
      firstAdminName: "",
      firstAdminEmail: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      notes: "",
    });
  }

  function badgeClass(status: string) {
    if (status === "active") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "pending_setup") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "suspended") return "bg-red-100 text-red-700 border-red-200";
    if (status === "archived") return "bg-slate-100 text-slate-600 border-slate-200";
    if (status === "pending_deletion") return "bg-orange-100 text-orange-700 border-orange-200";
    if (status === "deleted") return "bg-gray-100 text-gray-500 border-gray-300 line-through";
    return "";
  }

  function setupBadge(status: string) {
    if (status === "complete" || status === "active" || status === "operational_setup_complete") {
      return { label: "Complete", cls: badgeClass("active") };
    }
    if (status === "operational_setup_in_progress" || status === "admin_accepted") {
      return { label: "Setup in progress", cls: badgeClass("pending_setup") };
    }
    if (status === "pending_admin_acceptance") {
      return { label: "Pending admin acceptance", cls: badgeClass("pending_setup") };
    }
    if (status === "pending_admin_invite" || status === "school_created") {
      return { label: "Pending admin invite", cls: badgeClass("pending_setup") };
    }
    return { label: status || "Unknown", cls: badgeClass("pending_setup") };
  }

  function inviteStatusLabel(status: string | null | undefined) {
    if (!status || status === "not_invited") return "Not invited";
    if (status === "pending") return "Invite pending";
    if (status === "accepted") return "Accepted";
    if (status === "expired") return "Expired";
    if (status === "revoked") return "Revoked";
    return status;
  }

  const filtered = schools.filter((school: any) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      school.name?.toLowerCase().includes(q) ||
      school.code?.toLowerCase().includes(q) ||
      school.contactEmail?.toLowerCase().includes(q)
    );
    // When a specific statusFilter is applied via the query, all returned schools already match
    // But for "all" we still get non-deleted, so client filter is a safety net
    return matchesSearch;
  });

  // ─── DANGER ZONE HELPERS ─────────────────────────────────────────
  const DANGER_CONFIG: Record<string, { title: string; description: string; confirmWord: string | ((s: any) => string); variant: "destructive" | "default"; buttonLabel: string }> = {
    suspend: {
      title: "Suspend School",
      description: "Suspending will immediately block all school users (admins, teachers, parents, students) from accessing their dashboards. The school data will be preserved. Only you (platform owner) can restore access.",
      confirmWord: "SUSPEND",
      variant: "destructive",
      buttonLabel: "Suspend School",
    },
    archive: {
      title: "Archive School",
      description: "Archiving will remove this school from the active client list and block all school users. No new orders, invites, or distributions will be allowed. Historical records are preserved. You can restore the school later if needed.",
      confirmWord: "ARCHIVE",
      variant: "destructive",
      buttonLabel: "Archive School",
    },
    restore: {
      title: "Restore School",
      description: "Restoring will set the school status back to Active and re-enable normal access for all school users.",
      confirmWord: "RESTORE",
      variant: "default",
      buttonLabel: "Restore School",
    },
    request_deletion: {
      title: "Mark for Pending Deletion",
      description: "This marks the school for permanent deletion. No records will be removed yet, but the school will be flagged for final review before permanent deletion.",
      confirmWord: (s: any) => `DELETE ${s?.code || ""}`,
      variant: "destructive",
      buttonLabel: "Mark Pending Deletion",
    },
    delete: {
      title: "Permanently Delete School",
      description: "This will permanently soft-delete this school. The school and all its data will be hidden from normal views. This action cannot be easily undone. If there are active orders or pending payment references, deletion will be blocked.",
      confirmWord: (s: any) => `DELETE ${s?.code || ""}`,
      variant: "destructive",
      buttonLabel: "Permanently Delete",
    },
  };

  function getExpectedConfirm() {
    if (!dangerAction || !dangerSchool) return "";
    const cfg = DANGER_CONFIG[dangerAction];
    return typeof cfg.confirmWord === "function" ? cfg.confirmWord(dangerSchool) : cfg.confirmWord;
  }

  async function executeDangerAction() {
    if (!dangerAction || !dangerSchool) return;
    setDangerLoading(true);
    try {
      const id = dangerSchool.id;
      let endpoint = "";
      let method = "POST";
      switch (dangerAction) {
        case "suspend": endpoint = `/api/owner/schools/${id}/suspend`; break;
        case "archive": endpoint = `/api/owner/schools/${id}/archive`; break;
        case "restore": endpoint = `/api/owner/schools/${id}/restore`; break;
        case "request_deletion": endpoint = `/api/owner/schools/${id}/request-deletion`; break;
        case "delete": endpoint = `/api/owner/schools/${id}`; method = "DELETE"; break;
      }
      await apiRequest(method as any, endpoint, { reason: dangerReason, confirmText: dangerConfirmText });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/dashboard"] });
      toast({ title: DANGER_CONFIG[dangerAction].title, description: `${dangerSchool.name} — action completed successfully.` });
      setDangerAction(null);
      setDangerSchool(null);
      setDangerReason("");
      setDangerConfirmText("");
    } catch (err: any) {
      let msg = err.message || "Action failed";
      let blockers: string[] | undefined;
      // apiRequest throws Error("status: jsonBody") — try to parse the body portion
      const colonIdx = msg.indexOf(": ");
      if (colonIdx > 0) {
        try {
          const parsed = JSON.parse(msg.slice(colonIdx + 2));
          msg = parsed.message || msg;
          blockers = parsed.blockers;
        } catch {}
      }
      toast({
        title: "Action blocked",
        description: blockers ? `${msg}\n${blockers.join("\n")}` : msg,
        variant: "destructive",
      });
    } finally {
      setDangerLoading(false);
    }
  }

  function openDanger(action: "suspend" | "archive" | "restore" | "request_deletion" | "delete", school: any) {
    setDangerAction(action);
    setDangerSchool(school);
    setDangerReason("");
    setDangerConfirmText("");
  }

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage school tenants, lifecycle status, and contact details.</p>
        </div>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add School
        </Button>
      </div>

      {inviteSummary && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>First School Admin invite prepared for {inviteSummary.schoolName}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {inviteSummary.emailSent
                ? "The invite email was sent successfully."
                : "The invite email was not sent, so the secure setup link is ready for manual delivery."}
            </p>
            {(inviteSummary.manualInviteLinkAllowed || import.meta.env.DEV || !inviteSummary.emailSent) && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(inviteSummary.inviteLink).then(() => {
                    toast({ title: "Invite link copied" });
                  }).catch(() => {
                    toast({ title: "Copy failed", description: inviteSummary.inviteLink, variant: "destructive" });
                  });
                }}>Copy setup link</Button>
                <Button variant="ghost" size="sm" onClick={() => setInviteSummary(null)}>Dismiss</Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search schools..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active</SelectItem>
            <SelectItem value="pending_setup">Pending setup</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="pending_deletion">Pending Deletion</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Setup</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((school: any) => {
              const st = school.status || "unknown";
              const totalUsers = (school.counts?.admins ?? 0) + (school.counts?.teachers ?? 0) + (school.counts?.parents ?? 0) + (school.counts?.students ?? 0);
              return (
                <TableRow key={school.id} className={st === "deleted" ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{school.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={badgeClass(st)}>{st}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={setupBadge(school.setupStatus).cls}>
                      {setupBadge(school.setupStatus).label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{school.contactEmail || "—"}</TableCell>
                  <TableCell className="text-xs">{totalUsers}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => navigateTo(`/admin/school-details?schoolId=${encodeURIComponent(school.id)}`)}>
                        View
                      </Button>
                      {st !== "deleted" && (
                        <>
                          <Button variant="default" size="sm" disabled={inviteAdminMutation.isPending}
                            onClick={() => {
                              const adminName = school.firstAdminName || window.prompt("First School Admin full name:") || "";
                              const adminEmail = school.firstAdminEmail || window.prompt("First School Admin email:") || "";
                              if (!adminName || !adminEmail) return;
                              inviteAdminMutation.mutate({ schoolId: school.id, adminName, adminEmail });
                            }}>
                            {school.firstAdminInviteStatus === "pending" ? "Resend" : "Invite Admin"}
                          </Button>
                          {st === "active" && (
                            <Button variant="outline" size="sm" disabled={isEnteringSupport}
                              onClick={() => handleEnterSupport(school.id)}>
                              {isEnteringSupport ? "..." : "Support"}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedSchool(school);
                            setForm({
                              name: school.name || "", code: school.code || "", status: school.status || "pending_setup",
                              firstAdminName: "", firstAdminEmail: "",
                              contactEmail: school.contactEmail || "", contactPhone: school.contactPhone || "",
                              address: school.address || "", notes: school.notes || "",
                            });
                            setEditOpen(true);
                          }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {/* Danger zone quick-access */}
                      {st === "active" && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50"
                          onClick={() => openDanger("suspend", school)}>
                          <ShieldOff className="w-4 h-4" />
                        </Button>
                      )}
                      {st === "suspended" && (
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50"
                          onClick={() => openDanger("restore", school)}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      {(st === "active" || st === "suspended") && (
                        <Button variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-50"
                          onClick={() => openDanger("archive", school)}>
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                      {st === "archived" && (
                        <>
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50"
                            onClick={() => openDanger("restore", school)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                            title="Mark for deletion"
                            onClick={() => openDanger("request_deletion", school)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {st === "pending_deletion" && (
                        <>
                          <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50"
                            onClick={() => openDanger("restore", school)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                            title="Permanently delete"
                            onClick={() => openDanger("delete", school)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{search ? "No matching schools" : "No schools found"}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ─── ADD SCHOOL DIALOG ──────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add School</DialogTitle>
            <DialogDescription>Create a new tenant, then invite the first School Admin to continue setup.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2"><Label>School Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>School Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. HILLTOP-PRIMARY" /></div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Status will be created as Pending Setup by default.</div>
            <div className="grid gap-2">
              <Label>First School Admin Name (optional)</Label>
              <Input value={form.firstAdminName} onChange={(e) => setForm({ ...form, firstAdminName: e.target.value })} placeholder="Full name of the first School Admin" />
            </div>
            <div className="grid gap-2">
              <Label>First School Admin Email (optional)</Label>
              <Input type="email" value={form.firstAdminEmail} onChange={(e) => setForm({ ...form, firstAdminEmail: e.target.value })} placeholder="admin@school.edu" />
            </div>
            <div className="grid gap-2"><Label>Contact Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({
              school: {
                name: form.name,
                code: form.code,
                contactEmail: form.contactEmail || null,
                contactPhone: form.contactPhone || null,
                address: form.address || null,
                notes: form.notes || null,
              },
              firstAdminName: form.firstAdminName,
              firstAdminEmail: form.firstAdminEmail,
            })} disabled={createMutation.isPending || !form.name || !form.code}>
              {createMutation.isPending ? "Creating..." : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT SCHOOL DIALOG ─────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>Update school identity and contact details. Use the Danger Zone actions in the table to change lifecycle status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2"><Label>School Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>School Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Current status: <Badge variant="outline" className={badgeClass(form.status)}>{form.status}</Badge>
              <span className="ml-2 text-xs">Use table actions to change lifecycle status.</span>
            </div>
            <div className="grid gap-2"><Label>Contact Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => updateMutation.mutate({
                name: form.name, code: form.code,
                contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null,
                address: form.address || null, notes: form.notes || null,
              })}
              disabled={updateMutation.isPending || !form.name || !form.code}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DANGER ZONE CONFIRMATION DIALOG ────────────────────────── */}
      <AlertDialog open={!!dangerAction} onOpenChange={(open) => { if (!open) { setDangerAction(null); setDangerSchool(null); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {dangerAction && DANGER_CONFIG[dangerAction]?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {dangerAction && DANGER_CONFIG[dangerAction]?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dangerSchool && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">School:</span> <span className="font-medium">{dangerSchool.name}</span></div>
                <div><span className="text-muted-foreground">Code:</span> <span className="font-mono">{dangerSchool.code}</span></div>
                <div><span className="text-muted-foreground">Current Status:</span> <Badge variant="outline" className={badgeClass(dangerSchool.status)}>{dangerSchool.status}</Badge></div>
              </div>

              <div className="grid gap-2">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Provide a reason for this action..."
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label>Type <span className="font-mono font-bold text-destructive">{getExpectedConfirm()}</span> to confirm</Label>
                <Input
                  placeholder={getExpectedConfirm()}
                  value={dangerConfirmText}
                  onChange={(e) => setDangerConfirmText(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={dangerLoading}>Cancel</AlertDialogCancel>
            <Button
              variant={dangerAction ? DANGER_CONFIG[dangerAction]?.variant : "destructive"}
              disabled={dangerLoading || !dangerReason.trim() || dangerConfirmText !== getExpectedConfirm()}
              onClick={executeDangerAction}
            >
              {dangerLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {dangerLoading ? "Processing..." : dangerAction && DANGER_CONFIG[dangerAction]?.buttonLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


// ─── USER DETAIL PANEL ─────────────────────────────────────────

export { OwnerDashboardSection, OwnerPendingSetupsSection, OwnerAdminInvitesSection, OwnerEmailStatusSection, OwnerActivitySection, OwnerSettingsSection, OwnerSchoolDetailsSection, SchoolsSection };
