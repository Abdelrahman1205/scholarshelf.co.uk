import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { getRoleRoute } from "@/lib/role-routes";
import SchoolPublicPage from "@/pages/school-public";

import Layout from "@/components/layout";
import AdminPage from "@/pages/admin";
import TeacherPage from "@/pages/teacher";
import ParentPage from "@/pages/parent";
import FinancePage from "@/pages/finance";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import AcceptInvitePage from "@/pages/accept-invite";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import SecurityPage from "@/pages/security";

function AuthGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (!allowedRoles.includes(user!.role)) {
      setLocation(getRoleRoute(user!.role));
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !allowedRoles.includes(user!.role)) {
    return null;
  }

  return <>{children}</>;
}

function RoleRedirect() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
    } else {
      setLocation(getRoleRoute(user!.role));
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public auth routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/accept-invite" component={AcceptInvitePage} />
      <Route path="/accept-invite/:token" component={AcceptInvitePage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      <Route path="/">
        <RoleRedirect />
      </Route>

      {/* Public school landing page */}
      <Route path="/school/:code" component={SchoolPublicPage} />

      {/* Admin routes */}
      <Route path="/admin/:section?">
        {(params) => (
          <AuthGuard allowedRoles={["admin", "school_admin", "owner", "platform_admin", "it_personnel"]}>
            <Layout>
              <AdminPage section={params.section || "dashboard"} />
            </Layout>
          </AuthGuard>
        )}
      </Route>

      {/* Teacher routes */}
      <Route path="/teacher/:section?">
        {(params) => (
          <AuthGuard allowedRoles={["teacher"]}>
            <Layout>
              <TeacherPage section={params.section || "dashboard"} />
            </Layout>
          </AuthGuard>
        )}
      </Route>

      {/* Parent routes */}
      <Route path="/parent/:section?">
        {(params) => (
          <AuthGuard allowedRoles={["parent"]}>
            <Layout>
              <ParentPage section={params.section || "dashboard"} />
            </Layout>
          </AuthGuard>
        )}
      </Route>

      {/* Finance routes */}
      <Route path="/finance/:section?">
        {(params) => (
          <AuthGuard allowedRoles={["finance"]}>
            <Layout>
              <FinancePage section={params.section || "dashboard"} />
            </Layout>
          </AuthGuard>
        )}
      </Route>

      {/* Account security (2FA) — any authenticated user */}
      <Route path="/security">
        <AuthGuard allowedRoles={["admin", "school_admin", "owner", "platform_admin", "it_personnel", "teacher", "parent", "finance"]}>
          <SecurityPage />
        </AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
