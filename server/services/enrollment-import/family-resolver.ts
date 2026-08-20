/**
 * server/services/enrollment-import/family-resolver.ts
 *
 * ScholarShelf enrollment is FAMILY-FIRST: a student belongs to one family, and
 * the family record carries the guardians and the parent-portal invite. A
 * spreadsheet row is one student, so the importer has to decide which family
 * that student joins — otherwise siblings would land in separate households and
 * the Family Directory would be nonsense.
 *
 * GROUPING KEY, in priority order:
 *   1. Family / Household Name column, normalised (trim + collapse spaces +
 *      lowercase). Explicit beats inferred.
 *   2. Parent / Guardian Email, lowercased. Two rows naming the same guardian
 *      email are siblings.
 *   3. Parent / Guardian Phone, digits only.
 *   4. Fallback: the student's surname → "Brown Household". Two unrelated
 *      Browns with no contact details do NOT merge — the fallback key includes
 *      the row, so each gets its own household record. Guessing kinship from a
 *      surname alone would be exactly the "aggressive fuzzy matching" that
 *      quietly corrupts data.
 *
 * REUSING AN EXISTING FAMILY: an existing family is matched by household name
 * (case-insensitive, school-scoped) or by an existing guardian's email/phone —
 * the same signals `findGuardianContactMatches()` uses for the manual form's
 * duplicate warning. When a matched student already has a familyId, that wins
 * over everything: a re-import never moves a child out of their household.
 */

export interface ExistingFamilyLike {
  id: string;
  name: string;
  householdName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  familyCode: string | null;
}

export interface ExistingGuardianLike {
  id: string;
  familyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
}

export function householdKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function emailKey(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  return e || null;
}

export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  // Fewer than 7 digits is not a usable contact number — do not group on it.
  return digits.length >= 7 ? digits : null;
}

export interface FamilyGroupPlan {
  /** Stable key for this group within the import. */
  key: string;
  /** Household name that will be stored / used to create the family. */
  householdName: string;
  /** Existing family this group resolves to, when one was matched. */
  existingFamilyId: string | null;
  existingFamilyCode: string | null;
}

/**
 * Index of a school's existing families for O(1) lookup during an import.
 */
export class FamilyIndex {
  private byHousehold = new Map<string, ExistingFamilyLike>();
  private byContact = new Map<string, ExistingFamilyLike>();

  constructor(families: ExistingFamilyLike[], guardians: ExistingGuardianLike[]) {
    const byId = new Map(families.map((f) => [f.id, f]));
    for (const f of families) {
      const hk = householdKey(f.householdName || f.name || "");
      if (hk && !this.byHousehold.has(hk)) this.byHousehold.set(hk, f);
      const ek = emailKey(f.primaryEmail);
      if (ek && !this.byContact.has(ek)) this.byContact.set(ek, f);
      const pk = phoneKey(f.primaryPhone);
      if (pk && !this.byContact.has(pk)) this.byContact.set(pk, f);
    }
    for (const g of guardians) {
      const fam = byId.get(g.familyId);
      if (!fam) continue;
      const ek = emailKey(g.email);
      if (ek && !this.byContact.has(ek)) this.byContact.set(ek, fam);
      const pk = phoneKey(g.phone);
      if (pk && !this.byContact.has(pk)) this.byContact.set(pk, fam);
    }
  }

  matchByHousehold(name: string | null): ExistingFamilyLike | null {
    if (!name) return null;
    return this.byHousehold.get(householdKey(name)) || null;
  }

  matchByContact(email: string | null, phone: string | null): ExistingFamilyLike | null {
    const ek = emailKey(email);
    if (ek) { const hit = this.byContact.get(ek); if (hit) return hit; }
    const pk = phoneKey(phone);
    if (pk) { const hit = this.byContact.get(pk); if (hit) return hit; }
    return null;
  }

  /** Register a family created during this import. */
  add(family: ExistingFamilyLike, guardianEmail?: string | null, guardianPhone?: string | null): void {
    const hk = householdKey(family.householdName || family.name || "");
    if (hk) this.byHousehold.set(hk, family);
    for (const k of [emailKey(family.primaryEmail), phoneKey(family.primaryPhone), emailKey(guardianEmail), phoneKey(guardianPhone)]) {
      if (k) this.byContact.set(k, family);
    }
  }
}

export interface RowFamilyInput {
  sheetRow: number;
  studentFullName: string;
  householdName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  familyEmail: string | null;
  familyPhone: string | null;
}

/** The grouping key for one row, per the priority order documented above. */
export function familyGroupKey(row: RowFamilyInput, fallbackHousehold: string): string {
  if (row.householdName) return `household:${householdKey(row.householdName)}`;
  const ek = emailKey(row.guardianEmail) || emailKey(row.familyEmail);
  if (ek) return `email:${ek}`;
  const pk = phoneKey(row.guardianPhone) || phoneKey(row.familyPhone);
  if (pk) return `phone:${pk}`;
  // No shared signal at all — keep this student in their own household rather
  // than merging strangers who happen to share a surname.
  return `row:${row.sheetRow}:${householdKey(fallbackHousehold)}`;
}
