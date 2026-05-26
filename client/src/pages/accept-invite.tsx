import { useState, useEffect } from "react";
import { useLocation, useSearch, useRoute } from "wouter";
import { BookOpen, Eye, EyeOff, UserCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

function getRoleRoute(role: string): string {
  if (role === "school_admin") return "/admin/setup";
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "parent") return "/parent";
  return "/login";
}

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
      setLocation(getRoleRoute(user.role));
    }
  }, [token, isAuthenticated, user, setLocation]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">Invalid invite link. No token was provided.</p>
            <a href="/login" className="text-sm text-primary hover:underline cursor-pointer"
              onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
              Go to sign in
            </a>
          </CardContent>
        </Card>
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
      setLocation(getRoleRoute(loggedInUser.role));
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">EduBook</h1>
          <p className="text-muted-foreground mt-1">Accept Your Invitation</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Set Up Your Account</CardTitle>
            <CardDescription>
              {inviteLoading
                ? "Checking your secure invite..."
                : inviteInfo?.schoolName
                  ? `You've been invited to join ${inviteInfo.schoolName}. Complete your profile below.`
                  : "You've been invited to join EduBook. Complete your profile below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {inviteInfo?.email && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Invitation email: <span className="font-medium text-foreground">{inviteInfo.email}</span>
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>

              {errorMessage && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{errorMessage}</div>
              )}

              <Button type="submit" className="w-full" disabled={isAcceptingInvite}>
                <UserCheck className="mr-2 h-4 w-4" />
                {isAcceptingInvite ? "Setting up account..." : "Accept Invite & Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
                <ArrowLeft className="h-3 w-3" /> Already have an account? Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
