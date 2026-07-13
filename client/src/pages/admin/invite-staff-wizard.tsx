import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, X, Check, CheckCircle2, UserPlus, Search, Users,
  GraduationCap, ShieldCheck, Wallet, Mail, Loader2, Home, Building2, UserSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { roleLabel } from "./shared";

// ─────────────────────────────────────────────────────────────────────────────
// Multi-step Staff Invitation Wizard
// Implements the "SCHOLARSHELF DESIGN UI UX" staff-onboarding flow:
//   1. Staff Details        2. Role & Access       3. Family Connection
//   4. Find / Select Family 5. Confirm Relationship 6. Review   7. Success
//
// Wired entirely to existing endpoints — no schema/backend change:
//   • GET  /api/admin/users        → smart "existing account" (dual-role) detection
//   • GET  /api/families/search    → find an existing family to link
//   • GET  /api/classes            → teacher class assignment
//   • POST /api/invites            → send invite (+ linkToExisting for unified accounts)
// ─────────────────────────────────────────────────────────────────────────────

type Details = {
  firstName: string; lastName: string; email: string; employeeRef: string;
  department: string; jobTitle: string; startDate: string; phone: string;
};

const DEPARTMENTS = ["Humanities", "Science & Math", "Administration", "Physical Education", "Other"];
const RELATIONSHIPS = ["Mother", "Father", "Legal Guardian", "Step-Parent", "Other Relative"];

const ROLE_OPTIONS: { value: string; label: string; blurb: string; icon: any }[] = [
  { value: "teacher", label: "Teacher", blurb: "Manage classes, assign books, and communicate with parents.", icon: GraduationCap },
  { value: "finance", label: "Finance", blurb: "Oversee billing, distribution fees, and payment reconciliations.", icon: Wallet },
  { value: "it_personnel", label: "IT Administrator", blurb: "Manage website, branding, media, and platform settings.", icon: Building2 },
  { value: "school_admin", label: "School Administrator", blurb: "Global oversight of staff, students, and inventory.", icon: ShieldCheck },
];

