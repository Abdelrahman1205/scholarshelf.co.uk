# School Website Architecture — IT Dashboard-Controlled Public Sites

**Status:** Design spec (V1 foundation already implemented)
**Audience:** BytHub engineering
**Principle:** The public school website is a *renderer of database content*, never a codebase. All content operations happen in the IT Personnel Dashboard inside EduBook.

---

## 0. The Core Model (read this first)

The school website is **headless-CMS architecture**:

```
IT Personnel Dashboard  ──writes──▶  Database (website content tables)
                                          │
Public school website   ◀──reads───  Public JSON API (/api/public/…)
```

There is **no hardcoded content** in the website frontend. The frontend is a
generic template that knows how to render *types* of content (a hero, an
announcement, a gallery); *what* it renders comes entirely from the database
at request time. Editing the site = editing rows. Publishing = flipping a
boolean. No builds, no deploys, no code.

This is the same model as Shopify storefronts and WordPress.com: one codebase
we maintain, N school websites served from it, each isolated by tenant ID.

---

## 1. How the standalone website should be structured

Two deployment shapes, both consuming the same API. Ship A now, add B when
custom domains are sold:

**Shape A — integrated route (current, V1):**
The website is the `/school/:code` route inside the EduBook SPA. Zero extra
infrastructure; already live.

**Shape B — standalone renderer (V2, for custom domains + SEO):**
A separate, very small server-rendered frontend (Next.js or an Express +
template route inside the existing API) whose only job is:

1. Resolve the tenant: from the hostname (`www.someschool.co.uk` → look up
   `school_domains` table) or from the path (`/school/MSS`).
2. Fetch that school's published content from the EduBook public API.
3. Render HTML.

Even in Shape B the renderer contains **no content and no per-school code** —
one deployment serves every school. "Standalone" means *standalone domain and
rendering*, never *standalone codebase per school*. A per-school codebase
would put developers back in the content loop, which defeats the product.

The renderer is a dumb component library: `HeroBlock`, `AnnouncementBlock`,
`GalleryBlock`, `ContactBlock`, `CustomBlock`… Each takes JSON from the API
and renders it with the school's branding tokens (colours/fonts from
`school_branding`). Adding a new block type = one new component + one new
`type` value, available to every school at once.

## 2. Database tables for editable website content

Already implemented:

- **`school_website_sections`** — the content blocks:
  `id, schoolId, type (hero|about|announcement|contact|custom), title, body,
  imageUrl, linkUrl, linkLabel, sortOrder, isPublished, createdAt, updatedAt,
  updatedBy`
- **`school_branding`** — visual identity (logos, banner, colours, font),
  shared with the portal UI.

Add incrementally as features are needed (do NOT build all upfront):

- **`school_website_pages`** — when schools need more than one page:
  `id, schoolId, slug ("about-us"), title, sortOrder, isPublished,
  showInNav`. Then add `pageId` to `school_website_sections`. Navigation menu
  = published pages ordered by `sortOrder`. V1 behaves as a single implicit
  "home" page (`pageId null`).
- **`school_media`** — uploaded images (replaces paste-a-URL):
  `id, schoolId, fileName, mimeType, url/fileId, uploadedBy, createdAt`.
  Reuse the existing branding-upload pipeline (multer memory storage + the
  same file host branding uses). Sections then reference `mediaId` or keep
  `imageUrl` populated from it.
- **`school_domains`** — custom domain mapping for Shape B:
  `id, schoolId, hostname (unique), isVerified, createdAt`.
- **`school_website_settings`** — one row per school for site-wide bits that
  aren't blocks: SEO title/description, social links, opening hours, footer
  text, Google Maps embed, analytics ID.

Contact details (address/email/phone) already live on `schools` and are
served by the public API — the contact block reads those; a section of type
`contact` can add extra text around them.

## 3. How the IT Dashboard saves and updates content

Already implemented and the pattern for everything that follows:

- Manager endpoints under `/api/website/*`, guarded by
  `requireRole("admin", "school_admin", "it_personnel", …owners)` —
  note **teachers, finance, parents can never touch these**.
- `schoolId` always comes from the server session (`sessionSchoolId`),
  never from the request body — same tenant-isolation rule as the rest of
  EduBook. An IT user can only ever edit their own school's site.
- All input Zod-validated (`websiteSectionInputSchema`); all mutations
  audit-logged (`website_section_created/updated/deleted`).
- Draft-first workflow: new content is `isPublished: false`; the editor
  shows drafts; the public API never returns them. Publish is an explicit
  toggle. This gives schools a safe staging area with no extra infra.

