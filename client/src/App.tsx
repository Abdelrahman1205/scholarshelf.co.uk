import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { getRoleRoute } from "@/lib/role-routes";

// Eager: the app shell + the login entry point (first paint) stay in the main bundle.
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";

// Slice 6: route-level code splitting. The heavy role dashboards and the secondary
// auth/public pages load on demand, so the initial bundle (login) stays small.
const SchoolPublicPage = lazy(() => import("@/pages/school-public"));
const AdminPage = lazy(() => import("@/pages/admin"));
const TeacherPage = lazy(() => import("@/pages/teacher"));
const ParentPage = lazy(() => import("@/pages/parent"));
const FinancePage = lazy(() => import("@/pages/finance"));
const RegisterPage = lazy(() => import("@/pages/register"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SecurityPage = lazy(() => import("@/pages/security"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const ContactPage = lazy(() => import("@/pages/contact"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function AuthGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  /**
   * This only decides what is RENDERED. Every one of these pages still calls
   * APIs guarded by requireRole() on the server, which performs the same check
   * against the session — so this is a convenience, not a permission.
   */
  const permitted = user ? allowedRoles.includes(user.role) : false;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (!permitted) {
      setLocation(getRoleRoute(user!.role));
    }
  }, [isLoading, isAuthenticated, user, permitted, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !permitted) {
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
    <Suspense fallback={<PageFallback />}>
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
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/contact" component={ContactPage} />

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
    </Suspense>
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
