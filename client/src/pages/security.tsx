import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck, ShieldAlert, ArrowLeft, Loader2, Copy, Check, Download, KeyRound, AlertTriangle, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

function EmailPreferences() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/notifications/preferences"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const mutation = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => (await apiRequest("PATCH", "/api/notifications/preferences", patch)).json(),
    onSuccess: (d) => { queryClient.setQueryData(["/api/notifications/preferences"], d); toast({ title: "Preferences saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const rows = [
    { key: "dailyDigest", label: "Daily summary", desc: "A daily digest of orders, payments and stock (staff)." },
    { key: "lowStockAlerts", label: "Low-stock alerts", desc: "Include low-stock items in your daily summary (staff)." },
    { key: "paymentReminders", label: "Payment reminders", desc: "Reminders about unpaid orders (parents)." },
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-1"><Mail className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Email preferences</h2></div>
      <p className="text-sm text-muted-foreground mb-4">Choose which scheduled emails Scholar Shelf sends you.</p>
      {isLoading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const on = data?.[r.key] !== false;
            return (
              <div key={r.key} className="flex items-center justify-between py-3">
                <div className="pr-4">
                  <div className="text-sm font-medium text-foreground">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
                <button
                  type="button" role="switch" aria-checked={on} disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ [r.key]: !on })}
                  className={cn("relative h-6 w-11 rounded-full transition-colors shrink-0", on ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyAll = () => { navigator.clipboard.writeText(codes.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => {
    const blob = new Blob([`ScholarShelf recovery codes\nKeep these somewhere safe. Each code works once.\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "scholarshelf-recovery-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Save these recovery codes now. Each one works once and this is the only time they're shown.
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-3 font-mono text-sm">
        {codes.map((c) => <div key={c} className="text-center py-1 text-foreground">{c}</div>)}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={copyAll}>{copied ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2" />}Copy</Button>
        <Button variant="outline" className="flex-1" onClick={download}><Download className="w-4 h-4 mr-2" />Download</Button>
        {onDone && <Button className="flex-1" onClick={onDone}>Done</Button>}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: status, isLoading } = useQuery<any>({
    queryKey: ["/api/auth/mfa/status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [setupData, setSetupData] = useState<any>(null);   // { secret, otpauthUrl }
  const [enrollToken, setEnrollToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);

  const setupMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/mfa/setup", {})).json(),
    onSuccess: (d) => { setSetupData(d); setEnrollToken(""); },
    onError: (e: any) => toast({ title: "Could not start setup", description: e.message, variant: "destructive" }),
  });

  const enableMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/mfa/enable", { token: enrollToken.trim() })).json(),
    onSuccess: (d) => {
      setSetupData(null); setEnrollToken("");
      setNewRecoveryCodes(d.recoveryCodes || []);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      toast({ title: "Two-factor authentication enabled" });
    },
    onError: (e: any) => toast({ title: "Verification failed", description: e.message, variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/mfa/disable", { password })).json(),
    onSuccess: () => {
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      toast({ title: "Two-factor authentication disabled" });
    },
    onError: (e: any) => toast({ title: "Could not disable", description: e.message, variant: "destructive" }),
  });

  const regenMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/mfa/recovery-codes", { password })).json(),
    onSuccess: (d) => {
      setPassword("");
      setNewRecoveryCodes(d.recoveryCodes || []);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/mfa/status"] });
      toast({ title: "Recovery codes regenerated" });
    },
    onError: (e: any) => toast({ title: "Could not regenerate", description: e.message, variant: "destructive" }),
  });

  const copySecret = () => { if (setupData?.secret) { navigator.clipboard.writeText(setupData.secret); setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); } };

  const enabled = !!status?.enabled;

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-[560px] mx-auto space-y-5">
        <button onClick={() => setLocation(user ? "/" : "/login")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Security</h1>
          <p className="text-muted-foreground mt-1">Protect your account with two-factor authentication.</p>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : newRecoveryCodes ? (
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Your recovery codes</h2></div>
            <RecoveryCodes codes={newRecoveryCodes} onDone={() => setNewRecoveryCodes(null)} />
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${enabled ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Authenticator app (TOTP)</h2>
                  <p className="text-sm text-muted-foreground">{enabled ? "Two-factor authentication is on." : "Add a second step at sign-in using an authenticator app."}</p>
                </div>
              </div>
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            {/* ── Enabled: manage ── */}
            {enabled ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Enrolled</div><div className="text-foreground">{status?.enrolledAt ? formatDate(status.enrolledAt) : "—"}</div></div>
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground">Recovery codes left</div><div className="text-foreground">{status?.recoveryCodesRemaining ?? 0}</div></div>
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-sm font-medium">Confirm your password to manage 2FA</Label>
                  <Input type="password" placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => regenMutation.mutate()} disabled={!password || regenMutation.isPending}>
                      {regenMutation.isPending ? "Working…" : "Regenerate recovery codes"}
                    </Button>
                    <Button variant="destructive" onClick={() => disableMutation.mutate()} disabled={!password || disableMutation.isPending}>
                      {disableMutation.isPending ? "Working…" : "Disable 2FA"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : setupData ? (
              /* ── Enrolment in progress ── */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">1. Scan this QR code with Google Authenticator, Authy, 1Password, or a similar app.</p>
                <div className="flex justify-center">
                  <div className="rounded-xl border border-border bg-white p-4">
                    <QRCodeSVG value={setupData.otpauthUrl} size={176} />
                  </div>
                </div>
                <div className="text-center">
                  <button className="text-xs text-primary hover:underline" onClick={() => setShowSecret((v) => !v)}>{showSecret ? "Hide" : "Can't scan? Enter the key manually"}</button>
                  {showSecret && (
                    <div className="mt-2 flex items-center gap-2 justify-center">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{setupData.secret}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copySecret}>{copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}</Button>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-4 space-y-2">
                  <Label htmlFor="enroll-token" className="text-sm font-medium">2. Enter the 6-digit code to confirm</Label>
                  <Input id="enroll-token" inputMode="numeric" placeholder="123456" value={enrollToken}
                    onChange={(e) => setEnrollToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-lg font-mono tracking-[0.4em]" />
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1" onClick={() => enableMutation.mutate()} disabled={enrollToken.length !== 6 || enableMutation.isPending}>
                      {enableMutation.isPending ? "Verifying…" : "Verify & enable"}
                    </Button>
                    <Button variant="outline" onClick={() => { setSetupData(null); setEnrollToken(""); }}>Cancel</Button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Disabled: start ── */
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                {setupMutation.isPending ? "Starting…" : "Enable two-factor authentication"}
              </Button>
            )}
          </section>
        )}

        <EmailPreferences />
      </div>
    </div>
  );
}