Future media uploads follow the identical pattern: POST multipart to
`/api/website/media`, validated MIME whitelist, stored via the branding file
pipeline, returns a URL the section editor drops into `imageUrl`.

## 4. How the public website fetches and displays content

Already implemented:

- `GET /api/public/schools/:code` — identity + branding (existing).
- `GET /api/public/schools/:code/website` — **published** sections only,
  ordered by `sortOrder`, stripped to safe public fields (no updatedBy, no
  internal flags). Unauthenticated by design. Fails safe: on any error it
  returns `[]` so the public page can never crash from CMS problems.

Rules that must hold as this grows:

- The public API returns only `isPublished = true` rows, always
  school-scoped, and only whitelisted fields.
- Add HTTP caching when traffic justifies it (`Cache-Control: public,
  max-age=60` or Vercel edge caching) — content freshness within a minute is
  fine for school sites and keeps DB load trivial.
- For Shape B/SEO later: server-render this route so crawlers get full HTML;
  the API contract stays identical.

## 5. Per-school content isolation

Yes — every website table carries `schoolId` (FK to `schools`, cascade on
delete), exactly like books/students/payments. The website inherits the
platform's existing multi-tenant guarantees: session-derived scoping on
writes, code-scoped lookups on public reads, cross-tenant access
architecturally impossible through the API. One school's IT user cannot see
or edit another school's site; deleting a school (owner danger-zone) removes
its website content via FK cascade.

## 6. Handling each content kind

| Content | Mechanism |
|---|---|
| Pages | `school_website_pages` (V2); nav auto-built from published pages |
| Sections / marketing text | `school_website_sections` rows, typed blocks, ordered, draft→publish |
| Banners / hero | `school_branding.bannerImageUrl` for the site-wide hero; `hero`-type sections for campaign banners |
| Images | `school_media` uploads (V2); `imageUrl` on sections today |
| Announcements / news | `announcement`-type sections (already render with a "News" badge); a dated news feed later = same table + `publishedAt` ordering |
| Contact details | from `schools` (single source of truth — also used by invoices/emails); `contact` sections for extra copy |
| SEO/social/footer/hours | `school_website_settings` (V2) |

## 7. Separation from the EduBook Admin Dashboard

Enforced at three layers, all live now:

1. **Server permissions** — website endpoints accept `it_personnel` (plus
   school_admin as supervisor); EduBook operational endpoints
   (books/students/payments/users…) require `ADMIN_UI_ROLES`, which
   **excludes** `it_personnel`. An IT login physically cannot read or mutate
   operational data.
2. **Client routing** — `itAllowedSections = {website, website-content,
   branding}` in `admin.tsx`; any other section an IT user requests resolves
   back to the Website Control Center. Their sidebar (`it_personnel` nav
   config) shows only Website Control, Page Sections, Branding.
3. **Different landing** — IT logs in → `/admin/website` (Control Center),
   school admins → `/admin` (operations dashboard). The school admin
   deliberately *also* gets the Website nav item, as the supervising role —
   remove it from the admin nav config if you want the separation absolute.

## 8. Clean architecture summary in the current codebase

```
shared/schema.ts            schoolWebsiteSections (+ future pages/media/domains/settings)
server/routes/website.routes.ts   manager API  (IT + school admin, session-scoped, audited)
server/routes/public.routes.ts    public API   (published-only, fail-safe, unauthenticated)
server/storage.ts                 getWebsiteSections / create / update / delete / move
client/src/pages/admin/it-dashboard.tsx   Website Control Center (IT landing)
client/src/pages/admin/website.tsx        Page Sections editor (the CMS)
client/src/pages/school-public.tsx        public renderer (typed blocks + branding)
```

Layering rule to preserve: **routes → storage → DB**, content flows only
through the two APIs, the renderer stays generic. Every future website
feature is: a table (+schoolId), storage methods, a manager endpoint, a
public endpoint field, a block component. Never a per-school branch, never
hardcoded content, never a rebuild to change a word on a school's site.

## Build order recommendation

1. **Done (V1):** sections CMS + editor + public rendering + role separation.
2. Direct image uploads (`school_media`, reuse branding pipeline).
3. Multiple pages + navigation (`school_website_pages`).
4. Site settings (SEO, social, footer, hours).
5. News feed view (dated announcements) + gallery block.
6. Custom domains (`school_domains` + host-based tenant resolution).
7. SSR for the public route (SEO) — only when schools ask for search ranking.
