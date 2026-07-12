# Object Storage Migration Plan (Slice 6)

*Design deliverable — no behavior is changed by this document. It defines the seam
and the migration path so binary assets can move out of Postgres safely and later.*

## 1. Current state (the problem)

Binary assets are embedded directly in the database as base64 **data-URIs**:

- `students.photo_url` — accepts `data:image/*;base64,...` up to ~800 KB per row
  (`safePhotoUrl` in `family-enrollment.routes.ts`). A class of 30 students with
  photos can add tens of MB to a single table.
- `media_assets` (IT Media Library) — similar pattern for uploaded media.
- School branding logos — stored/So served as data-URIs in places.

Consequences: bloated rows, slower `SELECT *` on students/media, large network
payloads (the photo travels inside every JSON list response), no CDN caching, and
backup/restore weight. It also caps practical image size well below what a real
photo needs.

## 2. Target architecture

Store the **bytes in object storage** and keep only a short **URL/key** in Postgres.

- Provider: any S3-compatible store — AWS S3, Cloudflare R2, or Vercel Blob.
- DB columns (`photo_url`, media URL, logo URL) hold an `https://…` URL (or an
  opaque key resolved to a URL at read time). No base64 in the database.
- Assets served via the provider/CDN, cached at the edge, out of the API path.

## 3. The seam: `StorageProvider`

`server/storageProvider.ts` defines a minimal interface so call sites depend on an
abstraction, not on S3 specifics:

```
interface StorageProvider {
  put(key, data: Buffer, contentType): Promise<{ url, key }>;
  delete(key): Promise<void>;
  getUrl(key): string;
}
```

Implementations:
- `DataUriStorageProvider` (default, ships now) — preserves today's behavior so
  nothing breaks: `put` returns a `data:` URI, `getUrl` is identity, `delete` is a
  no-op. This makes the current code representable through the interface.
- `S3StorageProvider` (future) — writes to a bucket, returns the public/CDN URL.
  Selected via `STORAGE_DRIVER=s3` + bucket/credentials env.

A `getStorageProvider()` factory picks the implementation from `STORAGE_DRIVER`
(default `data-uri`), so switching drivers is a config change, not a code change.

## 4. Migration phases (each reversible)

1. **Introduce the seam (this slice).** Add `StorageProvider` + `DataUriStorageProvider`
   + factory. No call sites rewired yet — zero behavior change.
2. **Route new uploads through the provider.** Change photo/media/logo upload paths
   to call `provider.put(...)` and persist the returned URL. With the default
   driver this is still a data-URI, so behavior is identical until the driver flips.
3. **Provision a bucket + wire `S3StorageProvider`.** Add env (bucket, region,
   keys, public base URL). Flip `STORAGE_DRIVER=s3` in staging first.
4. **Backfill existing data-URIs.** A one-off script iterates `students.photo_url`
   / `media_assets` / logos, uploads each decoded base64 blob to the bucket, and
   replaces the column with the returned URL. Idempotent (skip rows already
   `https://…`); keep a rollback column/snapshot until verified.
5. **Enforce limits at the edge of upload.** Max size, allowed content-types
   (image/png|jpeg|webp|gif|svg — reusing the existing `safePhotoUrl` allowlist),
   and reject active-content schemes (already done for `data:text/html`).
6. **Serve via CDN.** Public-read bucket with unguessable keys, or signed URLs for
   private assets.

## 5. Security considerations

- Validate content-type and size **before** `put` (never trust the client).
- Unguessable keys (UUID-based) so listing/guessing other tenants' assets is
  infeasible; scope keys by `schoolId/` prefix for tenant separation.
- Prefer signed, expiring URLs for anything not meant to be world-readable.
- Keep the existing stored-XSS defense (reject `data:text/html`, `javascript:`).

## 6. Rollback

Every phase is reversible: the seam is additive (phase 1), driver selection is a
single env var (phase 3), and the backfill keeps the original data-URI until the
bucket copy is verified (phase 4), so reverting is "flip the driver back / restore
the column".
