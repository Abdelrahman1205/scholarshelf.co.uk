import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Users, UserPlus, Plus, Trash2, Check, CircleCheck, Circle, Link as LinkIcon,
  ArrowLeft, Loader2, AlertTriangle, Camera, GraduationCap, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { navigateTo } from "./shared";

type Guardian = { fullName: string; relationship: string; email: string; phone: string; isPrimaryContact: boolean };
type Student = { fullName: string; dateOfBirth: string; gender: string; gradeLevel: string; classId: string; preferredReadingLevel: string; photoUrl: string };

const emptyGuardian = (): Guardian => ({ fullName: "", relationship: "", email: "", phone: "", isPrimaryContact: false });
const emptyStudent = (): Student => ({ fullName: "", dateOfBirth: "", gender: "", gradeLevel: "", classId: "", preferredReadingLevel: "", photoUrl: "" });

const STEPS = ["Family Search", "Guardians", "Students", "Review"];

function FamilyEnrollmentSection() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"link" | "create">("create");
  const [search, setSearch] = useState("");
  const [linkedFamily, setLinkedFamily] = useState<any>(null);
  const [family, setFamily] = useState({ householdName: "", primaryPhone: "", primaryEmail: "", address: "" });
  const [guardians, setGuardians] = useState<Guardian[]>([{ ...emptyGuardian(), isPrimaryContact: true }]);
  const [students, setStudents] = useState<Student[]>([emptyStudent()]);
  const [dupMatches, setDupMatches] = useState<any[] | null>(null);

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes"], queryFn: getQueryFn({ on401: "throw" }) });

  const searchQuery = useQuery<any[]>({
    queryKey: ["/api/families/search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(`/api/families/search?q=${encodeURIComponent(search.trim())}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mode === "link" && search.trim().length >= 2,
  });

  // ── Derived completion state ──
  const familyComplete = !!linkedFamily || family.householdName.trim().length > 0;
  const validGuardians = guardians.filter((g) => g.fullName.trim() && (g.email.trim() || g.phone.trim()));
  const guardiansComplete = linkedFamily ? true : validGuardians.length > 0;
  // A student is "added" as soon as they have a name — DOB/grade validated on submit
  const namedStudents = students.filter((s) => s.fullName.trim().length > 0);
  // A student is "ready to enroll" only when all required fields are present
  const validStudents = students.filter((s) => s.fullName.trim() && s.dateOfBirth.trim() && s.gradeLevel.trim());
  const studentsComplete = namedStudents.length > 0;
  const readyToEnroll = familyComplete && guardiansComplete && studentsComplete;
  const currentStep = !familyComplete ? 1 : !guardiansComplete ? 2 : !studentsComplete ? 3 : 4;

  const buildPayload = () => ({
    familyId: linkedFamily?.id || undefined,
    family: {
      householdName: linkedFamily ? (linkedFamily.householdName || linkedFamily.name) : family.householdName,
      primaryPhone: family.primaryPhone, primaryEmail: family.primaryEmail, address: family.address,
    },
    guardians: guardians.filter((g) => g.fullName.trim()),
    students: students.filter((s) => s.fullName.trim()),
  });

  const enrollMutation = useMutation({
    mutationFn: async (override: boolean) => {
      const res = await fetch("/api/families/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...buildPayload(), duplicateOverride: override }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        throw Object.assign(new Error(data.message || "Possible duplicate detected"), {
          duplicate: true,
          matches: data.matches || [],
        });
      }
      if (!res.ok) {
        throw new Error(data.message || `Enroll failed (${res.status})`);
      }
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: "Family enrolled", description: `${d.family?.familyCode || "Family"} · ${d.students?.length || 0} student(s).` });
      navigateTo("/admin/families");
    },
    onError: (e: any) => {
      if (e.duplicate) { setDupMatches(e.matches || []); return; }
      toast({ title: "Could not enroll", description: e.message, variant: "destructive" });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/families/save-draft", buildPayload())).json(),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      toast({ title: "Draft saved", description: d.family?.familyCode ? `Reference ${d.family.familyCode}` : undefined });
    },
    onError: (e: any) => toast({ title: "Could not save draft", description: e.message, variant: "destructive" }),
  });

  const setGuardian = (i: number, patch: Partial<Guardian>) => setGuardians((gs) => gs.map((g, idx) => idx === i ? { ...g, ...patch } : (patch.isPrimaryContact ? { ...g, isPrimaryContact: false } : g)));
  const setStudent = (i: number, patch: Partial<Student>) => setStudents((ss) => ss.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const onPhoto = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStudent(i, { photoUrl: String(reader.result) });
    reader.readAsDataURL(file); e.target.value = "";
  };

  const mono = "text-[10px] font-mono uppercase tracking-wider text-muted-foreground";
  const ChecklistRow = ({ done, label, note }: { done: boolean; label: string; note: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">{done ? <CircleCheck className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-muted-foreground/40" />}<span className="text-sm text-foreground">{label}</span></div>
      <span className={cn("text-xs", done ? "text-emerald-600" : "text-muted-foreground")}>{note}</span>
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigateTo("/admin/families")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Directory</button>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">New Family Enrollment</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((label, i) => {
          const n = i + 1; const active = n === currentStep; const done = n < currentStep;
          return (
            <div key={label} className="flex items-center gap-2 shrink-0">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold", done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{done ? <Check className="w-4 h-4" /> : n}</div>
              <span className={cn("text-sm", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
              {i < STEPS.length - 1 && <div className="w-10 h-px bg-border mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* ── Main column ── */}
        <div className="space-y-5">
          {/* 1. Find or Create Family */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4"><Home className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Find or Create Family</h2></div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button variant={mode === "link" ? "default" : "outline"} onClick={() => { setMode("link"); }}><LinkIcon className="w-4 h-4 mr-2" /> Link Existing Family</Button>
              <Button variant={mode === "create" ? "default" : "outline"} onClick={() => { setMode("create"); setLinkedFamily(null); }}><UserPlus className="w-4 h-4 mr-2" /> Create New Family</Button>
            </div>

            {mode === "link" ? (
              <div className="space-y-3">
                <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search by parent name, email, phone, or student name…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                {linkedFamily ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><CircleCheck className="w-4 h-4 text-emerald-600" /><strong>{linkedFamily.householdName || linkedFamily.name}</strong><span className="text-muted-foreground">· {linkedFamily.familyCode}</span></div>
                    <Button variant="ghost" size="sm" onClick={() => setLinkedFamily(null)}>Change</Button>
                  </div>
                ) : searchQuery.isFetching ? (
                  <div className="py-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /> Searching…</div>
                ) : (searchQuery.data || []).length > 0 ? (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {(searchQuery.data || []).map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">{(f.householdName || f.name || "F").slice(0, 1)}</div>
                          <div><div className="font-medium text-foreground">{f.householdName || f.name}</div><div className="text-xs text-muted-foreground">{f.familyCode} · {(f.guardians || []).length} guardian(s) · {(f.students || []).length} student(s)</div></div>
                        </div>
                        <Button size="sm" onClick={() => { setLinkedFamily(f); setSearch(""); }}>Select Family</Button>
                      </div>
                    ))}
                  </div>
                ) : search.trim().length >= 2 ? (
                  <p className="text-sm text-muted-foreground">No families found. Switch to <button className="text-primary underline" onClick={() => setMode("create")}>Create New Family</button>.</p>
                ) : null}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label className={mono}>Family / Household Name</Label><Input placeholder="e.g. The Smith Household" value={family.householdName} onChange={(e) => setFamily({ ...family, householdName: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label className={mono}>Primary Contact Phone</Label><Input placeholder="(555) 123-4567" value={family.primaryPhone} onChange={(e) => setFamily({ ...family, primaryPhone: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label className={mono}>Primary Contact Email</Label><Input type="email" placeholder="name@email.com" value={family.primaryEmail} onChange={(e) => setFamily({ ...family, primaryEmail: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label className={mono}>Address</Label><Input placeholder="Street, city, ZIP" value={family.address} onChange={(e) => setFamily({ ...family, address: e.target.value })} /></div>
              </div>
            )}
          </section>

          {/* 2. Parents / Guardians */}
          {!linkedFamily && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Parents / Guardians</h2></div>
                <Badge variant="secondary">{validGuardians.length} Guardian(s) Added</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {guardians.map((g, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">Guardian {i + 1} {g.isPrimaryContact && <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-700 border-emerald-200">Primary Contact</Badge>}</div>
                      {guardians.length > 1 && <button onClick={() => setGuardians((gs) => gs.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1"><Label className={mono}>Full Name</Label><Input value={g.fullName} onChange={(e) => setGuardian(i, { fullName: e.target.value })} /></div>
                      <div className="grid gap-1"><Label className={mono}>Relationship</Label>
                        <Select value={g.relationship} onValueChange={(v) => setGuardian(i, { relationship: v })}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{["Mother", "Father", "Guardian", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1"><Label className={mono}>Email</Label><Input type="email" value={g.email} onChange={(e) => setGuardian(i, { email: e.target.value })} /></div>
                      <div className="grid gap-1"><Label className={mono}>Phone</Label><Input value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} /></div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" checked={g.isPrimaryContact} onChange={(e) => setGuardian(i, { isPrimaryContact: e.target.checked })} /> Primary contact
                    </label>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 border-dashed" onClick={() => setGuardians((gs) => [...gs, emptyGuardian()])}><Plus className="w-4 h-4 mr-2" /> Add Another Guardian</Button>
            </section>
          )}

          {/* 3. Students in this Family */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Students in this Family</h2></div>
              <Badge variant="secondary">{namedStudents.length} Student(s) Added</Badge>
            </div>
            <div className="space-y-4">
              {students.map((s, i) => (
                <div key={i} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-medium text-sm">Student {i + 1}</div>
                    {students.length > 1 && <button onClick={() => setStudents((ss) => ss.filter((_, idx) => idx !== i))} className="text-destructive text-xs inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
                  </div>
                  <div className="flex gap-4">
                    <label className="shrink-0 h-24 w-24 rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden text-muted-foreground">
                      {s.photoUrl ? <img src={s.photoUrl} alt="" className="h-full w-full object-cover" /> : <><Camera className="w-5 h-5 mb-1" /><span className="text-[10px]">Upload Photo</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={onPhoto(i)} />
                    </label>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="grid gap-1">
                        <Label className={mono}>Full Name <span className="text-destructive">*</span></Label>
                        <Input value={s.fullName} onChange={(e) => setStudent(i, { fullName: e.target.value })} />
                      </div>
                      <div className="grid gap-1">
                        <Label className={mono}>Date of Birth <span className="text-destructive">*</span></Label>
                        <Input type="date" value={s.dateOfBirth} onChange={(e) => setStudent(i, { dateOfBirth: e.target.value })} className={s.fullName.trim() && !s.dateOfBirth.trim() ? "border-amber-400" : ""} />
                      </div>
                      <div className="grid gap-1"><Label className={mono}>Gender</Label>
                        <Select value={s.gender} onValueChange={(v) => setStudent(i, { gender: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{["Female", "Male", "Other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className={mono}>Grade Level <span className="text-destructive">*</span></Label>
                        <Input placeholder="e.g. 3rd Grade" value={s.gradeLevel} onChange={(e) => setStudent(i, { gradeLevel: e.target.value })} className={s.fullName.trim() && !s.gradeLevel.trim() ? "border-amber-400" : ""} />
                      </div>
                      <div className="grid gap-1"><Label className={mono}>Reading Level</Label><Input placeholder="e.g. M" value={s.preferredReadingLevel} onChange={(e) => setStudent(i, { preferredReadingLevel: e.target.value })} /></div>
                      <div className="grid gap-1"><Label className={mono}>Campus / Class</Label>
                        <Select value={s.classId} onValueChange={(v) => setStudent(i, { classId: v })}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="grid gap-1 col-span-2 md:col-span-3"><Label className={mono}>Student ID · Auto-generated</Label><Input disabled value="Generated on enrollment" className="text-muted-foreground italic" /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 border-dashed" onClick={() => setStudents((ss) => [...ss, emptyStudent()])}><Plus className="w-4 h-4 mr-2" /> Add Another Student</Button>
            {namedStudents.length > 0 && validStudents.length < namedStudents.length && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Complete required fields (marked <span className="text-destructive font-bold">*</span>) to enable enrollment.</p>
            )}
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> All students added here are automatically linked to this family record.</p>
          </section>

          {/* Duplicate warning */}
          {dupMatches && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-2 text-amber-800 font-medium"><AlertTriangle className="w-5 h-5" /> Possible duplicate family</div>
              <p className="text-sm text-amber-800 mb-3">A family with this email or phone may already exist{dupMatches.length ? ":" : "."} {dupMatches.map((m) => `${m.householdName} (${m.familyCode})`).join(", ")}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setMode("link"); setDupMatches(null); }}>Link the existing family</Button>
                <Button variant="destructive" onClick={() => { setDupMatches(null); enrollMutation.mutate(true); }}>Create anyway</Button>
              </div>
            </section>
          )}
        </div>

        {/* ── Sticky enrollment summary ── */}
        <aside className="lg:sticky lg:top-4 space-y-4">
          <div className="rounded-2xl bg-[#091426] text-white p-5">
            <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4" /><h2 className="font-semibold">Enrollment Summary</h2></div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-white/60">Enrollment Date</dt><dd>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Family Record Status</dt><dd><span className="text-[10px] font-mono uppercase bg-white/15 rounded px-2 py-0.5">{readyToEnroll ? "Ready" : "Draft"}</span></dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Guardians Added</dt><dd>{validGuardians.length || (linkedFamily ? "—" : 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Students Added</dt><dd>{namedStudents.length}</dd></div>
            </dl>
            <div className="border-t border-white/10 mt-4 pt-3">
              <div className="text-[10px] font-mono uppercase text-white/50 mb-1">Progress Checklist</div>
              <div className="[&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50">
                <ChecklistRow done={familyComplete} label="Family details" note={familyComplete ? "Complete" : "Pending"} />
                <ChecklistRow done={guardiansComplete} label="Guardians" note={guardiansComplete ? `${validGuardians.length || "linked"} added` : "Pending"} />
                <ChecklistRow done={studentsComplete} label="Students" note={studentsComplete ? `${namedStudents.length} added${validStudents.length < namedStudents.length ? " (fill required fields)" : ""}` : "Pending"} />
                <ChecklistRow done={readyToEnroll} label="Review & submit" note={readyToEnroll ? "Ready" : "Pending"} />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Button className="w-full bg-white text-[#091426] hover:bg-white/90" disabled={!readyToEnroll || enrollMutation.isPending} onClick={() => enrollMutation.mutate(false)}>
                {enrollMutation.isPending ? "Enrolling…" : `Enroll Family (${namedStudents.length} Student${namedStudents.length === 1 ? "" : "s"})`}
              </Button>
              <Button variant="outline" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10" disabled={draftMutation.isPending} onClick={() => draftMutation.mutate()}>{draftMutation.isPending ? "Saving…" : "Save Draft"}</Button>
              <Button variant="ghost" className="w-full text-red-300 hover:text-red-200 hover:bg-white/5" onClick={() => navigateTo("/admin/families")}>Cancel</Button>
            </div>
          </div>
          {!readyToEnroll && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              {!familyComplete && <p>• Add a household name or link an existing family.</p>}
              {!guardiansComplete && <p>• Add at least one guardian with a name and contact method.</p>}
              {namedStudents.length === 0 && <p>• Add at least one student (enter their name).</p>}
              {namedStudents.length > 0 && validStudents.length < namedStudents.length && (
                <p>• Complete Date of Birth <span className="font-medium">(day/month/year)</span> and Grade Level for each student.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export { FamilyEnrollmentSection };
