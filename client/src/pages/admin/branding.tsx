import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Palette, ImageIcon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── BRANDING (Stitch redesign) ─────────────────────────────────────────────
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
        primaryColour, secondaryColour, accentColour, themeName, fontPreference,
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
      const res = await fetch(endpoint, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
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
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const mono = "text-[10px] font-mono uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Branding &amp; Design Identity</h1>
        <p className="text-muted-foreground mt-1">Configure tenant-specific colours, theme metadata, and visual assets.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Theme settings */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1"><Palette className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Theme Settings</h2></div>
          <p className="text-sm text-muted-foreground mb-4">These values are used across login, dashboard, and invite flows.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label htmlFor="branding-primary" className={mono}>Primary</Label><Input id="branding-primary" type="color" value={primaryColour} onChange={(e) => setPrimaryColour(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="branding-secondary" className={mono}>Secondary</Label><Input id="branding-secondary" type="color" value={secondaryColour} onChange={(e) => setSecondaryColour(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="branding-accent" className={mono}>Accent</Label><Input id="branding-accent" type="color" value={accentColour} onChange={(e) => setAccentColour(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="branding-theme-name" className={mono}>Theme Name</Label><Input id="branding-theme-name" value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Default" /></div>
            <div className="space-y-2"><Label htmlFor="branding-font" className={mono}>Font Preference</Label><Input id="branding-font" value={fontPreference} onChange={(e) => setFontPreference(e.target.value)} placeholder="system" /></div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Theme"}</Button>
              <Button variant="outline" onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}>{skipMutation.isPending ? "Skipping..." : "Skip In Setup"}</Button>
              <Button variant="destructive" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>{resetMutation.isPending ? "Resetting..." : "Reset To Default"}</Button>
            </div>
          </div>
        </section>

        {/* Assets */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1"><ImageIcon className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Assets</h2></div>
          <p className="text-sm text-muted-foreground mb-4">Supported formats: PNG, JPG, JPEG, WEBP. Max size 5MB.</p>
          <div className="space-y-4">
            {[
              { id: "branding-logo", label: "Logo", endpoint: "/api/school/branding/logo", currentUrl: branding?.logoUrl },
              { id: "branding-banner", label: "Banner", endpoint: "/api/school/branding/banner", currentUrl: branding?.bannerImageUrl },
              { id: "branding-favicon", label: "Favicon", endpoint: "/api/school/branding/favicon", currentUrl: branding?.faviconUrl },
              { id: "branding-email-logo", label: "Email Logo", endpoint: "/api/school/branding/email-logo", currentUrl: branding?.emailHeaderLogoUrl },
              { id: "branding-pdf-logo", label: "PDF Logo", endpoint: "/api/school/branding/pdf-logo", currentUrl: branding?.pdfLogoUrl },
            ].map((asset) => (
              <div key={asset.id} className="space-y-2">
                <Label htmlFor={asset.id} className={mono}>{asset.label}</Label>
                <div className="flex items-center gap-3">
                  {asset.currentUrl && <img src={asset.currentUrl} alt={asset.label} className="h-10 w-10 rounded border object-contain bg-muted flex-shrink-0" />}
                  <Input id={asset.id} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={onUpload(asset.endpoint)} className="flex-1" />
                </div>
              </div>
            ))}
            {uploadMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</div>
            )}
          </div>
        </section>
      </div>

      {/* Live preview */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1"><Eye className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Live Preview</h2></div>
        <p className="text-sm text-muted-foreground mb-4">Preview of current logo and colour palette.</p>
        <div className="rounded-xl border border-border overflow-hidden">
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
      </section>
    </div>
  );
}

export { BrandingSection };
