import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, MapPin, Mail, Phone, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function SchoolPublicPage() {
  const { code } = useParams<{ code: string }>();

  const { data: school, isLoading, isError } = useQuery({
    queryKey: ["public-school", code],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/public/schools/${code?.toUpperCase()}`);
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // CMS sections managed by the school's IT staff (published only)
  const { data: sections } = useQuery<any[]>({
    queryKey: ["public-school-website", code],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/public/schools/${code?.toUpperCase()}/website`);
      return res.json();
    },
    retry: false,
    staleTime: 60 * 1000,
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Skeleton className="h-20 w-20 rounded-full mb-6" />
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  if (isError || !school) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">School Not Found</h1>
        <p className="text-muted-foreground mb-6">
          No active school with code <span className="font-mono font-semibold">{code?.toUpperCase()}</span> was found.
        </p>
        <Button variant="outline" asChild>
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  const primary = school.branding?.primaryColour ?? "#2563EB";
  const logoUrl = school.branding?.logoUrl;
  const bannerUrl = school.branding?.bannerImageUrl;

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${primary}10 0%, transparent 40%)` }}>
      {/* Banner / hero */}
      <div
        className="relative w-full h-56 md:h-72 flex items-end overflow-hidden"
        style={{
          background: bannerUrl
            ? `url(${bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${primary}33 0%, ${primary}66 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* School identity */}
      <div className="max-w-2xl mx-auto px-6 -mt-12 relative z-10">
        <div className="flex items-end gap-4 mb-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={school.name}
              className="h-20 w-20 rounded-xl object-contain bg-card border border-border shadow-md"
            />
          ) : (
            <div
              className="h-20 w-20 rounded-xl flex items-center justify-center shadow-md border border-border bg-card"
              style={{ color: primary }}
            >
              <BookOpen className="w-10 h-10" />
            </div>
          )}
          <div className="pb-1">
            <Badge variant="secondary" className="font-mono text-xs mb-1">{school.code}</Badge>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground leading-tight">
              {school.name}
            </h1>
          </div>
        </div>

        {/* Contact info */}
        {(school.address || school.contactEmail || school.contactPhone) && (
          <Card className="mb-6 border-border shadow-sm">
            <CardContent className="p-5 space-y-3">
              {school.address && (
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <span>{school.address}</span>
                </div>
              )}
              {school.contactEmail && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0 text-primary" />
                  <a href={`mailto:${school.contactEmail}`} className="hover:text-foreground transition-colors">
                    {school.contactEmail}
                  </a>
                </div>
              )}
              {school.contactPhone && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0 text-primary" />
                  <a href={`tel:${school.contactPhone}`} className="hover:text-foreground transition-colors">
                    {school.contactPhone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CMS content sections (managed in the school's Website editor) */}
        {sections && sections.length > 0 && (
          <div className="space-y-5 mb-8">
            {sections.map((s: any) => (
              <Card key={s.id} className="border-border shadow-sm overflow-hidden">
                {s.imageUrl && (
                  <img src={s.imageUrl} alt={s.title} className="w-full max-h-64 object-cover" />
                )}
                <CardContent className="p-5">
                  {s.type === "announcement" && (
                    <Badge className="mb-2" style={{ background: `${primary}18`, color: primary }}>News</Badge>
                  )}
                  <h2 className="text-lg font-heading font-semibold text-foreground mb-2">{s.title}</h2>
                  {s.body && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{s.body}</p>
                  )}
                  {s.linkUrl && (
                    <a href={s.linkUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium mt-3 hover:underline" style={{ color: primary }}>
                      {s.linkLabel || "Learn more"} <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you a parent at {school.name}? Register or log in to manage your child's books.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="gap-2 flex-1">
              <Link href={`/register?school=${school.code}`}>
                <ArrowRight className="w-4 h-4" />
                Register as a Parent
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2 flex-1">
              <Link href="/login">
                <LogIn className="w-4 h-4" />
                Log In
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Powered by <span className="font-semibold">BytHub ScholarShelf</span>
        </p>
      </div>
    </div>
  );
}

export default SchoolPublicPage;
