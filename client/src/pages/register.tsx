import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { PublicFooter } from "@/components/public-footer";
import { describeApiError } from "@/lib/errors";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const { signUpParent, isSigningUp, signUpError, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/parent");
    }
  }, [isAuthenticated, user, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      // Checked here so the parent is told before a round trip, in the same
      // words the server would use.
      setValidationError(
        "Username can only contain letters, numbers, dots, hyphens and underscores. "
        + "If you'd like to use your email address, try the part before the @.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    try {
      await signUpParent({ name, email, username, password });
      setLocation("/parent");
    } catch {}
  }

  // C1: this used to test signUpError.message.includes("409"), which stopped
  // being true when the error contract changed — so every failure, including a
  // rejected username, showed "Registration failed. Please try again." with no
  // way to discover the rule. describeApiError surfaces the server's per-field
  // explanation, which is the only thing that lets the parent fix it.
  const errorMessage = validationError || (signUpError
    ? describeApiError(signUpError, {
        statusMessages: { 409: "Username or email is already taken" },
        fallback: "Registration failed. Please try again.",
      })
    : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Scholar Shelf</h1>
          <p className="text-muted-foreground mt-1">Parent Registration</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Create Parent Account</CardTitle>
            <CardDescription>Register to manage your child's book assignments and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" type="text" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                {/* The server enforces /^[a-zA-Z0-9_.-]+$/ (shared/schema.ts).
                    The form only enforced a minimum length, so an apostrophe, a
                    space, or an email address was accepted here and rejected
                    there — and the explanation was discarded. Say the rule
                    before they type, and repeat the server's wording if it
                    still fails. */}
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g. sarah.obrien"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_.\-]+"
                  aria-describedby="username-hint"
                />
                <p id="username-hint" className="text-xs text-muted-foreground">
                  Letters, numbers, dots, hyphens and underscores only — no spaces or apostrophes.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{errorMessage}</div>
              )}

              {/* Notice shown at the point of account creation — evidence that the
                  privacy information was presented before any data was submitted. */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                By creating an account you confirm you have read our{" "}
                <a href="/privacy" target="_blank" rel="noreferrer"
                   className="underline hover:text-foreground">Privacy Policy</a>, which explains how
                your information and your child's information are used.
              </p>

              <Button type="submit" className="w-full" disabled={isSigningUp}>
                <UserPlus className="mr-2 h-4 w-4" />
                {isSigningUp ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <a href="/login" className="text-sm text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </a>
            </div>
          </CardContent>
        </Card>
        <PublicFooter />
      </div>
    </div>
  );
}
