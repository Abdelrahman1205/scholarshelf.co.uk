/**
 * server/services/enrollment-import/class-resolver.ts
 *
 * Dynamic class resolution for spreadsheet enrollment.
 *
 * There is NO hard-coded list of classes anywhere in ScholarShelf, and this
 * file must not introduce one. A sheet uploaded in September may contain
 * "Year 7C" for the first time; the importer detects that, creates the class
 * once, and every later row naming that class reuses the new record.
 *
 * MATCHING RULES (deliberately conservative)
 *   1. Trim surrounding whitespace and collapse internal runs of whitespace.
 *   2. Compare case-insensitively.
 *   3. Exact match on that normalised form — nothing else.
 *
 * "Year 7A", " year 7a " and "YEAR 7A" therefore resolve to one class.
 * "Year 7A" and "Year 7 A" do NOT, and neither do "7A" and "Year 7A": there is
 * no fuzzy or edit-distance matching, because merging two genuinely different
 * tutor groups is far more damaging than creating one extra class an
 * administrator can rename. The preview always lists exactly which classes will
 * be created, before anything is written.
 */
import { academicYearFor } from "../../../shared/academic-year.js";

/** The normalised cache key. Exported so preview and commit agree on it. */
export function classKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface ClassLike {
  id: string;
  name: string;
  yearGroup?: string | null;
  academicYear?: string | null;
}

export interface ResolvedClass {
  id: string;
  name: string;
  /** True when this import created the class rather than reusing one. */
  created: boolean;
}

export interface PendingClass {
  /** Name exactly as it will be stored — the first spelling seen in the sheet. */
  name: string;
  yearGroup: string | null;
  academicYear: string;
  /** Sheet rows that asked for this class, for the preview. */
  rowCount: number;
}

/**
 * Read-only pass used by the PREVIEW. Works out which class names already
 * exist and which would have to be created, WITHOUT touching the database.
 */
export function planClasses(
  existing: ClassLike[],
  requests: Array<{ name: string; yearGroup: string | null; academicYear: string | null }>,
): { existingByKey: Map<string, ClassLike>; toCreate: PendingClass[] } {
  const existingByKey = new Map<string, ClassLike>();
  for (const c of existing) {
    const k = classKey(c.name || "");
    if (k && !existingByKey.has(k)) existingByKey.set(k, c);
  }

  // Cache keyed on the normalised name so "Year 7C" appearing on four rows
  // produces exactly ONE pending class, never four.
  const pending = new Map<string, PendingClass>();
  for (const r of requests) {
    const name = (r.name || "").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const k = classKey(name);
    if (existingByKey.has(k)) continue;
    const already = pending.get(k);
    if (already) {
      already.rowCount += 1;
      // Fill in details from a later row if the first one didn't carry them.
      if (!already.yearGroup && r.yearGroup) already.yearGroup = r.yearGroup;
      continue;
    }
    pending.set(k, {
      name,
      yearGroup: r.yearGroup || null,
      academicYear: r.academicYear || academicYearFor(),
      rowCount: 1,
    });
  }

  return { existingByKey, toCreate: Array.from(pending.values()) };
}

/**
 * Write-side resolver used INSIDE the import transaction.
 *
 * Holds the per-import class cache described above: `resolve()` returns the
 * cached id for a name it has already seen, so a class is never created twice
 * within one import, and never re-queried unnecessarily.
 */
export class ClassResolver {
  private cache = new Map<string, ResolvedClass>();
  private created: ResolvedClass[] = [];

  constructor(
    existing: ClassLike[],
    private readonly createFn: (input: { name: string; yearGroup: string | null; academicYear: string }) => Promise<ClassLike>,
  ) {
    for (const c of existing) {
      const k = classKey(c.name || "");
      if (k && !this.cache.has(k)) this.cache.set(k, { id: c.id, name: c.name, created: false });
    }
  }

  /** Classes this resolver created, in creation order. */
  get createdClasses(): ResolvedClass[] {
    return this.created;
  }

  /**
   * Reuse or create. Returns null for a blank class name — a student with no
   * class is valid in ScholarShelf (the manual form leaves Class optional).
   */
  async resolve(
    rawName: string | null,
    details: { yearGroup?: string | null; academicYear?: string | null } = {},
  ): Promise<ResolvedClass | null> {
    const name = (rawName || "").trim().replace(/\s+/g, " ");
    if (!name) return null;
    const k = classKey(name);

    const hit = this.cache.get(k);
    if (hit) return hit;

    const row = await this.createFn({
      name,
      yearGroup: details.yearGroup || null,
      academicYear: details.academicYear || academicYearFor(),
    });
    const resolved: ResolvedClass = { id: row.id, name: row.name, created: true };
    this.cache.set(k, resolved);
    this.created.push(resolved);
    return resolved;
  }
}
