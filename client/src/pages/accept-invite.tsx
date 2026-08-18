import { useState, useEffect } from "react";
import { useLocation, useSearch, useRoute } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialSymbol } from "@/components/ui/material-symbol";
import { useAuth } from "@/hooks/use-auth";
import { applyBrandingToDocument } from "@/lib/branding";
import { getRoleRoute } from "@/lib/role-routes";
import { PublicFooter } from "@/components/public-footer";

// ─── STAFF INVITATION ACCEPTANCE (ScholarShelf design) ───────────────────────
export default function AcceptInvitePage() {
  const search = useSearch();
  const [pathMatch, pathParams] = useRoute<{ token: string }>("/accept-invite/:token");
  const params = new URLSearchParams(search);
  const token = (pathMatch ? pathParams?.token : params.get("token")) || "";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const { acceptInvite, isAcceptingInvite, acceptInviteError, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadInvite() {
      setInviteLoading(true);
      try {
        const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setInviteInfo(data);
        if (data.inviteeName) setName(data.inviteeName);
      } catch {
        // Ignore invite lookup errors here; submission will surface them.
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token) return;
    if (isAuthenticated && user) {
      setLocation(getRoleRoute(user.role, { isNewAccount: true }));
    }
  }, [token, isAuthenticated, user, setLocation]);

  useEffect(() => {
    applyBrandingToDocument(inviteInfo?.schoolBranding || null);
  }, [inviteInfo?.schoolBranding]);

  const schoolName = inviteInfo?.schoolName || "ScholarShelf";

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <MaterialSymbol name="link_off" className="text-4xl text-muted-foreground/40" />
          <p className="text-destructive mt-3 mb-4">Invalid invite link. No token was provided.</p>
          <a href="/login" className="text-sm text-on-secondary-container hover:underline cursor-pointer"
            onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }
    try {
      const loggedInUser = await acceptInvite({ token, name, username, password });
      setLocation(getRoleRoute(loggedInUser.role, { isNewAccount: true }));
    } catch {}
  }

  const errorMessage = validationError || (acceptInviteError
    ? acceptInviteError.message.includes("409")
      ? "Username is already taken"
      : acceptInviteError.message.includes("400")
      ? "Invalid or expired invite link"
      : "Failed to accept invite. Please try again."
    : "");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Brand panel — design: navy split screen */}
      <div className="hidden lg:flex lg:w-[44%] bg-primary text-primary-foreground flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-foreground/10">
            {inviteInfo?.schoolBranding?.logoUrl
              ? <img src={inviteInfo.schoolBranding.logoUrl} alt={`${schoolName} logo`} className="h-6 w-6 object-contain" />
              : <MaterialSymbol name="school" className="text-2xl" />}
          </span>
          <span className="text-lg font-bold tracking-tight">{schoolName}</span>
        </div>
        <div className="space-y-4 max-w-sm">
          <h2 className="text-3xl font-bold leading-tight">Empowering academic logistics.</h2>
          <p className="text-primary-foreground/70 text-sm leading-relaxed">
            The central hub for book distribution, inventory tracking, and administrative excellence.
          </p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full bg-primary-foreground/10">
            <MaterialSymbol name="verified" className="text-sm" /> Staff Portal · Secure
          </span>
        </div>
        <p className="text-primary-foreground/50 text-xs">
          ScholarShelf streamlines learning resource management for your school.
        </p>
      </div>

      {/* Acceptance form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-6">
            <span className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-secondary-container mb-3">
              {inviteInfo?.schoolBranding?.logoUrl
                ? <img src={inviteInfo.schoolBranding.logoUrl} alt={`${schoolName} logo`} className="h-8 w-8 object-contain" />
                : <MaterialSymbol name="school" className="text-3xl text-on-secondary-container" />}
            </span>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{schoolName}</h1>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container">
              <MaterialSymbol name="mail" className="text-sm" /> Invitation Pending
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">Welcome to {schoolName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {inviteLoading
                ? "Checking your secure invite…"
                : "Complete your profile to activate your account."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              {inviteInfo?.email && (
                <div className="rounded-lg border border-border bg-surface-container-low px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <MaterialSymbol name="alternate_email" className="text-base" />
                  <span className="truncate">Invitation for <span className="font-medium text-foreground">{inviteInfo.email}</span></span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" type="text" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Set Your Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>

              {errorMessage && (
                <div className="text-sm text-on-error-container bg-error-container px-3 py-2 rounded-lg">{errorMessage}</div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                By completing registration you confirm you have read our{" "}
                <a href="/privacy" target="_blank" rel="noreferrer"
                   className="underline hover:text-foreground">Privacy Policy</a>.
              </p>

              <Button type="submit" className="w-full" disabled={isAcceptingInvite}>
                <MaterialSymbol name="key" className="text-base mr-2" />
                {isAcceptingInvite ? "Setting up account…" : "Complete Registration"}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <a href="/login" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
                onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
                <MaterialSymbol name="arrow_back" className="text-sm" /> Back to Login
              </a>
            </div>
          </div>
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
