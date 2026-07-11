/**
 * server/mfa.ts
 *
 * Time-based One-Time Password (TOTP) multi-factor authentication.
 * Implemented with Node's built-in crypto only — no third-party TOTP library.
 *
 *  - Secrets:        RFC 4648 base32 (compatible with Google Authenticator, Authy, 1Password, etc.)
 *  - One-time codes: RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) with a ±1 step window
 *  - Recovery codes: high-entropy random codes, stored only as SHA-256 hashes, single-use
 */
import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new base32-encoded TOTP secret (default 20 random bytes = 160 bits). */
export function generateSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

/** RFC 4226 HMAC-based OTP for a given counter. */
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

/**
 * Verify a 6-digit TOTP token against a secret, allowing a ±`window` step drift
 * (default ±1 = ±30s) to tolerate clock skew. Constant-time comparison.
 */
export function verifyTOTP(secret: string, token: string, window = 1, stepSeconds = 30): boolean {
  const trimmed = (token || "").trim();
  if (!secret || !/^\d{6}$/.test(trimmed)) return false;
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  const provided = Buffer.from(trimmed);
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(secret, counter + i));
    if (candidate.length === provided.length && crypto.timingSafeEqual(candidate, provided)) {
      return true;
    }
  }
  return false;
}

/** Build the otpauth:// provisioning URI that authenticator apps scan as a QR code. */
export function otpauthURL(secret: string, account: string, issuer = "ScholarShelf"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Generate `count` single-use recovery codes formatted as xxxx-xxxx-xxxx-xxxx. */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(8).toString("hex"); // 16 hex chars = 64 bits
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`);
  }
  return codes;
}

/** Normalise a recovery code (strip dashes/space, lowercase) then SHA-256 hash it. */
export function hashRecoveryCode(code: string): string {
  const normalised = (code || "").replace(/[\s-]/g, "").toLowerCase();
  return crypto.createHash("sha256").update(normalised).digest("hex");
}

/** Constant-time-ish check that a plaintext recovery code matches one of the stored hashes. */
export function matchRecoveryCode(code: string, hashes: string[]): string | null {
  const target = hashRecoveryCode(code);
  for (const h of hashes) {
    if (h.length === target.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(target))) {
      return h;
    }
  }
  return null;
}
