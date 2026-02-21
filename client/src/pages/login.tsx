import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated, user, isLoggingIn, loginError } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") setLocation("/admin");
      else if (user.role === "teacher") setLocation("/teacher");
      else if (user.role === "parent") setLocation("/parent");
    }
  }, [isAuthenticated, user, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const loggedInUser = await login({ username, password });
      if (loggedInUser.role === "admin") setLocation("/admin");
      else if (loggedInUser.role === "teacher") setLocation("/teacher");
      else if (loggedInUser.role === "parent") setLocation("/parent");
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">EduBook</h1>
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
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {loginError && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" data-testid="text-login-error">
                  {loginError.message.includes("401") ? "Invalid username or password" : "Login failed. Please try again."}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-login">
                <LogIn className="mr-2 h-4 w-4" />
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-3">Demo Accounts</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Admin", username: "admin", password: "admin123" },
                  { label: "Teacher", username: "teacher", password: "teacher123" },
                  { label: "Parent", username: "parent", password: "parent123" },
                ].map((demo) => (
                  <Button
                    key={demo.username}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid={`button-demo-${demo.username}`}
                    onClick={() => {
                      setUsername(demo.username);
                      setPassword(demo.password);
                    }}
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
