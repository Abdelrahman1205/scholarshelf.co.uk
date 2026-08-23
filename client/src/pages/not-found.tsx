import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/**
 * The 404 page used to read "Did you forget to add the page to the router?" —
 * a message written by a developer, for a developer, shown to headteachers and
 * parents. It also carried no link anywhere, so a mistyped URL was a dead end.
 *
 * Where "back" leads depends on who is looking: a parent belongs in the parent
 * portal, a teacher on their distribution list. Falling back to "/" would send a
 * signed-in user to the marketing site.
 */
const HOME_BY_ROLE: Record<string, { path: string; label: string }> = {
  parent: { path: "/parent", label: "Back to my children" },
  teacher: { path: "/teacher", label: "Back to my classes" },
  finance: { path: "/finance", label: "Back to the finance dashboard" },
  school_admin: { path: "/admin", label: "Back to the dashboard" },
  admin: { path: "/admin", label: "Back to the dashboard" },
  it_personnel: { path: "/admin", label: "Back to the dashboard" },
  owner: { path: "/admin", label: "Back to the dashboard" },
  platform_admin: { path: "/admin", label: "Back to the dashboard" },
};

export default function NotFound() {
  const { user } = useAuth();
  const home = (user?.role && HOME_BY_ROLE[user.role]) || { path: "/", label: "Go to the home page" };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-7 w-7 text-muted-foreground shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                We couldn&rsquo;t find that page
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                The link may be out of date, or the page may have moved. Nothing has gone wrong
                with your account.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={home.path}>
                <Home className="h-3.5 w-3.5 mr-1.5" />
                {home.label}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Go back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
