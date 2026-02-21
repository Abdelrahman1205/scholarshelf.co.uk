import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Layout from "@/components/layout";
import AdminDashboard from "@/pages/admin";
import TeacherDashboard from "@/pages/teacher";
import ParentDashboard from "@/pages/parent";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          <Redirect to="/admin" />
        </Route>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/teacher" component={TeacherDashboard} />
        <Route path="/parent" component={ParentDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