export function InviteStaffWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<Details>({
    firstName: "", lastName: "", email: "", employeeRef: "",
    department: "", jobTitle: "", startDate: "", phone: "",
  });
  const [role, setRole] = useState("teacher");
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState("");
  const [yearGroups, setYearGroups] = useState("");
  const [hasFamily, setHasFamily] = useState<boolean | null>(null);
  const [familyQuery, setFamilyQuery] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [relationship, setRelationship] = useState("");
  const [perms, setPerms] = useState({
    primaryGuardian: true, financiallyResponsible: false,
    authorisedToCollect: true, receiveCommunications: true,
  });
  const [result, setResult] = useState<any>(null);

  // Smart existing-account (dual-role) detection — client-side match by email.
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json()),
    enabled: open,
  });
  const emailTrim = details.email.trim().toLowerCase();
  const existing = useMemo(
    () => (emailTrim ? users.find((u: any) => (u.email || "").toLowerCase() === emailTrim) : null),
    [users, emailTrim],
  );

  // Family search
  const { data: familyResults = [], isFetching: familySearching } = useQuery<any[]>({
    queryKey: ["/api/families/search", familyQuery],
    queryFn: () => fetch(`/api/families/search?q=${encodeURIComponent(familyQuery)}`, { credentials: "include" }).then((r) => r.json()),
    enabled: open && familyQuery.trim().length >= 2,
  });

  // Classes for teacher assignment
  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["/api/classes"],
    queryFn: () => fetch("/api/classes", { credentials: "include" }).then((r) => r.json()),
    enabled: open && role === "teacher",
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body: any = { email: details.email.trim(), role };
      if (existing) body.linkToExisting = true; // unified account: add role to existing person
      // Family link (staff who is also a parent): applied on acceptance, or now if the
      // account already exists.
      if (hasFamily === true && selectedFamily?.id) {
        body.familyId = selectedFamily.id;
        if (relationship) body.relationship = relationship;
        body.guardianPermissions = perms;
      }
      const res = await apiRequest("POST", "/api/invites", body);
      return res.json().catch(() => ({}));
    },
    onSuccess: (data: any) => {
      setResult({
        email: details.email.trim(),
        role,
        linked: !!data?.linked,
        expiresAt: data?.expiresAt,
        message: data?.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
      setStep(7);
    },
    onError: (err: any) => {
      if (err?.status === 409 && err?.body?.alreadyHasRole) {
        toast({ title: "Already has this role", description: err?.body?.message || `${details.email} already has the ${roleLabel(role)} role.`, variant: "destructive" });
        return;
      }
      toast({ title: "Couldn't send invite", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  if (!open) return null;

  const fullName = `${details.firstName} ${details.lastName}`.trim();
  const isTeacher = role === "teacher";

  // Step machine (family steps 4 & 5 are skipped when hasFamily === false)
  const familyPath = hasFamily === true;
  function next() {
    if (step === 3) { setStep(familyPath ? 4 : 6); return; }
    setStep((s) => Math.min(s + 1, 7));
  }
  function back() {
    if (step === 6) { setStep(familyPath ? 5 : 3); return; }
    setStep((s) => Math.max(s - 1, 1));
  }

  function reset() {
    setStep(1);
    setDetails({ firstName: "", lastName: "", email: "", employeeRef: "", department: "", jobTitle: "", startDate: "", phone: "" });
    setRole("teacher"); setTeacherClasses([]); setSubjects(""); setYearGroups("");
    setHasFamily(null); setFamilyQuery(""); setSelectedFamily(null); setRelationship("");
    setPerms({ primaryGuardian: true, financiallyResponsible: false, authorisedToCollect: true, receiveCommunications: true });
    setResult(null);
  }
  function closeAll() { reset(); onClose(); }

  // Validation gates
  const step1Valid = details.firstName.trim() && details.email.trim() && /\S+@\S+\.\S+/.test(details.email.trim());
  const step4Valid = !!selectedFamily;
  const step5Valid = !!relationship;

  const STEP_LABELS = ["Staff Details", "Role & Access", "Family", "Find Family", "Relationship", "Review"];

  const toggleClass = (id: string) =>
    setTeacherClasses((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Invite Staff Member</h1>
              <p className="text-xs text-muted-foreground">One account · work and family access unified</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={closeAll} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>

        {/* Stepper */}
        {step < 7 && (
          <div className="flex items-center gap-1 mb-8">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const skipped = !familyPath && (n === 4 || n === 5);
              const done = step > n;
              const active = step === n;
              return (
                <div key={label} className={cn("flex items-center gap-1", skipped && "opacity-40")}>
                  <div className={cn(
                    "flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : done ? "text-primary" : "text-muted-foreground",
                  )}>
                    <span className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active ? "bg-primary-foreground/20" : done ? "bg-primary/15" : "bg-muted",
                    )}>
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {n < STEP_LABELS.length && <div className="h-px w-3 bg-border" />}
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {/* STEP 1 — Staff Details */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Staff information</h2>
                <p className="text-sm text-muted-foreground">Enter the new staff member's work details.</p>
              </div>

              {existing && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <UserSearch className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">Existing account found</p>
                    <p className="text-amber-800">
                      <span className="font-medium">{existing.name}</span> already has an account here
                      {existing.role ? <> · current access: <span className="font-medium">{roleLabel(existing.role)}</span></> : null}.
                      We'll add the new role to their existing login instead of creating a duplicate.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First name" required>
                  <Input value={details.firstName} onChange={(e) => setDetails({ ...details, firstName: e.target.value })} placeholder="Sarah" />
                </Field>
                <Field label="Last name">
                  <Input value={details.lastName} onChange={(e) => setDetails({ ...details, lastName: e.target.value })} placeholder="Ahmed" />
                </Field>
                <Field label="Work email" required>
                  <Input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} placeholder="sarah@school.org" />
                </Field>
                <Field label="Employee reference (ID)">
                  <Input value={details.employeeRef} onChange={(e) => setDetails({ ...details, employeeRef: e.target.value })} placeholder="EMP-0142" />
                </Field>
                <Field label="Department">
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={details.department}
                    onChange={(e) => setDetails({ ...details, department: e.target.value })}
                  >
                    <option value="">Select department…</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Job title">
                  <Input value={details.jobTitle} onChange={(e) => setDetails({ ...details, jobTitle: e.target.value })} placeholder="Class Teacher" />
                </Field>
                <Field label="Start date">
                  <Input type="date" value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value })} />
                </Field>
                <Field label="Phone (optional)">
                  <Input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} placeholder="+44 …" />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 — Role & Access */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Assign work role</h2>
                <p className="text-sm text-muted-foreground">Choose what this staff member can do in ScholarShelf.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((r) => {
                  const Icon = r.icon;
                  const selected = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={cn(
                        "text-left rounded-xl border p-4 transition-all",
                        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-semibold text-sm">{r.label}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.blurb}</p>
                    </button>
                  );
                })}
              </div>

              {isTeacher && (
                <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Teacher assignments</p>
                  <Field label="Assigned classes">
                    {classes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {classes.map((c: any) => {
                          const on = teacherClasses.includes(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                              {c.name}{on && <Check className="inline h-3 w-3 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">No classes found — you can assign classes later from the staff profile.</p>}
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Subjects (comma-separated)">
                      <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="English, Maths" />
                    </Field>
                    <Field label="Year groups">
                      <Input value={yearGroups} onChange={(e) => setYearGroups(e.target.value)} placeholder="Y5, Y6" />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Family Connection decision */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Does this staff member have children at this school?</h2>
                <p className="text-sm text-muted-foreground">
                  Linking gives them a single login that toggles between a Staff Dashboard and a Parent View — work and family data stay separate.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <DecisionCard
                  selected={hasFamily === false}
                  onClick={() => setHasFamily(false)}
                  icon={<Building2 className="h-5 w-5" />}
                  title="No — staff-only account"
                  blurb="Choose this if they have no enrolled children or don't want linked accounts."
                />
                <DecisionCard
                  selected={hasFamily === true}
                  onClick={() => setHasFamily(true)}
                  icon={<Users className="h-5 w-5" />}
                  title="Yes — link their children and give Parent access"
                  blurb="One login, one password. They can switch between Staff and Parent views without re-logging in."
                />
              </div>
            </div>
          )}

          {/* STEP 4 — Find / Select Family */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Connect a family</h2>
                <p className="text-sm text-muted-foreground">Search for the family this staff member belongs to.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by family name, guardian, email, or code…"
                  value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} />
              </div>

              {familyQuery.trim().length >= 2 && (
                <div className="space-y-2">
                  {familySearching && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>}
                  {!familySearching && familyResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">No families matched. You can create a new family from the Families page, then return here.</p>
                  )}
                  {familyResults.map((f: any) => {
                    const sel = selectedFamily?.id === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => setSelectedFamily(f)}
                        className={cn("w-full text-left rounded-xl border p-4 transition-all",
                          sel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40")}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{f.householdName || f.name || "Family"}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{f.familyCode}</span>
                        </div>
                        {(f.guardians?.length > 0) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Guardians: {f.guardians.map((g: any) => g.fullName).filter(Boolean).join(", ") || "—"}
                          </p>
                        )}
                        {(f.students?.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {f.students.map((s: any) => <Badge key={s.id} variant="outline" className="text-[10px]">{s.name}</Badge>)}
                          </div>
                        )}
                        {sel && <p className="text-xs text-primary mt-2 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Selected</p>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — Confirm Relationship */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Confirm family relationship</h2>
                <p className="text-sm text-muted-foreground">
                  {fullName || "This staff member"} → <span className="font-medium">{selectedFamily?.householdName || selectedFamily?.name || "family"}</span>
                </p>
              </div>

              <Field label="Relationship to the children" required>
                <div className="flex flex-wrap gap-2">
                  {RELATIONSHIPS.map((r) => (
                    <button key={r} type="button" onClick={() => setRelationship(r)}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        relationship === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                      {r}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="space-y-2">
                <p className="text-sm font-medium">Permissions &amp; responsibilities</p>
                <PermRow label="Primary guardian" blurb="First point of contact for school matters."
                  checked={perms.primaryGuardian} onChange={(v) => setPerms({ ...perms, primaryGuardian: v })} />
                <PermRow label="Financially responsible" blurb="Access to invoices and payment history."
                  checked={perms.financiallyResponsible} onChange={(v) => setPerms({ ...perms, financiallyResponsible: v })} />
                <PermRow label="Authorised to collect" blurb="On the security list for school pick-ups."
                  checked={perms.authorisedToCollect} onChange={(v) => setPerms({ ...perms, authorisedToCollect: v })} />
                <PermRow label="Receive communications" blurb="School newsletters and emergency alerts."
                  checked={perms.receiveCommunications} onChange={(v) => setPerms({ ...perms, receiveCommunications: v })} />
              </div>
            </div>
          )}

          {/* STEP 6 — Review */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Review &amp; send</h2>
                <p className="text-sm text-muted-foreground">A secure 7-day invitation link will be emailed on confirmation.</p>
              </div>

              <ReviewBlock title="Staff info" rows={[
                ["Full name", fullName || "—"],
                ["Email", details.email || "—"],
                ["Department", details.department || "—"],
                ["Job title", details.jobTitle || "—"],
              ]} />

              <ReviewBlock title="Work access" rows={[
                ["Role", roleLabel(role)],
                ...(isTeacher ? [
                  ["Classes", teacherClasses.length ? teacherClasses.map((id) => (classes.find((c: any) => c.id === id)?.name || id)).join(", ") : "—"] as [string, string],
                  ["Subjects", subjects || "—"] as [string, string],
                ] : []),
              ]} />

              {familyPath && (
                <ReviewBlock title="Family link" rows={[
                  ["Family", selectedFamily?.householdName || selectedFamily?.name || "—"],
                  ["Relationship", relationship || "—"],
                  ["Permissions", [
                    perms.primaryGuardian && "Primary guardian",
                    perms.financiallyResponsible && "Financially responsible",
                    perms.authorisedToCollect && "Authorised to collect",
                    perms.receiveCommunications && "Receive comms",
                  ].filter(Boolean).join(", ") || "—"],
                ]} />
              )}

              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {existing
                    ? <>Unified account: the <span className="font-medium text-foreground">{roleLabel(role)}</span> role will be added to <span className="font-medium text-foreground">{existing.name}</span>'s existing login.</>
                    : familyPath
                      ? <>One unified account will be created with the <span className="font-medium text-foreground">{roleLabel(role)}</span> role plus Parent access. When they accept, they'll be linked automatically to <span className="font-medium text-foreground">{selectedFamily?.householdName || selectedFamily?.name || "the family"}</span>'s children.</>
                      : <>One staff account will be created with the <span className="font-medium text-foreground">{roleLabel(role)}</span> role.</>}
                </p>
              </div>
            </div>
          )}

          {/* STEP 7 — Success */}
          {step === 7 && result && (
            <div className="text-center py-6 space-y-5">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{result.linked ? "Role added" : "Staff invitation sent"}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.linked
                    ? result.message || `The ${roleLabel(result.role)} role was added to the existing account.`
                    : <>An invitation was emailed to <span className="font-medium text-foreground">{result.email}</span>.</>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                <MiniStat label="Work role" value={roleLabel(result.role)} icon={<GraduationCap className="h-4 w-4" />} />
                <MiniStat label="Family" value={familyPath ? "Linked" : "Staff-only"} icon={<Home className="h-4 w-4" />} />
                <MiniStat label="Status" value={result.linked ? "Active" : "Invite sent"} icon={<Mail className="h-4 w-4" />} />
                <MiniStat label="Expires" value={result.expiresAt ? new Date(result.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "7-day window"} icon={<CheckCircle2 className="h-4 w-4" />} />
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button variant="outline" onClick={() => { reset(); }}>Invite another</Button>
                <Button onClick={closeAll}>Return to staff</Button>
              </div>
            </div>
          )}

          {/* Footer navigation */}
          {step < 7 && (
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
              {step === 1
                ? <Button variant="ghost" onClick={closeAll}>Cancel &amp; exit</Button>
                : <Button variant="ghost" onClick={back}><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>}

              {step < 6 && (
                <Button
                  onClick={next}
                  disabled={
                    (step === 1 && !step1Valid) ||
                    (step === 3 && hasFamily === null) ||
                    (step === 4 && !step4Valid) ||
                    (step === 5 && !step5Valid)
                  }
                >
                  Continue <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}

              {step === 6 && (
                <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending…</>
                    : <><Mail className="h-4 w-4 mr-1.5" /> {existing ? "Add role to account" : "Send staff invitation"}</>}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: any }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function DecisionCard({ selected, onClick, icon, title, blurb }: { selected: boolean; onClick: () => void; icon: any; title: string; blurb: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full text-left rounded-xl border p-4 transition-all flex items-start gap-3",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40")}>
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{icon}</div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{blurb}</p>
      </div>
      {selected && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
    </button>
  );
}

function PermRow({ label, blurb, checked, onChange }: { label: string; blurb: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
    </label>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/40 px-4 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="divide-y divide-border/60">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">{icon}{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}
