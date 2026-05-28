import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, LogIn, UserPlus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { applyBrandingToDocument } from "@/lib/branding";

function getRoleRoute(role: string): string {
  if (role === "owner" || role === "platform_admin") return "/admin/owner";
  if (role === "school_admin") return "/admin";
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "parent") return "/parent";
  return "/login";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  const { login, isAuthenticated, user, isLoggingIn, loginError } = useAuth();
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
          if (!cancelled) {
            setBranding(null);
            applyBrandingToDocument(null);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setBranding(data);
          applyBrandingToDocument(data);
        }
      } catch {
        if (!cancelled) {
          setBranding(null);
          applyBrandingToDocument(null);
        }
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, [schoolCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const loggedInUser = await login({ username, password, schoolCode: schoolCode.trim() || undefined });
      setLocation(getRoleRoute(loggedInUser.role));
    } catch {}
  }

  async function loginWithDemo(demoUsername: string, demoPassword: string, demoSchoolCode?: string) {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setSchoolCode(demoSchoolCode || "");
    try {
      const loggedInUser = await login({ username: demoUsername, password: demoPassword, schoolCode: demoSchoolCode });
      setLocation(getRoleRoute(loggedInUser.role));
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding?.schoolName || "School"} logo`} className="h-10 w-10 object-contain" />
            ) : (
              <BookOpen className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{branding?.schoolName || "EduBook"}</h1>
          <p className="text-muted-foreground mt-1">School Book Management System</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-code">School Code</Label>
                <Input
                  id="school-code"
                  data-testid="input-school-code"
                  type="text"
                  placeholder="Enter your school code"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-muted-foreground">
                  Required for school-linked accounts (School Admin, Teacher, Parent, Student).
                </p>
              </div>

              {loginError && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" data-testid="text-login-error">
                  {loginError.message.includes("401")
                    ? loginError.message.toLowerCase().includes("school code")
                      ? "Invalid school code for this account"
                      : "Invalid username or password"
                    : loginError.message.includes("429")
                    ? "Too many login attempts. Please try again later."
                    : "Login failed. Please try again."}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-login">
                <LogIn className="mr-2 h-4 w-4" />
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <a
                href="/forgot-password"
                className="text-primary hover:underline cursor-pointer"
                onClick={(e) => { e.preventDefault(); setLocation("/forgot-password"); }}
              >
                <KeyRound className="inline h-3 w-3 mr-1" />
                Forgot password?
              </a>
              <a
                href="/register"
                className="text-primary hover:underline cursor-pointer"
                onClick={(e) => { e.preventDefault(); setLocation("/register"); }}
              >
                <UserPlus className="inline h-3 w-3 mr-1" />
                Parent sign up
              </a>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-3">Demo Accounts</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "BytHub", username: "bythub", password: "bythub123" },
                  { label: "Admin", username: "admin", password: "admin123", schoolCode: "DEMO-001" },
                  { label: "Teacher", username: "teacher", password: "teacher123", schoolCode: "DEMO-001" },
                  { label: "Parent", username: "parent", password: "parent123", schoolCode: "DEMO-001" },
                ].map((demo) => (
                  <Button
                    key={demo.username}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid={`button-demo-${demo.username}`}
                    onClick={() => void loginWithDemo(demo.username, demo.password, demo.schoolCode)}
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
