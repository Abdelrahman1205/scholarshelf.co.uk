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

// ─── BRANDING ─────────────────────────────────────────────────────────────────
function BrandingSection() {
  const { toast } = useToast();
  const { data: branding, isLoading } = useQuery<any>({
    queryKey: ["/api/school/branding"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [primaryColour, setPrimaryColour] = useState("#2563EB");
  const [secondaryColour, setSecondaryColour] = useState("#1E3A8A");
  const [accentColour, setAccentColour] = useState("#0EA5E9");
  const [themeName, setThemeName] = useState("");
  const [fontPreference, setFontPreference] = useState("system");

  useEffect(() => {
    if (!branding) return;
    setPrimaryColour(branding.primaryColour || "#2563EB");
    setSecondaryColour(branding.secondaryColour || "#1E3A8A");
    setAccentColour(branding.accentColour || "#0EA5E9");
    setThemeName(branding.themeName || "");
    setFontPreference(branding.fontPreference || "system");
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/school/branding", {
        primaryColour,
        secondaryColour,
        accentColour,
        themeName,
        fontPreference,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding updated", description: "Theme colours and settings were saved." });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/school/branding/reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding reset", description: "Defaults restored for this school." });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/setup/branding-skip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Branding skipped", description: "Setup checklist updated for branding." });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ endpoint, file }: { endpoint: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/branding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/setup-status"] });
      toast({ title: "Asset uploaded", description: "Branding asset saved." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error?.message || "Unable to upload file", variant: "destructive" });
    },
  });

  const onUpload = (endpoint: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ endpoint, file });
    event.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Branding & Design Identity</h2>
        <p className="text-sm text-muted-foreground">Configure tenant-specific colours, theme metadata, and visual assets.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theme Settings</CardTitle>
            <CardDescription>These values are used across login, dashboard, and invite flows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branding-primary">Primary</Label>
                <Input id="branding-primary" type="color" value={primaryColour} onChange={(e) => setPrimaryColour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding-secondary">Secondary</Label>
                <Input id="branding-secondary" type="color" value={secondaryColour} onChange={(e) => setSecondaryColour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding-accent">Accent</Label>
                <Input id="branding-accent" type="color" value={accentColour} onChange={(e) => setAccentColour(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-theme-name">Theme Name</Label>
              <Input id="branding-theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Default" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-font">Font Preference</Label>
              <Input id="branding-font" value={fontPreference} onChange={(e) => setFontPreference(e.target.value)} placeholder="system" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Theme"}
              </Button>
              <Button variant="outline" onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}>
                {skipMutation.isPending ? "Skipping..." : "Skip In Setup"}
              </Button>
              <Button variant="destructive" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "Resetting..." : "Reset To Default"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>Supported formats: PNG, JPG, JPEG, WEBP. Max size 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "branding-logo", label: "Logo", endpoint: "/api/school/branding/logo", currentUrl: branding?.logoUrl },
              { id: "branding-banner", label: "Banner", endpoint: "/api/school/branding/banner", currentUrl: branding?.bannerImageUrl },
              { id: "branding-favicon", label: "Favicon", endpoint: "/api/school/branding/favicon", currentUrl: branding?.faviconUrl },
              { id: "branding-email-logo", label: "Email Logo", endpoint: "/api/school/branding/email-logo", currentUrl: branding?.emailHeaderLogoUrl },
              { id: "branding-pdf-logo", label: "PDF Logo", endpoint: "/api/school/branding/pdf-logo", currentUrl: branding?.pdfLogoUrl },
            ].map((asset) => (
              <div key={asset.id} className="space-y-2">
                <Label htmlFor={asset.id}>{asset.label}</Label>
                <div className="flex items-center gap-3">
                  {asset.currentUrl && (
                    <img src={asset.currentUrl} alt={asset.label} className="h-10 w-10 rounded border object-contain bg-muted flex-shrink-0" />
                  )}
                  <Input id={asset.id} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={onUpload(asset.endpoint)} className="flex-1" />
                </div>
              </div>
            ))}
            {uploadMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>Preview of current logo and colour palette.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <div className="h-14 px-4 flex items-center justify-between" style={{ backgroundColor: primaryColour }}>
              <div className="text-white font-semibold">{branding?.schoolName || "Your School"}</div>
              {branding?.logoUrl && <img src={branding.logoUrl} alt="School logo" className="h-8 w-auto object-contain bg-white rounded px-1" />}
            </div>
            <div className="p-4 grid md:grid-cols-3 gap-3 bg-background">
              <div className="h-16 rounded-md" style={{ backgroundColor: primaryColour }} />
              <div className="h-16 rounded-md" style={{ backgroundColor: secondaryColour }} />
              <div className="h-16 rounded-md" style={{ backgroundColor: accentColour }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── REPORTS SECTION ──────────────────────────────────────────

export { BrandingSection };
