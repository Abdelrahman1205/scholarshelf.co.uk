import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { forgotPassword, isForgotPending } = useAuth();
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await forgotPassword({ email });
      setSubmitted(true);
    } catch {
      // Even on error, show success to prevent email enumeration
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">EduBook</h1>
          <p className="text-muted-foreground mt-1">Password Recovery</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Forgot Password</CardTitle>
            <CardDescription>
              {submitted
                ? "Check your email for reset instructions"
                : "Enter your email and we'll send you a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mx-auto">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  If an account with that email exists, a password reset link has been sent. Please check your inbox.
                </p>
                <p className="text-xs text-muted-foreground">
                  In development mode, the reset link is printed to the server console.
                </p>
                <Button variant="outline" className="w-full mt-4"
                  onClick={() => setLocation("/login")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="your@email.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} required autoFocus />
                  </div>
                  <Button type="submit" className="w-full" disabled={isForgotPending}>
                    <Mail className="mr-2 h-4 w-4" />
                    {isForgotPending ? "Sending..." : "Send Reset Link"}
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
