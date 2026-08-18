import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { applyBrandingToDocument } from "@/lib/branding";
import { getRoleRoute } from "@/lib/role-routes";
import { PublicFooter } from "@/components/public-footer";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  // MFA challenge state
  const [mfaStage, setMfaStage] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const { login, isAuthenticated, user, isLoggingIn, loginError, verifyMfa, isVerifyingMfa, verifyMfaError } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation(getRoleRoute(user.role));
    }
  }, [isAuthenticated, user, setLocation]);

  useEffect(() => {
    const code = schoolCode.trim();
    let cancelled = false;

    if (!code || code.length < 3) {
      setBranding(null);
      applyBrandingToDocument(null);
      return;
    }

    async function loadBranding() {
      try {
        const res = await fetch(`/api/public/schools/${encodeURIComponent(code)}/branding`);
        if (!res.ok) {
          if (!cancelled) { setBranding(null); applyBrandingToDocument(null); }
          return;
        }
        const data = await res.json();
        if (!cancelled) { setBranding(data); applyBrandingToDocument(data); }
      } catch {
        if (!cancelled) { setBranding(null); applyBrandingToDocument(null); }
      }
    }

    loadBranding();
    return () => { cancelled = true; };
  }, [schoolCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await login({ username, password, schoolCode: schoolCode.trim() || undefined });
      window.__schoolBlockedMessage = undefined;
      if (result?.mfaRequired) { setMfaStage(true); setMfaCode(""); setRecoveryCode(""); setUseRecovery(false); return; }
      setLocation(getRoleRoute(result.role));
    } catch {}
  }

  async function loginWithDemo(demoUsername: string, demoPassword: string, demoSchoolCode?: string) {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setSchoolCode(demoSchoolCode || "");
    try {
      const result = await login({ username: demoUsername, password: demoPassword, schoolCode: demoSchoolCode });
      window.__schoolBlockedMessage = undefined;
      if (result?.mfaRequired) { setMfaStage(true); return; }
      setLocation(getRoleRoute(result.role));
    } catch {}
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = useRecovery ? { recoveryCode: recoveryCode.trim() } : { token: mfaCode.trim() };
      const result = await verifyMfa(payload);
      setLocation(getRoleRoute(result.role));
    } catch {}
  }

  const mfaErrorMessage = verifyMfaError
    ? verifyMfaError.message.includes("429")
      ? "Too many attempts. Please sign in again."
      : "Invalid code. Please try again."
    : null;

  const errorMessage = loginError
    ? loginError.message.includes("401")
      ? loginError.message.toLowerCase().includes("school code")
        ? "Invalid school code for this account."
        : "Incorrect username or password."
      : loginError.message.includes("429")
        ? "Too many attempts. Please wait a moment."
        : "Sign in failed. Please try again."
    : null;

  if (mfaStage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[360px]">
          <div className="flex items-center gap-3 mb-7">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">Two-factor authentication</h2>
              <p className="text-xs text-muted-foreground">{useRecovery ? "Enter a recovery code" : "Enter the 6-digit code from your authenticator app"}</p>
            </div>
          </div>

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            {!useRecovery ? (
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code" className="text-sm font-medium">Authentication code</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  className="h-11 bg-card text-center text-lg font-mono tracking-[0.4em]"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="mfa-recovery" className="text-sm font-medium">Recovery code</Label>
                <Input
                  id="mfa-recovery"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  required
                  autoFocus
                  className="h-11 bg-card font-mono"
                />
              </div>
            )}

            {mfaErrorMessage && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/15 px-3 py-2.5 rounded-md" role="alert">
                {mfaErrorMessage}
              </p>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={isVerifyingMfa}>
              {isVerifyingMfa ? "Verifying…" : "Verify"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              onClick={() => { setMfaStage(false); setMfaCode(""); setRecoveryCode(""); }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
            <button
              type="button"
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              onClick={() => { setUseRecovery(!useRecovery); setMfaCode(""); setRecoveryCode(""); }}
            >
              {useRecovery ? "Use authenticator app" : "Use a recovery code"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-sidebar text-sidebar-foreground p-10 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 -left-16 h-72 w-72 rounded-full bg-sidebar-primary opacity-10 blur-3xl" />
          <div className="absolute bottom-24 -right-10 h-56 w-56 rounded-full bg-sidebar-primary opacity-8 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-sidebar-primary" />
            </div>
          )}
          <span className="font-semibold text-sm text-sidebar-accent-foreground">
            {branding?.schoolName || "ScholarShelf"}
          </span>
        </div>

        <div className="relative z-10 mt-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sidebar-primary/15 border border-sidebar-primary/25 mb-5">
              <div className="h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse" />
              <span className="text-xs font-medium text-sidebar-primary">School Book Management</span>
            </div>
            <h1 className="text-2xl font-bold text-sidebar-accent-foreground leading-snug">
              Manage books across your entire school
            </h1>
            <p className="mt-3 text-sm text-sidebar-foreground/70 leading-relaxed">
              Distribute, track, and manage books across classes, students, and parents — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Books tracked", value: "100%" },
              { label: "Roles", value: "5+" },
              { label: "Real-time", value: "Live" },
            ].map((stat) => (
              <div key={stat.label} className="bg-sidebar-accent/80 border border-sidebar-border rounded-lg p-3">
                <div className="text-base font-bold text-sidebar-primary">{stat.value}</div>
                <div className="text-[10px] text-sidebar-foreground/50 mt-0.5 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[340px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="font-semibold text-sm text-foreground">{branding?.schoolName || "ScholarShelf"}</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
          </div>

          {window.__schoolBlockedMessage && (
            <div className="mb-4 p-3 rounded-md bg-destructive/8 border border-destructive/20 text-sm">
              <p className="font-medium text-destructive">School Access Blocked</p>
              <p className="mt-0.5 text-destructive/80 text-xs">{window.__schoolBlockedMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="your.username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="h-10 bg-card"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 bg-card pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="school-code" className="text-sm font-medium">
                School Code
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">optional for platform admin</span>
              </Label>
              <Input
                id="school-code"
                data-testid="input-school-code"
                type="text"
                placeholder="DEMO-001"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                className="h-10 bg-card font-mono tracking-wider"
              />
            </div>

            {errorMessage && (
              <p
                className="text-sm text-destructive bg-destructive/8 border border-destructive/15 px-3 py-2.5 rounded-md"
                data-testid="text-login-error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-10 font-medium mt-2"
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              {isLoggingIn ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setLocation("/forgot-password")}
            >
              Forgot password?
            </button>
            <button
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              onClick={() => setLocation("/register")}
            >
              Parent sign up →
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2.5">Demo accounts</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "BytHub", username: "bythub", password: "bythub123" },
                { label: "Admin", username: "admin", password: "admin123", schoolCode: "DEMO-001" },
                { label: "Teacher", username: "teacher", password: "teacher123", schoolCode: "DEMO-001" },
                { label: "Parent", username: "parent", password: "parent123", schoolCode: "DEMO-001" },
                { label: "Finance", username: "finance", password: "finance123", schoolCode: "DEMO-001" },
              ].map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  data-testid={`button-demo-${demo.username}`}
                  onClick={() => void loginWithDemo(demo.username, demo.password, demo.schoolCode)}
                  className="text-xs px-2 py-2 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legal / contact links — reachable from the first screen */}
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
