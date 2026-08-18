import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicFooter } from "@/components/public-footer";
import { apiRequest } from "@/lib/queryClient";

// Public "Contact us" page. The form posts to /api/public/contact, which emails
// the enquiry to a fixed internal inbox and sends the sender an acknowledgement.
export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", company: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/public/contact", form);
      return res.json().catch(() => ({}));
    },
    onSuccess: () => { setSent(true); setError(""); },
    onError: (e: any) => setError(e?.message || "Sorry, we couldn't send your message. Please email us directly."),
  });

  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.message.trim();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 w-full max-w-3xl mx-auto px-5 py-10">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Contact us</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Questions about ScholarShelf, or interested in using it at your school? We'd be glad to hear from you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">Email</p>
            <a href="mailto:abdelrahman-m@bytehubtech.co.uk" className="text-sm font-medium hover:underline break-all">
              abdelrahman-m@bytehubtech.co.uk
            </a>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">Telephone</p>
            <a href="tel:07503576478" className="text-sm font-medium hover:underline">07503576478</a>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">Company</p>
            <p className="text-sm font-medium leading-snug">BYTE HUB TECHNOLOGY CORPORATE LTD</p>
            <p className="text-xs text-muted-foreground">Company No. 16884170</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mt-6">
          {sent ? (
            <div className="text-center py-8">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-heading font-bold mt-3">Message sent</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Thank you — we've received your message and will reply as soon as we can.
              </p>
              <Button variant="outline" className="mt-5" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "", company: "" }); }}>
                Send another message
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}
              className="space-y-4"
            >
              <h2 className="text-base font-heading font-bold">Send us a message</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="c-name">Your name *</Label>
                  <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="c-email">Email address *</Label>
                  <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="c-subject">Subject</Label>
                <Input id="c-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="c-message">Message *</Label>
                <Textarea id="c-message" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
              </div>

              {/* Honeypot — hidden from real users; bots that fill it are silently ignored */}
              <input
                type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  We'll use your details only to reply. See our{" "}
                  <Link href="/privacy" className="underline">Privacy Policy</Link>.
                </p>
                <Button type="submit" disabled={!valid || mutation.isPending}>
                  {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…</> : "Send message"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
