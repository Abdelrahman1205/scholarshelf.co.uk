import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { BookOpen, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function ResetPasswordPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [success, setSuccess] = useState(false);
  const { resetPassword, isResettingPassword, resetPasswordError } = useAuth();
  const [, setLocation] = useLocation();

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">Invalid reset link. No token was provided.</p>
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
      await resetPassword({ token, password });
      setSuccess(true);
    } catch {}
  }

  const errorMessage = validationError || (resetPasswordError
    ? resetPasswordError.message.includes("400")
      ? "Invalid or expired reset link"
      : "Failed to reset password. Please try again."
    : "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">EduBook</h1>
          <p className="text-muted-foreground mt-1">Reset Your Password</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">
              {success ? "Password Reset" : "Set New Password"}
            </CardTitle>
            <CardDescription>
              {success
                ? "Your password has been changed successfully"
                : "Choose a strong new password for your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mx-auto">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  You can now sign in with your new password.
                </p>
                <Button className="w-full mt-4" onClick={() => setLocation("/login")}>
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters"
                        value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Repeat your password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>

                  {errorMessage && (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{errorMessage}</div>
                  )}

                  <Button type="submit" className="w-full" disabled={isResettingPassword}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isResettingPassword ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
                <div className="mt-4 text-center">
                  <a href="/login" className="text-sm text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                    onClick={(e) => { e.preventDefault(); setLocation("/login"); }}>
                    <ArrowLeft className="h-3 w-3" /> Back to sign in
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
