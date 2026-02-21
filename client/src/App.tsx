import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";

import Layout from "@/components/layout";
import AdminDashboard from "@/pages/admin";
import TeacherDashboard from "@/pages/teacher";
import ParentDashboard from "@/pages/parent";
import LoginPage from "@/pages/login";

function getRoleRoute(role: string) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "parent") return "/parent";
  return "/login";
}

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
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <RoleRedirect />
      </Route>
      <Route path="/admin">
        <AuthGuard allowedRoles={["admin"]}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/teacher">
        <AuthGuard allowedRoles={["teacher"]}>
          <Layout>
            <TeacherDashboard />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/parent">
        <AuthGuard allowedRoles={["parent"]}>
          <Layout>
            <ParentDashboard />
          </Layout>
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
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
