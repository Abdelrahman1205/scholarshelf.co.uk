/**
 * server/storageProvider.ts — object-storage seam (Slice 6, phase 1)
 *
 * Defines the abstraction that binary-asset call sites (student photos, media
 * library, branding logos) will depend on instead of embedding base64 data-URIs
 * in Postgres. Shipping the DEFAULT `data-uri` driver preserves today's exact
 * behavior — nothing is rewired yet. Switching to a real bucket later is a config
 * change (STORAGE_DRIVER=s3) plus an S3StorageProvider implementation, per
 * OBJECT_STORAGE_PLAN.md. This file has no external dependencies.
 */

export interface PutResult {
  url: string;
  key: string;
}

export interface StorageProvider {
  /** Store bytes and return a durable URL + the key used. */
  put(key: string, data: Buffer, contentType: string): Promise<PutResult>;
  /** Remove a stored object (no-op if it doesn't exist). */
  delete(key: string): Promise<void>;
  /** Resolve a key to a servable URL. */
  getUrl(key: string): string;
}

/**
 * Default provider: keeps the current behavior of embedding assets as data-URIs.
 * This lets existing code be expressed through the interface with zero change in
 * what actually gets stored, so phase-1 adoption is risk-free.
 */
export class DataUriStorageProvider implements StorageProvider {
  async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
    const url = `data:${contentType};base64,${data.toString("base64")}`;
    return { url, key };
  }
  async delete(_key: string): Promise<void> {
    /* data-URIs live inline in the DB row; deletion is handled by the row update. */
  }
  getUrl(key: string): string {
    // For the data-URI driver the "key" already is the servable value.
    return key;
  }
}

let _provider: StorageProvider | null = null;

/**
 * Select the active provider from STORAGE_DRIVER (default: "data-uri").
 * When an S3StorageProvider is added, wire it under case "s3" here — call sites
 * never change.
 */
export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;
  const driver = (process.env.STORAGE_DRIVER || "data-uri").toLowerCase();
  switch (driver) {
    // case "s3": _provider = new S3StorageProvider(); break;   // future (phase 3)
    case "data-uri":
    default:
      _provider = new DataUriStorageProvider();
  }
  return _provider;
}
